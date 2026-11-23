import type { IPasswordHasher } from "../../domain/ports/password-hasher";

export class BunPasswordHasher implements IPasswordHasher {
  /** Mengubah password plaintext menjadi hash bcrypt (cost 10) sebelum disimpan ke database. */
  async hash(plainPassword: string): Promise<string> {
    return Bun.password.hash(plainPassword, {
      algorithm: "bcrypt",
      cost: 10,
    });
  }

  /** Membandingkan password plaintext dengan hash bcrypt yang tersimpan di database. */
  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return Bun.password.verify(plainPassword, passwordHash);
  }
}
