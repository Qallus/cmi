import { AgentClient } from "./agent-client";

export const metadata = { title: "Agent — CMI Dashboard" };

export default function AgentPage() {
  const configured = Boolean(process.env.HERMES_AGENT_URL);
  return <AgentClient configured={configured} />;
}
