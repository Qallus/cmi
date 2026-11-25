// An .ics calendar file for an invitation ("Add to calendar"). Pure.

function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escText(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines over 75 octets, as RFC 5545 asks. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(e: { id: string; title: string; start_time: string; end_time: string; location: string | null; summary?: string | null; url: string }, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Constructed Matter Inc//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@constructedmatter.com`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(e.start_time)}`,
    `DTEND:${stamp(e.end_time)}`,
    `SUMMARY:${escText(e.title)}`,
    ...(e.location ? [`LOCATION:${escText(e.location.split("\n").map((l) => l.trim()).filter(Boolean).join(", "))}`] : []),
    `DESCRIPTION:${escText([e.summary, `RSVP or change your answer: ${e.url}`].filter(Boolean).join("\n\n"))}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
