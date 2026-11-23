# learn-vibe-coding

## 1. Tentang Aplikasi

`learn-vibe-coding` adalah aplikasi **Backend REST API** yang dibangun menggunakan **Bun**, **ElysiaJS**, **Drizzle ORM**, **MySQL (`mysql2`)**, dan **TypeScript (`strict: true`)**.

Project ini menerapkan **Clean Architecture** dengan pemisahan tanggung jawab antar lapisan secara tegas sehingga mudah dikembangkan, diuji (*unit test* dan *integration test*), dan dirawat.

### Fitur Utama Saat Ini
- **Autentikasi Pengguna (`/api/v1/auth`)**:
  - Registrasi akun baru (`POST /api/v1/auth/register`) dengan validasi input, normalisasi email (trim & lowercase), dan pencegahan duplikasi email (`409 Conflict`).
  - Login pengguna (`POST /api/v1/auth/login`) menggunakan email dan password dengan penerbitan token **JWT (`HS256`)**.
  - Pengambilan profil pengguna yang sedang terautentikasi (`GET /api/v1/auth/me`) tanpa mengekspos `passwordHash`.
- **Manajemen Pengguna (`/api/v1/users`)**:
  - Daftar pengguna terpaginasi (`GET /api/v1/users?page=1&per_page=10`) yang dilindungi middleware autentikasi Bearer JWT.
- **Health Check (`/health`)**:
  - Pemeriksaan status server serta konektivitas aktif ke database MySQL.
- **Dokumentasi API Interaktif (`/swagger` & `/swagger/json`)**:
  - Swagger UI berbasis `@elysiajs/swagger` (OpenAPI 3.0.3) lengkap dengan tombol **Authorize** (Bearer JWT), mode **Try it out** aktif otomatis, contoh payload dummy siap klik, serta seeder akun dummy (`bun run db:seed`).
