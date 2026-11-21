import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "../../domain/entities/user";
import { UnauthorizedError } from "../../domain/errors/app-error";
import type {
  AuthTokenPayload,
  ITokenService,
  SignedTokenResult,
} from "../../domain/ports/token-service";

export interface JwtTokenServiceConfig {
  readonly secret: string;
  readonly expiresIn: string;
  readonly issuer: string;
}

function isUserRole(value: unknown): value is UserRole {
  return value === "user" || value === "admin";
}

export class JwtTokenService implements ITokenService {
  private readonly secretKey: Uint8Array;
  private readonly expiresIn: string;
  private readonly issuer: string;

  constructor(config: JwtTokenServiceConfig) {
    this.secretKey = new TextEncoder().encode(config.secret);
    this.expiresIn = config.expiresIn;
    this.issuer = config.issuer;
  }

  async signAccessToken(payload: AuthTokenPayload): Promise<SignedTokenResult> {
    const accessToken = await new SignJWT({
      email: payload.email,
      role: payload.role,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(String(payload.userId))
      .setIssuer(this.issuer)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn)
      .sign(this.secretKey);

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.expiresIn,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey, {
        algorithms: ["HS256"],
        issuer: this.issuer,
      });

      const userId = Number(payload.sub);
      const email = payload.email;
      const role = payload.role;

      if (
        !Number.isInteger(userId) ||
        userId <= 0 ||
        typeof email !== "string" ||
        !isUserRole(role)
      ) {
        throw new UnauthorizedError("Invalid token payload");
      }

      return {
        userId,
        email,
        role,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError("Invalid or expired access token");
    }
  }
}
