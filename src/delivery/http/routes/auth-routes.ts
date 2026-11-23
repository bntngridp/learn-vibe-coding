import { Elysia, t } from "elysia";
import type { ITokenService } from "../../../domain/ports/token-service";
import type { AuthUseCase } from "../../../usecases/auth-usecase";
import { createAuthMiddleware } from "../middlewares/auth-middleware";
import { successResponse } from "../response";

export interface AuthRoutesDeps {
  readonly authUseCase: AuthUseCase;
  readonly tokenService: ITokenService;
}

const registerBodySchema = t.Object(
  {
    name: t.String({
      minLength: 1,
      description: "Nama lengkap pengguna (2-120 karakter).",
      example: "New Demo User",
    }),
    email: t.String({
      minLength: 1,
      description:
        "Alamat email unik yang valid (otomatis di-lowercase dan di-trim).",
      example: "new.user@example.com",
    }),
    password: t.String({
      minLength: 1,
      description:
        "Password minimal 8 karakter, maksimal 72 byte, wajib mengandung minimal 1 huruf dan 1 angka.",
      example: "Password123",
    }),
  },
  {
    description: "Payload registrasi akun baru.",
    example: {
      name: "New Demo User",
      email: "new.user@example.com",
      password: "Password123",
    },
  }
);

const loginBodySchema = t.Object(
  {
    email: t.String({
      minLength: 1,
      description:
        "Email akun yang sudah terdaftar (dummy seed: bintang@example.com).",
      example: "bintang@example.com",
    }),
    password: t.String({
      minLength: 1,
      description: "Password akun (dummy seed: Password123).",
      example: "Password123",
    }),
  },
  {
    description: "Payload login menggunakan kredensial akun dummy siap pakai.",
    example: {
      email: "bintang@example.com",
      password: "Password123",
    },
  }
);

const SAMPLE_PUBLIC_USER = {
  id: 1,
  name: "Bintang Pribadi",
  email: "bintang@example.com",
  role: "admin",
  createdAt: "2026-11-23T13:00:00.000Z",
  updatedAt: "2026-11-23T13:00:00.000Z",
};

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJpbnRhbmdAZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJzdWIiOiIxIiwiaXNzIjoibGVhcm4tdmliZS1jb2RpbmciLCJpYXQiOjE3OTU1MDAwMDAsImV4cCI6MTc5NTU4NjQwMH0.signature";

/** Mendaftarkan seluruh endpoint autentikasi (/api/v1/auth/register, /login, dan /me). */
export function createAuthRoutes({ authUseCase, tokenService }: AuthRoutesDeps) {
  const authMiddleware = createAuthMiddleware(tokenService);

  // Endpoint terproteksi JWT untuk mengambil profil pengguna yang sedang login
  const protectedAuthRoutes = new Elysia().use(authMiddleware).get(
    "/me",
    async ({ authUser }) => {
      const user = await authUseCase.getCurrentUser(authUser.userId);
      return successResponse("Authenticated user retrieved successfully", {
        user,
      });
    },
    {
      detail: {
        tags: ["Authentication"],
        summary: "Ambil profil pengguna aktif",
        description:
          "Mengembalikan data profil pengguna berdasarkan Bearer JWT yang valid. Klik tombol Authorize di kanan atas terlebih dahulu dengan token dari /api/v1/auth/login.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Profil pengguna berhasil diambil.",
            content: {
              "application/json": {
                example: {
                  status: "success",
                  message: "Authenticated user retrieved successfully",
                  data: {
                    user: SAMPLE_PUBLIC_USER,
                  },
                },
              },
            },
          },
          "401": {
            description: "Header Authorization tidak ada, format salah, atau token tidak valid/kedaluwarsa.",
            content: {
              "application/json": {
                example: {
                  status: "error",
                  message: "Missing or invalid Authorization header",
                },
              },
            },
          },
        },
      },
    }
  );

  return new Elysia({ prefix: "/api/v1/auth" })
    // Endpoint publik untuk mendaftarkan akun pengguna baru
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
        type: "application/json",
        body: registerBodySchema,
        detail: {
          tags: ["Authentication"],
          summary: "Registrasi akun pengguna baru",
          description:
            "Mendaftarkan pengguna baru dengan hashing password bcrypt (cost 10) dan langsung mengembalikan accessToken JWT. Data dummy sudah terisi sehingga dapat langsung klik Execute.",
          responses: {
            "201": {
              description: "Akun berhasil didaftarkan.",
              content: {
                "application/json": {
                  example: {
                    status: "success",
                    message: "User registered successfully",
                    data: {
                      user: {
                        ...SAMPLE_PUBLIC_USER,
                        id: 3,
                        name: "New Demo User",
                        email: "new.user@example.com",
                        role: "user",
                      },
                      accessToken: SAMPLE_JWT,
                      tokenType: "Bearer",
                      expiresIn: "1d",
                    },
                  },
                },
              },
            },
            "400": {
              description: "Format JSON atau struktur payload tidak valid.",
              content: {
                "application/json": {
                  example: {
                    status: "error",
                    message: "Validation failed",
                    errors: [
                      { field: "email", message: "Expected string" },
                    ],
                  },
                },
              },
            },
            "409": {
              description: "Email sudah terdaftar di database.",
              content: {
                "application/json": {
                  example: {
                    status: "error",
                    message: "Email is already registered",
                    errors: [
                      {
                        field: "email",
                        message: "Email is already registered",
                      },
                    ],
                  },
                },
              },
            },
            "422": {
              description: "Data tidak memenuhi aturan validasi bisnis.",
              content: {
                "application/json": {
                  example: {
                    status: "error",
                    message: "Validation failed",
                    errors: [
                      {
                        field: "password",
                        message:
                          "Password must contain at least one letter and one number",
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      }
    )
    // Endpoint publik untuk login menggunakan email dan password
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
        type: "application/json",
        body: loginBodySchema,
        detail: {
          tags: ["Authentication"],
          summary: "Login pengguna dan dapatkan token JWT",
          description:
            "Memverifikasi email dan password menggunakan bcrypt lalu mengembalikan accessToken JWT. Data dummy default (bintang@example.com / Password123) sudah tersedia di database sehingga langsung dapat dijalankan.",
          responses: {
            "200": {
              description: "Login berhasil.",
              content: {
                "application/json": {
                  example: {
                    status: "success",
                    message: "Login successful",
                    data: {
                      user: SAMPLE_PUBLIC_USER,
                      accessToken: SAMPLE_JWT,
                      tokenType: "Bearer",
                      expiresIn: "1d",
                    },
                  },
                },
              },
            },
            "401": {
              description: "Email atau password tidak sesuai.",
              content: {
                "application/json": {
                  example: {
                    status: "error",
                    message: "Invalid email or password",
                  },
                },
              },
            },
            "422": {
              description: "Format email tidak valid atau password kosong.",
              content: {
                "application/json": {
                  example: {
                    status: "error",
                    message: "Validation failed",
                    errors: [
                      {
                        field: "email",
                        message: "Must be a valid email address",
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      }
    )
    .use(protectedAuthRoutes);
}
