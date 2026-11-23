import { swagger } from "@elysiajs/swagger";

/**
 * Factory plugin dokumentasi OpenAPI 3.0 dan Swagger UI interaktif (/swagger dan /swagger/json).
 * Dibuat sebagai factory agar setiap instance aplikasi mendapatkan Response object baru.
 */
export function createSwaggerPlugin() {
  return swagger({
  provider: "swagger-ui",
  path: "/swagger",
  specPath: "/swagger/json",
  exclude: ["/swagger", "/swagger/json"],
  documentation: {
    info: {
      title: "learn-vibe-coding API",
      version: "1.0.50",
      description: [
        "Dokumentasi REST API interaktif untuk project **learn-vibe-coding** (Bun + ElysiaJS + Drizzle ORM + MySQL).",
        "",
        "### Akun Dummy Siap Pakai (Hasil `bun run db:seed`)",
        "- **Admin:** `bintang@example.com` / `Password123`",
        "- **User:** `demo.user@example.com` / `Password123`",
        "",
        "### Cara Pengujian Cepat di Swagger UI",
        "1. Jalankan **POST `/api/v1/auth/login`** (data dummy sudah terisi otomatis) atau **POST `/api/v1/auth/register`**.",
        "2. Salin nilai `data.accessToken` dari response JSON.",
        "3. Klik tombol **Authorize** di kanan atas, tempel token JWT tersebut (tanpa awalan `Bearer `), lalu klik **Authorize**.",
        "4. Uji endpoint terproteksi seperti **GET `/api/v1/auth/me`** dan **GET `/api/v1/users`**.",
      ].join("\n"),
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local Development Server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Pengecekan status server dan koneksi database MySQL.",
      },
      {
        name: "Authentication",
        description:
          "Registrasi akun baru, login menggunakan JWT HS256, dan profil pengguna aktif.",
      },
      {
        name: "Users",
        description:
          "Manajemen daftar pengguna terpaginasi (memerlukan Bearer JWT).",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Token JWT dari endpoint /api/v1/auth/login atau /api/v1/auth/register.",
        },
      },
    },
  },
  swaggerOptions: {
    persistAuthorization: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    docExpansion: "list",
    defaultModelsExpandDepth: 2,
    filter: true,
  },
  });
}
