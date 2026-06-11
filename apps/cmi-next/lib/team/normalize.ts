import type { TeamMember } from "./types";

export type TeamAttributeDetail = {
  title: string;
  description?: string;
};

type TeamMeta = {
  _cmiTeamDetails?: boolean;
  nickname?: string;
  linkedin_url?: string;
  attributes_json?: TeamAttributeDetail[];
  schedule?: string;
};

function extractLeadingJson(value: string | null | undefined): { meta: TeamMeta | null; text: string | null } {
  const text = value?.trim();
  if (!text || !text.startsWith("{")) return { meta: null, text: value ?? null };

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      const json = text.slice(0, index + 1);
      const remainder = text.slice(index + 1).trim();

      try {
        const parsed = JSON.parse(json) as TeamMeta;
        if (parsed && typeof parsed === "object" && parsed._cmiTeamDetails) {
          return { meta: parsed, text: remainder || null };
        }
      } catch {
        return { meta: null, text: value ?? null };
      }
      break;
    }
  }

  return { meta: null, text: value ?? null };
}

function cleanText(value: string | null | undefined) {
  const { text } = extractLeadingJson(value);
  return text && text.trim() ? text.trim() : null;
}

function readMeta(member: TeamMember): TeamMeta | null {
  const fields = [member.tagline, member.bio, member.availability];
  for (const field of fields) {
    const { meta } = extractLeadingJson(field);
    if (meta) return meta;
  }
  return null;
}

export function getTeamAttributeDetails(member: TeamMember): TeamAttributeDetail[] {
  const meta = readMeta(member);
  if (Array.isArray(meta?.attributes_json)) {
    return meta.attributes_json
      .map(item => ({
        title: String(item.title || "").trim(),
        description: item.description ? String(item.description).trim() : undefined
      }))
      .filter(item => item.title);
  }

  return (member.attributes ?? [])
    .map(attribute => ({ title: String(attribute).trim() }))
    .filter(item => item.title);
}

export function normalizeTeamMember(member: TeamMember): TeamMember {
  const meta = readMeta(member);
  const attributeDetails = getTeamAttributeDetails(member);

  return {
    ...member,
    tagline: cleanText(member.tagline),
    bio: cleanText(member.bio),
    availability: cleanText(member.availability) || meta?.schedule || null,
    attributes: attributeDetails.map(item => item.title),
  };
}

export function mergeTeamMemberWithFallback(member: TeamMember, fallback?: TeamMember): TeamMember {
  const normalized = normalizeTeamMember(member);
  if (!fallback) return normalized;

  return {
    ...fallback,
    ...normalized,
    tagline: normalized.tagline || fallback.tagline,
    bio: normalized.bio || fallback.bio,
    email: normalized.email || fallback.email,
    phone: normalized.phone || fallback.phone,
    profile_photo: normalized.profile_photo || fallback.profile_photo,
    secondary_photo: normalized.secondary_photo || fallback.secondary_photo,
    attributes: normalized.attributes?.length ? normalized.attributes : fallback.attributes,
    availability: normalized.availability || fallback.availability,
  };
}
