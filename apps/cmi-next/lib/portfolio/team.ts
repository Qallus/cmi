import type { PortfolioItem, PortfolioParticipant } from "./types";

// Project team credits in display order: Architect, Interior Designer, then
// the additional participants (only when the item's toggle is on).
export function portfolioTeam(item: Pick<PortfolioItem, "architect" | "interior_designer" | "show_participants" | "participants">): PortfolioParticipant[] {
  const team: PortfolioParticipant[] = [];
  if (item.architect) team.push({ role: "Architect", name: item.architect });
  if (item.interior_designer) team.push({ role: "Interior Designer", name: item.interior_designer });
  if (item.show_participants) {
    for (const participant of item.participants || []) {
      if (participant?.role && participant?.name) team.push(participant);
    }
  }
  return team;
}
