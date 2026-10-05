import { ApiError } from '../utils/ApiError.js';
import { fieldErrors } from '../../shared/schemas/common.js';

// Generic Zod request validator (Section 22 — input validation).
// Usage: router.post('/', validate(createJobSchema), controller.create)
//        router.get('/', validate(listQuerySchema, 'query'), controller.list)
// Responds 400 with `fields: { field: message }` so forms can show each error
// under its input.
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const fields = fieldErrors(result.error);
      const message = Object.values(fields).join(' · ');
      throw ApiError.badRequest(message, 'VALIDATION_ERROR', fields);
    }
    // Express 5 makes req.query a getter; assigning keeps Express 4 behaviour.
    if (source === 'query') Object.defineProperty(req, 'query', { value: result.data, writable: true });
    else req[source] = result.data;
    next();
  };
}