- **Standar Keamanan**:
  - Hashing password menggunakan **`bcrypt`** (`cost: 10`) melalui API native `Bun.password`, disertai batas maksimal 72 byte untuk mencegah pemotongan karakter diam-diam (*silent truncation*).
  - Mitigasi *timing-based user enumeration* saat login pada email yang tidak terdaftar.
  - Security HTTP headers otomatis pada seluruh respons (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`).
  - Error handling terpusat dengan format respons konsisten tanpa membocorkan stack trace maupun error mentah dari database.

---

## 2. Arsitektur Kode

Aplikasi ini menerapkan **Clean Architecture** dengan arah dependensi satu arah (*one-directional dependency flow*):

```text
Delivery (HTTP) ---> Use Cases ---> Domain (Entities, Errors, Ports)
                                         ^
                                         | (implements)
                    Infrastructure (Database, Repositories, Security)
```

### Penjelasan Setiap Layer

1. **Domain (`src/domain/`)**
   - Lapisan paling inti yang berisi aturan model dan kontrak bisnis murni.
   - Berisi entitas (`User`, `PublicUser`), kelas error terstruktur (`AppError`, `ValidationError`, `UnauthorizedError`, `ConflictError`, `NotFoundError`, `BadRequestError`, `ForbiddenError`), serta kontrak antarmuka/ports (`IUserRepository`, `IPasswordHasher`, `ITokenService`).
   - **Aturan:** Tidak boleh meng-import kode dari layer lain, framework HTTP, maupun library database.

2. **Use Cases (`src/usecases/`)**
   - Menampung seluruh logika bisnis dan validasi semantik (`AuthUseCase`, `UserUseCase`).
   - Berkomunikasi dengan database, password hasher, dan layanan JWT **hanya melalui interface (ports)** dari layer Domain.
   - **Aturan:** Tidak mengetahui detail HTTP (status code, header, Elysia) maupun query SQL.

3. **Infrastructure (`src/infrastructure/`)**
   - Menyediakan implementasi teknis/konkret terhadap kontrak Domain:
     - `database/`: koneksi pool `mysql2` dan definisi skema Drizzle ORM (`schema.ts`).
     - `repositories/`: implementasi operasi baca/tulis database (`DrizzleUserRepository`) tanpa logika bisnis.
     - `security/`: implementasi hashing password `bcrypt` (`BunPasswordHasher`) dan penandatanganan/verifikasi JWT `HS256` (`JwtTokenService` menggunakan `jose`).

4. **Delivery (`src/delivery/http/`)**
   - Lapisan antarmuka HTTP menggunakan ElysiaJS yang bersifat tipis (*thin controller*).
   - Hanya bertugas mem-parsing request, menjalankan middleware (auth, security headers, error mapping), memanggil Use Case, dan mengembalikan respons dalam format envelope yang seragam.

5. **Config & Bootstrap (`src/config/`, `src/app.ts`, `src/index.ts`)**
   - `src/config/env.ts`: memuat dan memvalidasi environment variables sejak awal aplikasi berjalan.
   - `src/app.ts`: factory perakitan Dependency Injection (`createApp`) agar aplikasi dapat diuji langsung melalui `app.handle(Request)` tanpa perlu membuka port jaringan.
   - `src/index.ts`: titik masuk server yang merakit seluruh dependensi konkret, membuka port HTTP, dan menangani *graceful shutdown* (`SIGINT` / `SIGTERM`).

### Alur Permintaan (Request Flow)

```text
Client Request
  -> securityHeadersMiddleware (set HTTP security headers)
  -> Route Handler (validasi bentuk request body/query)
  -> [Opsional] authMiddleware (verifikasi Bearer JWT untuk route terproteksi)
  -> UseCase (validasi bisnis, hashing/verifikasi password, pembuatan token)
  -> Repository (query MySQL via Drizzle ORM)
  -> Response Envelope (JSON sukses) / errorHandlerMiddleware (mapping AppError -> HTTP status)
```

---

## 3. Struktur Folder

```text
learn-vibe-coding/
├── drizzle/                                      # File migrasi SQL & metadata Drizzle Kit
│   ├── 0000_foamy_quicksilver.sql                # Migrasi awal pembuatan tabel users
│   └── meta/                                     # Snapshot & journal migrasi Drizzle
├── src/
│   ├── index.ts                                  # Entry point server & graceful shutdown
│   ├── app.ts                                    # Factory aplikasi Elysia & Dependency Injection
│   ├── config/
│   │   └── env.ts                                # Loader & validator environment variables
│   ├── domain/
│   │   ├── entities/
│   │   │   └── user.ts                           # Entitas User, PublicUser, & mapper toPublicUser
│   │   ├── errors/
│   │   │   └── app-error.ts                      # Hierarki error domain (400, 401, 403, 404, 409, 422)
│   │   └── ports/
│   │       ├── password-hasher.ts                # Kontrak IPasswordHasher
│   │       ├── token-service.ts                  # Kontrak ITokenService & AuthTokenPayload
│   │       └── user-repository.ts                # Kontrak IUserRepository & tipe paginasi
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── index.ts                          # Factory pool mysql2 & instance Drizzle ORM
│   │   │   ├── schema.ts                         # Definisi skema tabel MySQL (users)
│   │   │   └── seed.ts                           # Seeder akun dummy idempoten untuk uji Swagger
│   │   ├── repositories/
│   │   │   └── drizzle-user-repository.ts        # Implementasi IUserRepository berbasis Drizzle
│   │   └── security/
│   │       ├── bun-password-hasher.ts            # Implementasi IPasswordHasher berbasis Bun bcrypt
│   │       └── jwt-token-service.ts              # Implementasi ITokenService berbasis jose (HS256)
│   ├── usecases/
│   │   ├── auth-usecase.ts                       # Logika bisnis register, login, & getCurrentUser
│   │   └── user-usecase.ts                       # Logika bisnis listUsers dengan paginasi
│   └── delivery/
│       └── http/
│           ├── response.ts                       # Helper response envelope (success, paginated, error)
│           ├── swagger.ts                        # Konfigurasi Swagger UI & OpenAPI 3.0.3
│           ├── middlewares/
│           │   ├── auth-middleware.ts            # Validasi header Authorization: Bearer <token>
│           │   ├── error-handler.ts              # Mapping error terpusat ke status HTTP & JSON
│           │   └── security-headers.ts           # Penambahan header keamanan HTTP global
│           └── routes/
│               ├── auth-routes.ts                # Endpoint /api/v1/auth/*
│               └── user-routes.ts                # Endpoint /api/v1/users/*
├── tests/
│   ├── auth.unit.test.ts                         # Unit test HTTP & UseCase (in-memory repository)
│   ├── auth.integration.test.ts                  # Integration test end-to-end ke MySQL lokal
│   └── swagger.test.ts                           # Pengujian endpoint Swagger UI & spec OpenAPI JSON
├── .env.example                                  # Template konfigurasi environment variables
├── .gitignore                                    # Daftar file yang dikecualikan dari Git (termasuk .env)
├── bun.lock                                      # Lockfile dependensi Bun
├── drizzle.config.ts                             # Konfigurasi Drizzle Kit (schema, out, dialect)
├── package.json                                  # Metadata project, dependencies, dan scripts
├── README.md                                     # Dokumentasi project
└── tsconfig.json                                 # Konfigurasi TypeScript (strict mode, bundler)
```

---

## 4. Konvensi Penamaan File & Kode

Agar struktur codebase tetap konsisten saat project berkembang, seluruh file dan simbol mengikuti aturan penamaan berikut:

### Penamaan File & Folder
- **Folder dan file TypeScript:** gunakan `kebab-case` (huruf kecil dipisahkan tanda hubung).
- **Akhiran (suffix) berdasarkan peran:**
  - `*-usecase.ts` — kelas logika bisnis (contoh: `auth-usecase.ts`, `user-usecase.ts`).
  - `*-repository.ts` — kontrak atau implementasi akses data (contoh: `user-repository.ts`, `drizzle-user-repository.ts`).
  - `*-routes.ts` — definisi route/handler HTTP (contoh: `auth-routes.ts`, `user-routes.ts`).
  - `*-middleware.ts` — middleware HTTP (contoh: `auth-middleware.ts`).
  - `*-service.ts` / `*-hasher.ts` — layanan infrastruktur/keamanan (contoh: `jwt-token-service.ts`, `bun-password-hasher.ts`).
  - `*.unit.test.ts` — pengujian terisolasi tanpa ketergantungan database eksternal.
  - `*.integration.test.ts` — pengujian terintegrasi terhadap database MySQL.

### Penamaan Simbol Kode
- **Class, Interface, Type:** `PascalCase` (contoh: `AuthUseCase`, `PublicUser`, `ConflictError`).
- **Kontrak Port (Interface Dependency):** diawali huruf `I` + `PascalCase` (contoh: `IUserRepository`, `IPasswordHasher`, `ITokenService`).
- **Fungsi, Method, Variabel:** `camelCase` (contoh: `loadConfig`, `toPublicUser`, `signAccessToken`).
- **Konstanta Global & Environment Variables:** `UPPER_SNAKE_CASE` (contoh: `MIN_PASSWORD_LENGTH`, `DATABASE_URL`, `JWT_SECRET`).

### Penamaan Database & API
- **Tabel & Kolom MySQL:** `snake_case` (contoh: tabel `users`, kolom `password_hash`, `created_at`, `updated_at`), lalu dipetakan ke properti `camelCase` di TypeScript melalui Drizzle.
- **URL Endpoint API:** huruf kecil, dipisahkan tanda hubung, menggunakan kata benda dan versi API (contoh: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/users`).

