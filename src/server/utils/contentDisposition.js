// Content-Disposition for a user-supplied file name. Node throws on header
// values with line breaks or non-Latin-1 characters, so send an ASCII-safe
// fallback plus the RFC 5987 UTF-8 form that browsers prefer.
export function contentDisposition(fileName, download) {
  const name = String(fileName || 'file').replace(/[\r\n"\\]/g, '').slice(0, 200) || 'file';
  const ascii = name.replace(/[^\x20-\x7E]/g, '_');
  return `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
