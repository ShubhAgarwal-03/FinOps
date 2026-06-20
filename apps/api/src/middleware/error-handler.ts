import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[error]', err);

  // Prisma known request errors
  if (err.code === 'P2002') {
    res.status(409).json({ error: 'A record with this value already exists.' });
    return;
  }
  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Record not found.' });
    return;
  }

  const status = err.statusCode ?? 500;
  res.status(status).json({
    error: err.message ?? 'Internal server error',
  });
}