import { Elysia } from "elysia";
import { AppError, type FieldError } from "../../../domain/errors/app-error";
import { errorResponse } from "../response";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractValidationFieldErrors(error: unknown): FieldError[] {
  if (!isRecord(error)) {
    return [];
  }

  const allErrors = error.all;
  if (!Array.isArray(allErrors)) {
    return [];
  }

  const fieldErrors: FieldError[] = [];

  for (const item of allErrors) {
    if (!isRecord(item)) {
      continue;
    }

    const rawPath = typeof item.path === "string" ? item.path : "";
    const field = rawPath.replace(/^\//, "").replace(/\//g, ".") || "body";
    const summary =
      typeof item.summary === "string" && item.summary.length > 0
        ? item.summary
        : typeof item.message === "string" && item.message.length > 0
          ? item.message
          : "Invalid value";

    fieldErrors.push({ field, message: summary });
  }

  return fieldErrors;
}

export const errorHandlerMiddleware = new Elysia({
  name: "error-handler",
}).onError({ as: "global" }, ({ code, error, set }) => {
  if (error instanceof AppError) {
    set.status = error.statusCode;
    return errorResponse(error.message, error.errors);
  }

  if (code === "VALIDATION") {
    set.status = 400;
    const fieldErrors = extractValidationFieldErrors(error);
    return errorResponse(
      "Validation failed",
      fieldErrors.length > 0 ? fieldErrors : undefined
    );
  }

  if (code === "PARSE") {
    set.status = 400;
    return errorResponse("Malformed request body");
  }

  if (code === "NOT_FOUND") {
    set.status = 404;
    return errorResponse("Endpoint not found");
  }

  set.status = 500;
  return errorResponse("Internal server error");
});
