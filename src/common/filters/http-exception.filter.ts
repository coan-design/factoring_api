import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErroDeCampo } from '../utils/validation.util';

interface CorpoDeExcecao {
  message?: string | string[];
  errors?: ErroDeCampo[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException ? exception.getResponse() : null;
    const corpo: CorpoDeExcecao | null =
      body && typeof body === 'object' ? (body as CorpoDeExcecao) : null;

    const message =
      corpo?.message ?? (isHttpException ? exception.message : 'Erro interno do servidor');

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      // Presente somente quando a excecao veio do ValidationPipe (400 de DTO invalido).
      ...(corpo?.errors ? { errors: corpo.errors } : {}),
    });
  }
}
