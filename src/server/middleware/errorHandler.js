import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: 'ROUTE_NOT_FOUND',
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      error: err.code,
    });
  }

  // Never leak stack traces / internals to the client in production
  // (Section 23), but keep them in server logs for debugging.
  console.error('[unhandled error]', err);

  res.status(500).json({
    success: false,
    message: isProduction ? 'Something went wrong' : err.message,
    error: 'INTERNAL_ERROR',
  });
}
