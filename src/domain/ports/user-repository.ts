import type { User, UserRole } from "../entities/user";

export interface CreateUserInput {
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role?: UserRole;
}

export interface PaginationParams {
  readonly page: number;
  readonly perPage: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly perPage: number;
  readonly totalPages: number;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  findPaginated(params: PaginationParams): Promise<PaginatedResult<User>>;
}
