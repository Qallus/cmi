import { notFound, redirect } from "next/navigation";
import { getSessionStaff } from "@/lib/auth/server-session";
import { canUseBolt } from "@/lib/agent/access";
import { AgentClient } from "./agent-client";

export const metadata = { title: "AI Agents — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function AgentPage() {
  // This page had no server-side guard at all: the sidebar hid it from most
  // roles, but anyone who typed the URL got the full Bolt UI. notFound() to
  // match how the reporting and prequalification pages refuse — a 404 doesn't
  // confirm the page exists to someone who shouldn't see it.
  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  if (!canUseBolt(staff.role_slug)) notFound();

  const configured = Boolean(process.env.HERMES_AGENT_URL);
  return <AgentClient configured={configured} />;
}
