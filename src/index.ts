import { createApp } from "./app";
import { loadConfig } from "./config/env";
import { createDatabase } from "./infrastructure/database";
import { DrizzleUserRepository } from "./infrastructure/repositories/drizzle-user-repository";
import { BunPasswordHasher } from "./infrastructure/security/bun-password-hasher";
import { JwtTokenService } from "./infrastructure/security/jwt-token-service";
import { AuthUseCase } from "./usecases/auth-usecase";
import { UserUseCase } from "./usecases/user-usecase";

const config = loadConfig();
const database = createDatabase(config.databaseUrl);
const userRepository = new DrizzleUserRepository(database.db);
const passwordHasher = new BunPasswordHasher();
const tokenService = new JwtTokenService({
  secret: config.jwtSecret,
  expiresIn: config.jwtExpiresIn,
  issuer: config.jwtIssuer,
});

const authUseCase = new AuthUseCase(
  userRepository,
  passwordHasher,
  tokenService
);
const userUseCase = new UserUseCase(userRepository);

const app = createApp({
  authUseCase,
  userUseCase,
  tokenService,
  checkDatabaseConnection: () => database.checkConnection(),
}).listen(config.port);

console.log(
  `Elysia server is running at http://${app.server?.hostname}:${app.server?.port}`
);

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await app.stop();
  await database.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
