import { Elysia, t } from "elysia";
import type { ITokenService } from "../../../domain/ports/token-service";
import type { AuthUseCase } from "../../../usecases/auth-usecase";
import { createAuthMiddleware } from "../middlewares/auth-middleware";
import { successResponse } from "../response";

export interface AuthRoutesDeps {
  readonly authUseCase: AuthUseCase;
  readonly tokenService: ITokenService;
}

export function createAuthRoutes({ authUseCase, tokenService }: AuthRoutesDeps) {
  const authMiddleware = createAuthMiddleware(tokenService);

  const protectedAuthRoutes = new Elysia()
    .use(authMiddleware)
    .get("/me", async ({ authUser }) => {
      const user = await authUseCase.getCurrentUser(authUser.userId);
      return successResponse("Authenticated user retrieved successfully", {
        user,
      });
    });

  return new Elysia({ prefix: "/api/v1/auth" })
    .post(
      "/register",
      async ({ body, set }) => {
        const result = await authUseCase.register({
          name: body.name,
          email: body.email,
          password: body.password,
        });
        set.status = 201;
        return successResponse("User registered successfully", result);
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1 }),
          email: t.String({ minLength: 1 }),
          password: t.String({ minLength: 1 }),
        }),
      }
    )
    .post(
      "/login",
      async ({ body, set }) => {
        const result = await authUseCase.login({
          email: body.email,
          password: body.password,
        });
        set.status = 200;
        return successResponse("Login successful", result);
      },
      {
        body: t.Object({
          email: t.String({ minLength: 1 }),
          password: t.String({ minLength: 1 }),
        }),
      }
    )
    .use(protectedAuthRoutes);
}
