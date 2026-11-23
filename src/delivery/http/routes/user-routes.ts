import { Elysia, t } from "elysia";
import type { ITokenService } from "../../../domain/ports/token-service";
import type { UserUseCase } from "../../../usecases/user-usecase";
import { createAuthMiddleware } from "../middlewares/auth-middleware";
import { paginatedResponse } from "../response";

export interface UserRoutesDeps {
  readonly userUseCase: UserUseCase;
  readonly tokenService: ITokenService;
}

/** Mendaftarkan endpoint manajemen pengguna (/api/v1/users) yang dilindungi Bearer JWT. */
export function createUserRoutes({ userUseCase, tokenService }: UserRoutesDeps) {
  const authMiddleware = createAuthMiddleware(tokenService);

  return new Elysia({ prefix: "/api/v1/users" }).use(authMiddleware).get(
    "",
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
        page: t.Optional(
          t.Numeric({
            description: "Nomor halaman (integer >= 1, default: 1).",
            example: 1,
            default: 1,
          })
        ),
        per_page: t.Optional(
          t.Numeric({
            description: "Jumlah data per halaman (1-100, default: 10).",
            example: 10,
            default: 10,
          })
        ),
      }),
      detail: {
        tags: ["Users"],
        summary: "Ambil daftar pengguna (terpaginasi)",
        description:
          "Mengembalikan daftar pengguna tanpa field passwordHash beserta metadata paginasi. Memerlukan Bearer JWT dari endpoint login/register.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Daftar pengguna berhasil diambil.",
            content: {
              "application/json": {
                example: {
                  status: "success",
                  message: "Users retrieved successfully",
                  data: [
                    {
                      id: 2,
                      name: "Demo User",
                      email: "demo.user@example.com",
                      role: "user",
                      createdAt: "2026-11-23T13:00:00.000Z",
                      updatedAt: "2026-11-23T13:00:00.000Z",
                    },
                    {
                      id: 1,
                      name: "Bintang Pribadi",
                      email: "bintang@example.com",
                      role: "admin",
                      createdAt: "2026-11-23T13:00:00.000Z",
                      updatedAt: "2026-11-23T13:00:00.000Z",
                    },
                  ],
                  meta: {
                    page: 1,
                    per_page: 10,
                    total: 2,
                    total_pages: 1,
                  },
                },
              },
            },
          },
          "401": {
            description: "Token Bearer tidak ada atau tidak valid.",
            content: {
              "application/json": {
                example: {
                  status: "error",
                  message: "Missing or invalid Authorization header",
                },
              },
            },
          },
          "422": {
            description: "Parameter paginasi tidak valid.",
            content: {
              "application/json": {
                example: {
                  status: "error",
                  message: "Validation failed",
                  errors: [
                    { field: "page", message: "page must be an integer >= 1" },
                  ],
                },
              },
            },
          },
        },
      },
    }
  );
}
