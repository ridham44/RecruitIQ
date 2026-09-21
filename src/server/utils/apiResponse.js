// Consistent API response envelope (Section 23).
export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function created(res, data = {}) {
  return ok(res, data, 201);
}

export function fail(res, { status = 400, message = 'Request failed', error = 'BAD_REQUEST' } = {}) {
  return res.status(status).json({ success: false, message, error });
}
