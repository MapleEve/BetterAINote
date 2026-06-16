import { notFound } from "next/navigation";
import { RecordingWorkstation } from "@/features/recordings/workstation";
import { requireAuth } from "@/lib/auth-server";
import { getRecordingDetailPageData } from "@/server/modules/recordings";

export default async function RecordingPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await requireAuth();
    const { id } = await params;

    if (
        process.env.BETTERAINOTE_E2E_RECORDING_DETAIL_ERROR === "1" &&
        id === "e2e-row96-runtime-error"
    ) {
        throw new Error("E2E recording detail error boundary runtime visual");
    }

    const data = await getRecordingDetailPageData(session.user.id, id);

    if (!data?.recording) {
        notFound();
    }

    return <RecordingWorkstation {...data} />;
}
