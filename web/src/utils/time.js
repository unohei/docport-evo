export function fmt(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleString();
}

export function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}
