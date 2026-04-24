import type { StorageProvider } from "./types";

interface ResolveRecordingArchiveKeyParams {
    userId: string;
    provider: string;
    archiveBaseName: string;
    fileExtension: string;
    sourceRecordingId: string;
    isStorageKeyTaken: (storageKey: string) => Promise<boolean>;
}

function buildArchiveCandidateKey(
    params: Pick<
        ResolveRecordingArchiveKeyParams,
        "userId" | "provider" | "archiveBaseName" | "fileExtension"
    >,
    suffix = "",
) {
    return `${params.userId}/${params.provider}/${params.archiveBaseName}${suffix}.${params.fileExtension}`;
}

export async function resolveUniqueRecordingArchiveKey(
    params: ResolveRecordingArchiveKeyParams,
) {
    for (let index = 0; index < 100; index += 1) {
        const suffix = index === 0 ? "" : ` (${index + 1})`;
        const storageKey = buildArchiveCandidateKey(params, suffix);
        if (!(await params.isStorageKeyTaken(storageKey))) {
            return storageKey;
        }
    }

    return `${params.userId}/${params.provider}/${params.sourceRecordingId}.${params.fileExtension}`;
}

interface UploadArchivedRecordingAudioParams {
    storage: StorageProvider;
    storageKey: string;
    audioBuffer: Buffer;
    contentType: string;
    archiveLabel: string;
}

export async function uploadArchivedRecordingAudio(
    params: UploadArchivedRecordingAudioParams,
) {
    try {
        await params.storage.uploadFile(
            params.storageKey,
            params.audioBuffer,
            params.contentType,
        );
        return params.storageKey;
    } catch (error) {
        throw new Error(
            `Failed to archive ${params.archiveLabel}: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}
