import { beforeEach, describe, expect, it } from "bun:test";
import { createApp } from "../src/app";
import type { User } from "../src/domain/entities/user";
import { ConflictError } from "../src/domain/errors/app-error";
import type {
  CreateUserInput,
  IUserRepository,
  PaginatedResult,
  PaginationParams,
} from "../src/domain/ports/user-repository";
import { BunPasswordHasher } from "../src/infrastructure/security/bun-password-hasher";
import { JwtTokenService } from "../src/infrastructure/security/jwt-token-service";
import { AuthUseCase } from "../src/usecases/auth-usecase";
import { UserUseCase } from "../src/usecases/user-usecase";

class InMemoryUserRepository implements IUserRepository {
  private nextId = 1;
  private readonly usersById = new Map<number, User>();

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.usersById.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findById(id: number): Promise<User | null> {
    return this.usersById.get(id) ?? null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("Email is already registered", [
        { field: "email", message: "Email is already registered" },
      ]);
    }

    const now = new Date();
    const user: User = {
      id: this.nextId++,
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role ?? "user",
      createdAt: now,
      updatedAt: now,
    };

    this.usersById.set(user.id, user);
    return user;
  }

  async findPaginated(params: PaginationParams): Promise<PaginatedResult<User>> {
    const all = Array.from(this.usersById.values()).sort((a, b) => b.id - a.id);
    const total = all.length;
    const offset = (params.page - 1) * params.perPage;
    const items = all.slice(offset, offset + params.perPage);
    const totalPages = total === 0 ? 0 : Math.ceil(total / params.perPage);

    return {
      items,
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages,
    };
  }
}

interface JsonBody {
  status: string;
  message: string;
  data?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  errors?: Array<{ field: string; message: string }>;
}

describe("Auth & User API (Unit)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const userRepository = new InMemoryUserRepository();
    const passwordHasher = new BunPasswordHasher();
    const tokenService = new JwtTokenService({
      secret: "unit-test-secret-key-at-least-32-characters-long",
      expiresIn: "1h",
      issuer: "learn-vibe-coding-test",
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
      checkDatabaseConnection: async () => true,
    });
  });

  it("registers a new user, normalizes email, hides passwordHash, and sets security headers", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "  Bintang Pribadi  ",
          email: "  Bintang@Example.COM ",
          password: "Password123",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");

    const body = (await response.json()) as JsonBody;
    expect(body.status).toBe("success");
    expect(body.message).toBe("User registered successfully");
    expect(typeof body.data?.accessToken).toBe("string");
    expect(body.data?.tokenType).toBe("Bearer");

    const user = body.data?.user as Record<string, unknown>;
    expect(user.name).toBe("Bintang Pribadi");
    expect(user.email).toBe("bintang@example.com");
    expect(user.role).toBe("user");
    expect("passwordHash" in user).toBe(false);
    expect("password" in user).toBe(false);
  });

  it("rejects weak password and invalid email with 422", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "A",
          email: "not-an-email",
          password: "short",
        }),
      })
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as JsonBody;
    expect(body.status).toBe("error");
    expect(body.errors?.length).toBe(3);
  });

  it("returns 409 Conflict when registering an existing email", async () => {
    const payload = JSON.stringify({
      name: "Bintang",
      email: "dup@example.com",
      password: "Password123",
    });

    const first = await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      })
    );
    expect(first.status).toBe(201);

    const second = await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      })
    );
    expect(second.status).toBe(409);
    const body = (await second.json()) as JsonBody;
    expect(body.status).toBe("error");
    expect(body.message).toBe("Email is already registered");
  });

  it("logs in an existing user and accesses /api/v1/auth/me and /api/v1/users", async () => {
    await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Bintang",
          email: "login@example.com",
          password: "Password123",
        }),
      })
    );

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "LOGIN@example.com",
          password: "Password123",
        }),
      })
    );

    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as JsonBody;
    expect(loginBody.status).toBe("success");
    const token = loginBody.data?.accessToken as string;
    expect(token.length).toBeGreaterThan(20);

    const meRes = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        headers: { authorization: `Bearer ${token}` },
      })
    );
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as JsonBody;
    const meUser = meBody.data?.user as Record<string, unknown>;
    expect(meUser.email).toBe("login@example.com");

    const usersRes = await app.handle(
      new Request("http://localhost/api/v1/users?page=1&per_page=5", {
        headers: { authorization: `Bearer ${token}` },
      })
    );
    expect(usersRes.status).toBe(200);
    const usersBody = (await usersRes.json()) as JsonBody;
    expect(usersBody.meta?.total).toBe(1);
    expect(usersBody.meta?.page).toBe(1);
  });

  it("rejects invalid login credentials and unauthenticated protected route calls with 401", async () => {
    await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Bintang",
          email: "auth@example.com",
          password: "Password123",
        }),
      })
    );

    const wrongPasswordRes = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "auth@example.com",
          password: "WrongPassword123",
        }),
      })
    );
    expect(wrongPasswordRes.status).toBe(401);

    const unknownEmailRes = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "unknown@example.com",
          password: "Password123",
        }),
      })
    );
    expect(unknownEmailRes.status).toBe(401);

    const meNoAuth = await app.handle(
      new Request("http://localhost/api/v1/auth/me")
    );
    expect(meNoAuth.status).toBe(401);

    const meBadToken = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        headers: { authorization: "Bearer invalid.jwt.token" },
      })
    );
    expect(meBadToken.status).toBe(401);
  });
});
