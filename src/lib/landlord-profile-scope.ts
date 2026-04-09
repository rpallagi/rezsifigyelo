export const LANDLORD_PROFILE_SCOPE_COOKIE = "rezsi-landlord-profile-scope";

function uniqueNumbers(values: number[]) {
  return [...new Set(values)];
}

export function parseLandlordProfileScopeValue(
  value: string | null | undefined,
): number[] | null {
  if (!value || value === "all") {
    return null;
  }

  const ids = uniqueNumbers(
    value
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((id) => Number.isFinite(id) && id > 0),
  );

  return ids.length > 0 ? ids : null;
}

export function serializeLandlordProfileScope(
  profileIds: number[] | null | undefined,
): string {
  return profileIds && profileIds.length > 0 ? uniqueNumbers(profileIds).join(",") : "all";
}

export function normalizeLandlordProfileScope(
  profileIds: number[] | null | undefined,
  availableProfileIds: number[],
): number[] | null {
  if (!profileIds || profileIds.length === 0) {
    return null;
  }

  const availableIds = new Set(availableProfileIds);
  const normalized = uniqueNumbers(profileIds).filter((id) => availableIds.has(id));

  if (
    normalized.length === 0 ||
    normalized.length === availableProfileIds.length
  ) {
    return null;
  }

  return normalized;
}

export function getCookieValue(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${name}=`;

  for (const cookie of cookieHeader.split(";")) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }

  return null;
}

export function parseLandlordProfileScopeFromHeader(
  cookieHeader: string | null | undefined,
) {
  return parseLandlordProfileScopeValue(
    getCookieValue(cookieHeader, LANDLORD_PROFILE_SCOPE_COOKIE),
  );
}
