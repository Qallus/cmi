import { loadUsersData } from "@/lib/users/data";
import { getDemoUsersData } from "@/lib/users/demo-data";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  try {
    const data = await loadUsersData();
    return <UsersClient initialData={data} demoMode={false} />;
  } catch (error) {
    return <UsersClient initialData={getDemoUsersData()} demoMode={true} setupMessage={error instanceof Error ? error.message : "User management is running in demo mode."} />;
  }
}
