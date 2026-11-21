import { count, desc, eq } from "drizzle-orm";
import type { User, UserRole } from "../../domain/entities/user";
import { ConflictError } from "../../domain/errors/app-error";
import type {
  CreateUserInput,
  IUserRepository,
  PaginatedResult,
  PaginationParams,
} from "../../domain/ports/user-repository";
import type { Database } from "../database";
import { users, type UserRow } from "../database/schema";

interface MysqlErrorLike {
  readonly code?: unknown;
  readonly errno?: unknown;
  readonly cause?: unknown;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDuplicateEntryError(error: unknown): boolean {
  if (!isObjectRecord(error)) {
    return false;
  }

  const candidate = error as MysqlErrorLike;
  if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) {
    return true;
  }

  if (candidate.cause !== undefined) {
    return isDuplicateEntryError(candidate.cause);
  }

  return false;
}

function toUserRole(role: string): UserRole {
  return role === "admin" ? "admin" : "user";
}

function mapRowToDomain(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: toUserRole(row.role),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const row = rows[0];
    return row ? mapRowToDomain(row) : null;
  }

  async findById(id: number): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const row = rows[0];
    return row ? mapRowToDomain(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      const [result] = await this.db.insert(users).values({
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role ?? "user",
      });

      const insertedId = Number(result.insertId);
      const created = await this.findById(insertedId);

      if (!created) {
        throw new Error("Failed to retrieve newly created user");
      }

      return created;
    } catch (error: unknown) {
      if (isDuplicateEntryError(error)) {
        throw new ConflictError("Email is already registered", [
          { field: "email", message: "Email is already registered" },
        ]);
      }
      throw error;
    }
  }

  async findPaginated(params: PaginationParams): Promise<PaginatedResult<User>> {
    const offset = (params.page - 1) * params.perPage;

    const [rows, totalRows] = await Promise.all([
      this.db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(params.perPage)
        .offset(offset),
      this.db.select({ total: count() }).from(users),
    ]);

    const total = Number(totalRows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / params.perPage);

    return {
      items: rows.map(mapRowToDomain),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages,
    };
  }
}
