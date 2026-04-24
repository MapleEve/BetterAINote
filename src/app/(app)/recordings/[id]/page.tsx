import { notFound } from "next/navigation";
import { RecordingWorkstation } from "@/components/recordings/recording-workstation";
import { requireAuth } from "@/lib/auth-server";
import { getRecordingDetailPageData } from "@/server/modules/recordings";

interface RecordingDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function RecordingDetailPage({
    params,
}: RecordingDetailPageProps) {
    const session = await requireAuth();
    const { id } = await params;
    const detail = await getRecordingDetailPageData(session.user.id, id);

    if (!detail) {
        notFound();
    }

    return (
        <RecordingWorkstation
            recording={detail.recording}
            transcription={detail.transcription}
            transcriptionJob={detail.transcriptionJob}
        />
    );
}
