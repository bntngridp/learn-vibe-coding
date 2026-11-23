import { loadConfig } from "../../config/env";
import type { UserRole } from "../../domain/entities/user";
import { createDatabase } from "./index";
import { DrizzleUserRepository } from "../repositories/drizzle-user-repository";
import { BunPasswordHasher } from "../security/bun-password-hasher";

interface SeedUser {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: UserRole;
}

const DUMMY_USERS: readonly SeedUser[] = [
  {
    name: "Bintang Pribadi",
    email: "bintang@example.com",
    password: "Password123",
    role: "admin",
  },
  {
    name: "Demo User",
    email: "demo.user@example.com",
    password: "Password123",
    role: "user",
  },
];

/** Mengisi akun dummy awal ke tabel users secara idempoten agar Swagger UI langsung bisa diuji. */
async function seed(): Promise<void> {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);
  const userRepository = new DrizzleUserRepository(database.db);
  const passwordHasher = new BunPasswordHasher();

  try {
    for (const dummy of DUMMY_USERS) {
      const existing = await userRepository.findByEmail(dummy.email);
      if (existing) {
        console.log(`Skipped existing dummy user: ${dummy.email}`);
        continue;
      }

      const passwordHash = await passwordHasher.hash(dummy.password);
      await userRepository.create({
        name: dummy.name,
        email: dummy.email,
        passwordHash,
        role: dummy.role,
      });
      console.log(`Seeded dummy user: ${dummy.email} (role: ${dummy.role})`);
    }
  } finally {
    await database.close();
  }
}

void seed().catch((error: unknown) => {
  console.error("Failed to seed database:", error);
  process.exit(1);
});
