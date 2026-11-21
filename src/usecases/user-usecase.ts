import { toPublicUser, type PublicUser } from "../domain/entities/user";
import { ValidationError } from "../domain/errors/app-error";
import type {
  IUserRepository,
  PaginatedResult,
} from "../domain/ports/user-repository";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

export class UserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async listUsers(
    rawPage?: number,
    rawPerPage?: number
  ): Promise<PaginatedResult<PublicUser>> {
    const page = rawPage ?? DEFAULT_PAGE;
    const perPage = rawPerPage ?? DEFAULT_PER_PAGE;

    if (!Number.isInteger(page) || page < 1) {
      throw new ValidationError("Validation failed", [
        { field: "page", message: "page must be an integer >= 1" },
      ]);
    }

    if (!Number.isInteger(perPage) || perPage < 1 || perPage > MAX_PER_PAGE) {
      throw new ValidationError("Validation failed", [
        {
          field: "per_page",
          message: `per_page must be an integer between 1 and ${MAX_PER_PAGE}`,
        },
      ]);
    }

    const result = await this.userRepository.findPaginated({ page, perPage });

    return {
      items: result.items.map(toPublicUser),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    };
  }
}
