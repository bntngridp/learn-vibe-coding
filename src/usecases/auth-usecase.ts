import { toPublicUser, type PublicUser } from "../domain/entities/user";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  type FieldError,
} from "../domain/errors/app-error";
import type { IPasswordHasher } from "../domain/ports/password-hasher";
import type { ITokenService } from "../domain/ports/token-service";
import type { IUserRepository } from "../domain/ports/user-repository";

export interface RegisterInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface AuthResult {
  readonly user: PublicUser;
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresIn: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 255;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

export class AuthUseCase {
  private dummyPasswordHashPromise: Promise<string> | null = null;

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    const errors: FieldError[] = [];

    if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
      errors.push({
        field: "name",
        message: `Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters`,
      });
    }

    if (
      email.length === 0 ||
      email.length > MAX_EMAIL_LENGTH ||
      !EMAIL_PATTERN.test(email)
    ) {
      errors.push({
        field: "email",
        message: "Must be a valid email address",
      });
    }

    const passwordByteLength = new TextEncoder().encode(password).length;

    if (
      password.length < MIN_PASSWORD_LENGTH ||
      passwordByteLength > MAX_PASSWORD_BYTES
    ) {
      errors.push({
        field: "password",
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters and at most ${MAX_PASSWORD_BYTES} bytes`,
      });
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.push({
        field: "password",
        message: "Password must contain at least one letter and one number",
      });
    }

    if (errors.length > 0) {
      throw new ValidationError("Validation failed", errors);
    }

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError("Email is already registered", [
        { field: "email", message: "Email is already registered" },
      ]);
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const createdUser = await this.userRepository.create({
      name,
      email,
      passwordHash,
      role: "user",
    });

    const token = await this.tokenService.signAccessToken({
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
    });

    return {
      user: toPublicUser(createdUser),
      ...token,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    const errors: FieldError[] = [];

    if (email.length === 0 || !EMAIL_PATTERN.test(email)) {
      errors.push({
        field: "email",
        message: "Must be a valid email address",
      });
    }

    if (password.length === 0) {
      errors.push({
        field: "password",
        message: "Password is required",
      });
    }

    if (errors.length > 0) {
      throw new ValidationError("Validation failed", errors);
    }

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Mitigate timing-based user enumeration
      const dummyHash = await this.getDummyPasswordHash();
      await this.passwordHasher.verify(password, dummyHash);
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await this.passwordHasher.verify(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = await this.tokenService.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: toPublicUser(user),
      ...token,
    };
  }

  async getCurrentUser(userId: number): Promise<PublicUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User account no longer exists");
    }

    return toPublicUser(user);
  }

  private getDummyPasswordHash(): Promise<string> {
    if (!this.dummyPasswordHashPromise) {
      this.dummyPasswordHashPromise = this.passwordHasher.hash(
        "dummy-password-for-timing-mitigation-123"
      );
    }
    return this.dummyPasswordHashPromise;
  }
}
