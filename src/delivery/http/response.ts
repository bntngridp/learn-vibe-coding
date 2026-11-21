import type { FieldError } from "../../domain/errors/app-error";

export interface PaginationMeta {
  readonly page: number;
  readonly per_page: number;
  readonly total: number;
  readonly total_pages: number;
}

export interface SuccessEnvelope<T> {
  readonly status: "success";
  readonly message: string;
  readonly data: T;
}

export interface PaginatedEnvelope<T> {
  readonly status: "success";
  readonly message: string;
  readonly data: readonly T[];
  readonly meta: PaginationMeta;
}

export interface ErrorEnvelope {
  readonly status: "error";
  readonly message: string;
  readonly errors?: readonly FieldError[];
}

export function successResponse<T>(
  message: string,
  data: T
): SuccessEnvelope<T> {
  return {
    status: "success",
    message,
    data,
  };
}

export function paginatedResponse<T>(
  message: string,
  data: readonly T[],
  meta: PaginationMeta
): PaginatedEnvelope<T> {
  return {
    status: "success",
    message,
    data,
    meta,
  };
}

export function errorResponse(
  message: string,
  errors?: readonly FieldError[]
): ErrorEnvelope {
  if (errors && errors.length > 0) {
    return {
      status: "error",
      message,
      errors,
    };
  }
  return {
    status: "error",
    message,
  };
}