---

## 5. Cara Install & Menjalankan

### Prasyarat
- **Bun** `>= 1.0` (teruji pada Bun `1.3.14`)
- **MySQL 8.x** berjalan di lokal (misalnya melalui **DBngin** pada port `3306`)

### Langkah Instalasi

1. **Clone repository dan pindah ke direktori project:**
   ```bash
   git clone git@github.com-bintangridwan30:bntngridp/learn-vibe-coding.git
   cd learn-vibe-coding
   ```

2. **Install seluruh dependensi:**
   ```bash
   bun install
   ```

3. **Buat database baru di MySQL lokal (contoh melalui DBngin MySQL 8.0.33):**
   ```bash
   /Users/Shared/DBngin/mysql/8.0.33/bin/mysql -h 127.0.0.1 -P 3306 -u root \
     -e "CREATE DATABASE IF NOT EXISTS learn_vibe_coding CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

4. **Salin template environment dan sesuaikan nilai `.env`:**
   ```bash
   cp .env.example .env
   ```
   Generate secret acak untuk `JWT_SECRET` (minimal 32 karakter):
   ```bash
   openssl rand -hex 32
   ```

   Daftar variabel di `.env`:

   | Variabel | Wajib | Contoh Nilai | Keterangan |
   | :--- | :--- | :--- | :--- |
   | `DATABASE_URL` | Ya | `mysql://root:@127.0.0.1:3306/learn_vibe_coding` | Connection string MySQL |
   | `PORT` | Tidak | `3000` | Port HTTP server (default: `3000`) |
   | `JWT_SECRET` | Ya | `<64-char-hex-random>` | Kunci penandatanganan JWT HS256 (min. 32 karakter) |
   | `JWT_EXPIRES_IN` | Tidak | `1d` | Masa berlaku access token (default: `1d`) |
   | `JWT_ISSUER` | Tidak | `learn-vibe-coding` | Nilai claim `iss` pada JWT |

