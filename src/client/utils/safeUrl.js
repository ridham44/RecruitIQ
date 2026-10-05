// Returns the URL only if it is http(s); anything else (javascript:, data:…)
// becomes null so it is never rendered as a clickable link or image source.
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
