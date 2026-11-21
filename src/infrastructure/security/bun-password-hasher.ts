import type { IPasswordHasher } from "../../domain/ports/password-hasher";

export class BunPasswordHasher implements IPasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return Bun.password.hash(plainPassword, {
      algorithm: "argon2id",
      memoryCost: 19456,
      timeCost: 2,
    });
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return Bun.password.verify(plainPassword, passwordHash);
  }
}
