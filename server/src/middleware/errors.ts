import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@ballpark/shared';
import { HttpError } from '../lib/http';
import { config } from '../config';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiError = { error: 'No such endpoint.', code: 'not_found' };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = { error: err.message, code: err.code, details: err.details };
    return res.status(err.status).json(body);
  }
  // Malformed JSON bodies from express.json()
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body.', code: 'bad_json' } satisfies ApiError);
  }
  if (!config.isTest) console.error(err);
  const body: ApiError = {
    error: config.isProd ? 'Something went wrong on our side.' : String(err?.message ?? err),
    code: 'internal_error',
  };
  res.status(500).json(body);
};
