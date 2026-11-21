import { Elysia, t } from "elysia";
import type { ITokenService } from "../../../domain/ports/token-service";
import type { UserUseCase } from "../../../usecases/user-usecase";
import { createAuthMiddleware } from "../middlewares/auth-middleware";
import { paginatedResponse } from "../response";

export interface UserRoutesDeps {
  readonly userUseCase: UserUseCase;
  readonly tokenService: ITokenService;
}

export function createUserRoutes({ userUseCase, tokenService }: UserRoutesDeps) {
  const authMiddleware = createAuthMiddleware(tokenService);

  return new Elysia({ prefix: "/api/v1/users" }).use(authMiddleware).get(
    "/",
    async ({ query }) => {
      const result = await userUseCase.listUsers(query.page, query.per_page);
      return paginatedResponse("Users retrieved successfully", result.items, {
        page: result.page,
        per_page: result.perPage,
        total: result.total,
        total_pages: result.totalPages,
      });
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        per_page: t.Optional(t.Numeric()),
      }),
    }
  );
}
