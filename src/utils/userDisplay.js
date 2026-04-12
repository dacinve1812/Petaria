export function getDisplayName(userLike, fallback = 'Unknown') {
  if (!userLike) return fallback;

  const displayName = userLike.display_name || userLike.displayName;
  const username = userLike.username || userLike.user_name;

  const normalizedDisplay = typeof displayName === 'string' ? displayName.trim() : '';
  if (normalizedDisplay) return normalizedDisplay;

  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (normalizedUsername) return normalizedUsername;

  return fallback;
}
