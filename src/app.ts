import { Elysia } from "elysia";
import type { ITokenService } from "./domain/ports/token-service";
import { errorHandlerMiddleware } from "./delivery/http/middlewares/error-handler";
import { securityHeadersMiddleware } from "./delivery/http/middlewares/security-headers";
import { errorResponse, successResponse } from "./delivery/http/response";
import { createAuthRoutes } from "./delivery/http/routes/auth-routes";
import { createUserRoutes } from "./delivery/http/routes/user-routes";
import { createSwaggerPlugin } from "./delivery/http/swagger";
import type { AuthUseCase } from "./usecases/auth-usecase";
import type { UserUseCase } from "./usecases/user-usecase";

export interface AppDeps {
  readonly authUseCase: AuthUseCase;
  readonly userUseCase: UserUseCase;
  readonly tokenService: ITokenService;
  readonly checkDatabaseConnection: () => Promise<boolean>;
}

/** Merakit seluruh middleware, dokumentasi Swagger UI, dan route aplikasi ElysiaJS. */
export function createApp(deps: AppDeps) {
  return new Elysia()
    .use(securityHeadersMiddleware)
    .use(errorHandlerMiddleware)
    .use(createSwaggerPlugin())
    .get(
      "/health",
      async ({ set }) => {
        const dbConnected = await deps.checkDatabaseConnection();
        if (!dbConnected) {
          set.status = 503;
          return errorResponse("Database connection unavailable");
        }

        return successResponse("Service is healthy", {
          database: "connected",
          uptimeSeconds: Math.floor(process.uptime()),
        });
      },
      {
        detail: {
          tags: ["Health"],
          summary: "Cek kesehatan server dan database",
          description:
            "Memverifikasi status HTTP server serta melakukan ping aktif ke database MySQL.",
          responses: {
            "200": {
              description: "Server sehat dan database terhubung.",
              content: {
                "application/json": {
                  example: {
                    status: "success",
                    message: "Service is healthy",
                    data: {
                      database: "connected",
                      uptimeSeconds: 120,
                    },
                  },
                },
              },
            },
            "503": {
              description: "Koneksi ke database MySQL sedang tidak tersedia.",
              content: {
                "application/json": {
                  example: {
                    status: "error",
                    message: "Database connection unavailable",
                  },
                },
              },
            },
          },
        },
      }
    )
    .use(
      createAuthRoutes({
        authUseCase: deps.authUseCase,
        tokenService: deps.tokenService,
      })
    )
    .use(
      createUserRoutes({
        userUseCase: deps.userUseCase,
        tokenService: deps.tokenService,
      })
    );
}
