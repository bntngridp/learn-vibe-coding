import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app";
import type { User } from "../src/domain/entities/user";
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

class StubUserRepository implements IUserRepository {
  async findByEmail(): Promise<User | null> {
    return null;
  }
  async findById(): Promise<User | null> {
    return null;
  }
  async create(_input: CreateUserInput): Promise<User> {
    throw new Error("Not implemented in stub");
  }
  async findPaginated(params: PaginationParams): Promise<PaginatedResult<User>> {
    return {
      items: [],
      total: 0,
      page: params.page,
      perPage: params.perPage,
      totalPages: 0,
    };
  }
}

interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components?: {
    securitySchemes?: Record<string, Record<string, unknown>>;
  };
}

function buildTestApp() {
  const userRepository = new StubUserRepository();
  const passwordHasher = new BunPasswordHasher();
  const tokenService = new JwtTokenService({
    secret: "swagger-test-secret-key-at-least-32-characters-long",
    expiresIn: "1h",
    issuer: "learn-vibe-coding-test",
  });

  return createApp({
    authUseCase: new AuthUseCase(userRepository, passwordHasher, tokenService),
    userUseCase: new UserUseCase(userRepository),
    tokenService,
    checkDatabaseConnection: async () => true,
  });
}

describe("Swagger OpenAPI Documentation", () => {
  it("serves Swagger UI HTML on GET /swagger across repeated requests", async () => {
    const app = buildTestApp();

    const first = await app.handle(new Request("http://localhost/swagger"));
    expect(first.status).toBe(200);
    const firstHtml = await first.text();
    expect(firstHtml).toContain("swagger-ui");
    expect(firstHtml).toContain("learn-vibe-coding API");

    const second = await app.handle(new Request("http://localhost/swagger"));
    expect(second.status).toBe(200);
    const secondHtml = await second.text();
    expect(secondHtml).toContain("swagger-ui");
  });

  it("exposes complete OpenAPI 3.0.3 spec with dummy examples and Bearer JWT scheme on GET /swagger/json", async () => {
    const app = buildTestApp();

    const response = await app.handle(
      new Request("http://localhost/swagger/json")
    );
    expect(response.status).toBe(200);

    const spec = (await response.json()) as OpenApiDocument;
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("learn-vibe-coding API");
    expect(spec.components?.securitySchemes?.bearerAuth?.scheme).toBe("bearer");

    // Verify all core paths are documented
    expect(spec.paths["/health"]?.get).toBeDefined();
    expect(spec.paths["/api/v1/auth/register"]?.post).toBeDefined();
    expect(spec.paths["/api/v1/auth/login"]?.post).toBeDefined();
    expect(spec.paths["/api/v1/auth/me"]?.get).toBeDefined();
    expect(spec.paths["/api/v1/users"]?.get).toBeDefined();

    // Verify protected routes declare bearerAuth security
    expect(spec.paths["/api/v1/auth/me"]?.get?.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(spec.paths["/api/v1/users"]?.get?.security).toEqual([
      { bearerAuth: [] },
    ]);

    // Verify dummy examples exist in register & login request body schemas
    const loginJson = JSON.stringify(
      spec.paths["/api/v1/auth/login"]?.post?.requestBody
    );
    expect(loginJson).toContain("bintang@example.com");
    expect(loginJson).toContain("Password123");

    const registerJson = JSON.stringify(
      spec.paths["/api/v1/auth/register"]?.post?.requestBody
    );
    expect(registerJson).toContain("new.user@example.com");
    expect(registerJson).toContain("New Demo User");
  });
});
