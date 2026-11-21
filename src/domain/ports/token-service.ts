import type { UserRole } from "../entities/user";

export interface AuthTokenPayload {
  readonly userId: number;
  readonly email: string;
  readonly role: UserRole;
}

export interface SignedTokenResult {
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresIn: string;
}

export interface ITokenService {
  signAccessToken(payload: AuthTokenPayload): Promise<SignedTokenResult>;
  verifyAccessToken(token: string): Promise<AuthTokenPayload>;
}
