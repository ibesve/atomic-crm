import type { Contact } from "../../types";

/**
 * Generate a deterministic color from a string (name/email).
 * Returns an HSL color with good contrast for white text.
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

/**
 * Generate a local SVG data-URI avatar with the contact's initials.
 * NO external requests — all data stays in-house.
 */
function generateInitialsAvatar(
  name: string,
  email: string,
): string {
  const initials = name
    ? name
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase())
        .slice(0, 2)
        .join("")
    : email.charAt(0).toUpperCase();

  const bg = stringToColor(email || name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="20" fill="${bg}"/>
    <text x="20" y="20" text-anchor="middle" dy=".35em" fill="white" font-family="system-ui,sans-serif" font-size="16" font-weight="600">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Main function to get the avatar URL
export async function getContactAvatar(
  record: Partial<Contact>,
): Promise<string | null> {
  if (!record.email_jsonb || !record.email_jsonb.length) {
    return null;
  }

  const firstEmail = record.email_jsonb[0]?.email;
  if (!firstEmail) {
    return null;
  }

  const displayName =
    [record.first_name, record.last_name].filter(Boolean).join(" ") || "";

  return generateInitialsAvatar(displayName, firstEmail);
}
