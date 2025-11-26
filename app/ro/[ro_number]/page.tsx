import { getRO, getScannedParts } from "@/actions/ro-actions";
import RODetails from "@/components/RODetails";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ROPage({ params }: { params: Promise<{ ro_number: string }> }) {
    const { ro_number } = await params;
    const roRes = await getRO(ro_number);

    if (roRes.error || !roRes.data) {
        notFound();
    }

    const partsRes = await getScannedParts(roRes.data.id);

    return <RODetails ro={roRes.data} initialParts={partsRes.data || []} />;
}