5. **Jalankan migrasi database dan isi data dummy (opsional untuk uji cepat Swagger):**
   ```bash
   bun run db:migrate
   bun run db:seed
   ```

6. **Jalankan server development:**
   ```bash
   bun run dev
   ```
   - Server API aktif di `http://localhost:3000`
   - Swagger UI interaktif aktif di `http://localhost:3000/swagger`
   - Spesifikasi OpenAPI JSON tersedia di `http://localhost:3000/swagger/json`

7. **Jalankan pengecekan tipe dan automated test:**
   ```bash
   bun x tsc --noEmit
   bun test
   ```

---

## 6. Daftar Script (`package.json`)

| Perintah | Fungsi |
| :--- | :--- |
| `bun run dev` | Menjalankan server development dengan watch mode |
| `bun run start` | Menjalankan server dalam mode normal |
| `bun test` | Menjalankan seluruh unit test dan integration test |
| `bun run db:generate` | Membuat file migrasi SQL baru dari perubahan `schema.ts` |
| `bun run db:migrate` | Menerapkan migrasi SQL ke database MySQL |
| `bun run db:push` | Menyinkronkan skema langsung ke database tanpa file migrasi |
| `bun run db:seed` | Mengisi akun dummy awal (`bintang@example.com` & `demo.user@example.com`) secara idempoten |
| `bun run db:studio` | Membuka Drizzle Studio untuk inspeksi database |

---

## 7. Skema Database (`users`)

| Kolom | Tipe MySQL | Constraint / Default |
| :--- | :--- | :--- |
| `id` | `bigint unsigned` | `PRIMARY KEY`, `AUTO_INCREMENT`, `NOT NULL` |
| `name` | `varchar(120)` | `NOT NULL` |
| `email` | `varchar(255)` | `UNIQUE`, `NOT NULL` |
| `password_hash` | `varchar(255)` | `NOT NULL` (hash `bcrypt`) |
| `role` | `varchar(32)` | `NOT NULL`, `DEFAULT 'user'` |
| `created_at` | `timestamp` | `NOT NULL`, `DEFAULT now()` |
| `updated_at` | `timestamp` | `NOT NULL`, `DEFAULT now() ON UPDATE CURRENT_TIMESTAMP` |

---

## 8. Dokumentasi Endpoint API

### Format Respons Standar

**Sukses:**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {}
}
```

**Sukses dengan Paginasi:**
```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "data": [],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

**Error:**
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address"
    }
  ]
}
```

### Daftar Endpoint

| Method | Endpoint | Auth | Status Code | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Publik | `200`, `503` | Cek status aplikasi dan koneksi MySQL |
| `POST` | `/api/v1/auth/register` | Publik | `201`, `400`, `409`, `422` | Registrasi akun baru |
| `POST` | `/api/v1/auth/login` | Publik | `200`, `400`, `401`, `422` | Login dan mendapatkan JWT Bearer token |
| `GET` | `/api/v1/auth/me` | Bearer JWT | `200`, `401` | Mengambil profil pengguna yang sedang login |
| `GET` | `/api/v1/users` | Bearer JWT | `200`, `401`, `422` | Daftar pengguna dengan `?page=1&per_page=10` |

### Contoh Penggunaan (`curl`)

```bash
# 1. Registrasi akun baru
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Bintang","email":"bintang@example.com","password":"Password123"}'

# 2. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bintang@example.com","password":"Password123"}'

# 3. Akses profil pengguna terautentikasi
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# 4. Ambil daftar pengguna (terpaginasi)
curl "http://localhost:3000/api/v1/users?page=1&per_page=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```
