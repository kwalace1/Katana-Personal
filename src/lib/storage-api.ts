/** Local-only documents helpers. Cloud storage intentionally omitted. */

export function validateLocalUpload(file: File, maxBytes = 4 * 1024 * 1024): { valid: boolean; error?: string } {
  if (file.size === 0) return { valid: false, error: 'File is empty' }
  if (file.size > maxBytes) {
    return { valid: false, error: `File exceeds ${(maxBytes / (1024 * 1024)).toFixed(0)}MB local limit` }
  }
  return { valid: true }
}
