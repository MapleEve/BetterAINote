import { Workstation } from "@/features/dashboard/workstation";
import { requireAuth } from "@/lib/auth-server";
import { getDashboardRecordingsPageData } from "@/server/modules/recordings";

export default async function DashboardPage() {
    const session = await requireAuth();
    const { recordings, transcriptions, transcriptionJobs } =
        await getDashboardRecordingsPageData(session.user.id);

    return (
        <Workstation
            recordings={recordings}
            transcriptions={transcriptions}
            transcriptionJobs={transcriptionJobs}
        />
    );
}
