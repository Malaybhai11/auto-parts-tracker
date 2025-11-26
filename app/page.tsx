import Dashboard from "@/components/Dashboard";
import { createServiceClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createServiceClient();

  const { data: recentROs } = await supabase
    .from("ro")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  return <Dashboard recentROs={recentROs || []} />;
}
