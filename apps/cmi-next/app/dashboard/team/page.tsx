import { loadTeamMembers } from "@/lib/team/data";
import { TeamClient } from "./team-client";

export const metadata = { title: "Team — CMI Dashboard" };

export default async function TeamPage() {
  try {
    const members = await loadTeamMembers();
    return <TeamClient initialMembers={members} />;
  } catch {
    return <TeamClient initialMembers={[]} />;
  }
}
