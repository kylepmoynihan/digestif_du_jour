export function isAllowedUser(userId: number): boolean {
  const allowedIds = process.env.ALLOWED_USER_IDS || "";
  if (!allowedIds) return true; // If not configured, allow all (for development)

  const ids = allowedIds.split(",").map((id) => parseInt(id.trim(), 10));
  return ids.includes(userId);
}
