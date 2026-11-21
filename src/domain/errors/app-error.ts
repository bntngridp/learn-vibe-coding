export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors?: readonly FieldError[];

  constructor(
    message: string,
    statusCode: number,
    errors?: readonly FieldError[]
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", errors?: readonly FieldError[]) {
    super(message, 400, errors);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", errors?: readonly FieldError[]) {
    super(message, 422, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", errors?: readonly FieldError[]) {
    super(message, 409, errors);
  }
}
