import { getFinalizedEntries } from "@/actions/ro-actions";
import FinalsList from "@/components/FinalsList";

export const dynamic = "force-dynamic";

export default async function FinalsPage() {
    const { data } = await getFinalizedEntries();

    return <FinalsList entries={data || []} />;
}
