import type { RecordingTag } from "@/lib/recording-tags";

export type Recording = {
    id: string;
    filename: string;
    duration: number;
    startTime: string;
    filesize: number;
    providerDeviceId: string;
    upstreamDeleted: boolean;
    sourceProvider: string;
    sourceRecordingId: string;
    audioUrl: string | null;
    hasAudio: boolean;
    tags: RecordingTag[];
};
