import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { TmdbApiError, TmdbConfigurationError, TmdbTimeoutError } from "@/lib/tmdb/service";

export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Dados invalidos.") {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Autenticacao necessaria.") {
    super(message, "AUTHENTICATION_ERROR", 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Acesso negado.") {
    super(message, "AUTHORIZATION_ERROR", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso nao encontrado.") {
    super(message, "NOT_FOUND", 404);
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Erro ao acessar o banco de dados.") {
    super(message, "DATABASE_ERROR", 500);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = "Erro ao contatar um servico externo.") {
    super(message, "EXTERNAL_SERVICE_ERROR", 502);
  }
}

export type ErrorEnvelope = { code: string; status: number };

/**
 * Central mapping from "whatever was thrown" to a safe, consistent HTTP
 * response. Never forwards `error.stack` or raw driver/library messages to the
 * client — those only ever go to the server-side logger (see lib/http/api-handler.ts).
 */
export function toErrorResponse(error: unknown): { response: NextResponse; envelope: ErrorEnvelope } {
  if (error instanceof AppError) {
    return {
      response: NextResponse.json({ error: error.code, message: error.message }, { status: error.status }),
      envelope: { code: error.code, status: error.status }
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) {
    return {
      response: NextResponse.json({ error: "DATABASE_ERROR", message: "Erro ao acessar o banco de dados." }, { status: 500 }),
      envelope: { code: "DATABASE_ERROR", status: 500 }
    };
  }

  if (error instanceof TmdbConfigurationError || error instanceof TmdbTimeoutError || error instanceof TmdbApiError) {
    return {
      response: NextResponse.json({ error: "EXTERNAL_SERVICE_ERROR", message: "Erro ao contatar um servico externo." }, { status: 502 }),
      envelope: { code: "EXTERNAL_SERVICE_ERROR", status: 502 }
    };
  }

  return {
    response: NextResponse.json({ error: "INTERNAL_ERROR", message: "Erro interno inesperado." }, { status: 500 }),
    envelope: { code: "INTERNAL_ERROR", status: 500 }
  };
}
