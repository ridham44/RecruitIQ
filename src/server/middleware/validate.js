import { ApiError } from '../utils/ApiError.js';

// Generic Zod request validator (Section 22 — input validation).
// Usage: router.post('/', validate(createJobSchema), controller.create)
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || source}: ${issue.message}`)
        .join('; ');
      throw ApiError.badRequest(message, 'VALIDATION_ERROR');
    }
    req[source] = result.data;
    next();
  };
}
