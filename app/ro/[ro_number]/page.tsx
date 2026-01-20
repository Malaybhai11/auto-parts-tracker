import RODetails from "@/components/RODetails";

export default async function ROPage({ params }: { params: Promise<{ ro_number: string }> }) {
    const { ro_number } = await params;

    return (
        <main className="min-h-screen bg-background">
            <RODetails roNumber={ro_number} />
        </main>
    );
}
