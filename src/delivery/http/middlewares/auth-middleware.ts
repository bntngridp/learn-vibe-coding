import { Elysia } from "elysia";
import { UnauthorizedError } from "../../../domain/errors/app-error";
import type {
  AuthTokenPayload,
  ITokenService,
} from "../../../domain/ports/token-service";

export function createAuthMiddleware(tokenService: ITokenService) {
  return new Elysia({ name: "auth-middleware" }).derive(
    { as: "scoped" },
    async ({ headers }): Promise<{ authUser: AuthTokenPayload }> => {
      const authHeader = headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError("Missing or invalid Authorization header");
      }

      const token = authHeader.slice("Bearer ".length).trim();
      if (token.length === 0) {
        throw new UnauthorizedError("Missing access token");
      }

      const authUser = await tokenService.verifyAccessToken(token);
      return { authUser };
    }
  );
}
