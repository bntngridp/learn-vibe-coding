import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config/env";
import {
  createDatabase,
  type DatabaseConnection,
} from "../src/infrastructure/database";
import { users } from "../src/infrastructure/database/schema";
import { DrizzleUserRepository } from "../src/infrastructure/repositories/drizzle-user-repository";
import { BunPasswordHasher } from "../src/infrastructure/security/bun-password-hasher";
import { JwtTokenService } from "../src/infrastructure/security/jwt-token-service";
import { AuthUseCase } from "../src/usecases/auth-usecase";
import { UserUseCase } from "../src/usecases/user-usecase";

interface JsonBody {
  status: string;
  message: string;
  data?: Record<string, unknown>;
}

describe("Auth API Integration (DBngin MySQL)", () => {
  const testEmail = `integration_${Date.now()}@example.com`;
  let database: DatabaseConnection;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const config = loadConfig();
    database = createDatabase(config.databaseUrl);
    const userRepository = new DrizzleUserRepository(database.db);
    const passwordHasher = new BunPasswordHasher();
    const tokenService = new JwtTokenService({
      secret: config.jwtSecret,
      expiresIn: config.jwtExpiresIn,
      issuer: config.jwtIssuer,
    });

    const authUseCase = new AuthUseCase(
      userRepository,
      passwordHasher,
      tokenService
    );
    const userUseCase = new UserUseCase(userRepository);

    app = createApp({
      authUseCase,
      userUseCase,
      tokenService,
      checkDatabaseConnection: () => database.checkConnection(),
    });
  });

  afterAll(async () => {
    await database.db.delete(users).where(eq(users.email, testEmail));
    await database.close();
  });

  it("reports healthy database connection on GET /health", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.status).toBe("success");
    expect(body.data?.database).toBe("connected");
  });

  it("persists registered user in MySQL with hashed password, rejects duplicate, and allows login + /me", async () => {
    const registerRes = await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Integration User",
          email: testEmail,
          password: "SecurePassword123",
        }),
      })
    );
    expect(registerRes.status).toBe(201);

    const [storedUser] = await database.db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    expect(storedUser).toBeDefined();
    expect(storedUser?.passwordHash).not.toBe("SecurePassword123");
    expect(storedUser?.passwordHash.startsWith("$argon2id$")).toBe(true);

    const duplicateRes = await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Duplicate User",
          email: testEmail,
          password: "SecurePassword123",
        }),
      })
    );
    expect(duplicateRes.status).toBe(409);

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "SecurePassword123",
        }),
      })
    );
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as JsonBody;
    const token = loginBody.data?.accessToken as string;
    expect(typeof token).toBe("string");

    const meRes = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        headers: { authorization: `Bearer ${token}` },
      })
    );
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as JsonBody;
    const meUser = meBody.data?.user as Record<string, unknown>;
    expect(meUser.email).toBe(testEmail);
    expect(meUser.name).toBe("Integration User");
  });
});
