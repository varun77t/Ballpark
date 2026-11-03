import type { RequestHandler } from 'express';
import type { ZodSchema, z } from 'zod';
import { badRequest } from '../lib/http';

type Part = 'body' | 'query' | 'params';

/** Validates and replaces req[part] with the parsed value (coercions and defaults applied). */
export function validate<S extends ZodSchema>(schema: S, part: Part = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const first = result.error.issues[0];
      const where = first?.path.length ? `${first.path.join('.')}: ` : '';
      return next(badRequest(`${where}${first?.message ?? 'Invalid input'}`, 'validation_error', result.error.flatten()));
    }
    if (part === 'query') {
      // req.query is a getter in some Express setups; store parsed values alongside instead.
      (req as unknown as { validQuery: z.infer<S> }).validQuery = result.data;
    } else {
      (req as unknown as Record<Part, unknown>)[part] = result.data;
    }
    next();
  };
}

export function validQuery<T>(req: unknown): T {
  return (req as { validQuery: T }).validQuery;
}
