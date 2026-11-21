export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  readonly jwtIssuer: string;
}

const MIN_JWT_SECRET_LENGTH = 32;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const rawPort = process.env.PORT?.trim() || "3000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT environment variable: ${rawPort}`);
  }

  const databaseUrl = requireEnv("DATABASE_URL");
  const jwtSecret = requireEnv("JWT_SECRET");

  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`
    );
  }

  const jwtExpiresIn = process.env.JWT_EXPIRES_IN?.trim() || "1d";
  const jwtIssuer = process.env.JWT_ISSUER?.trim() || "learn-vibe-coding";

  return {
    port,
    databaseUrl,
    jwtSecret,
    jwtExpiresIn,
    jwtIssuer,
  };
}
