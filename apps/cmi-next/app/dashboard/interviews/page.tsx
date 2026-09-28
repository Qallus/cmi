// Interviews live as a tab inside Trade Partners. This keeps older links
// and bookmarks working.
import { redirect } from "next/navigation";

export default function InterviewsIndex() {
  redirect("/dashboard/trade-partners");
}
