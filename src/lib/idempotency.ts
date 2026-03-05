export function generateIdempotencyKey(): string {
  // crypto.randomUUID() is available in all modern browsers and Node 19+
  // Fallback for older environments
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}