# learn-vibe-coding

Backend REST API built with Bun, ElysiaJS, Drizzle ORM, and MySQL using Clean Architecture.

## Project Structure

```text
src/
├── index.ts                              # Application entry point & graceful shutdown
├── app.ts                                # Dependency injection & Elysia app factory
├── config/
│   └── env.ts                            # Environment configuration validation
├── domain/
│   ├── entities/user.ts                  # Pure domain entities & PublicUser mapper
│   ├── errors/app-error.ts               # Typed domain errors
│   └── ports/                            # Repository, PasswordHasher, TokenService contracts
├── infrastructure/
│   ├── database/                         # MySQL pool & Drizzle schema
│   ├── repositories/                     # Drizzle repository implementations
│   └── security/                         # bcrypt password hasher & HS256 JWT service
├── usecases/                             # Business logic & semantic validation
└── delivery/http/                        # Thin routes, middlewares, response envelopes
```

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Set `DATABASE_URL` (for local DBngin MySQL: `mysql://root:@127.0.0.1:3306/learn_vibe_coding`) and a strong random `JWT_SECRET` (minimum 32 characters).

3. Run database migrations:
   ```bash
   bun run db:migrate
   ```

4. Start the development server:
   ```bash
   bun run dev
   ```

## Scripts

- `bun run dev` — Start development server with watch mode
- `bun run start` — Start production server
- `bun test` — Run unit and integration test suite
- `bun run db:generate` — Generate Drizzle SQL migrations from schema
- `bun run db:migrate` — Apply pending Drizzle migrations to MySQL
- `bun run db:push` — Push schema directly to MySQL

## API Endpoints

### Health Check
- `GET /health` — Verifies service and MySQL database connectivity.

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register a new user (`201 Created`).
  - Body: `{ "name": "Bintang", "email": "bintang@example.com", "password": "Password123" }`
- `POST /api/v1/auth/login` — Authenticate with email and password (`200 OK`).
  - Body: `{ "email": "bintang@example.com", "password": "Password123" }`
- `GET /api/v1/auth/me` — Retrieve authenticated user profile (`Authorization: Bearer <token>`).

### Users (`/api/v1/users`)
- `GET /api/v1/users?page=1&per_page=10` — Paginated user list (requires `Authorization: Bearer <token>`).
