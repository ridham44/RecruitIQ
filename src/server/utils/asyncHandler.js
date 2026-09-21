// Wraps async route handlers so rejected promises reach the centralized
// error middleware instead of requiring try/catch in every controller.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
