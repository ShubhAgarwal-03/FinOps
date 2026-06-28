import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(422).json({ error: 'Validation failed', errors });
      return;
    }
    req.body = result.data;
    next();
  };
}

// Add at the bottom of validate.ts
export const validateBody = (schema: ZodSchema) => validate(schema);
export const validateQuery = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = (result.error as ZodError).issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(422).json({ error: 'Validation failed', errors });
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };