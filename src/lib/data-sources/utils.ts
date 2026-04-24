import { getAudioMimeType } from "@/lib/utils";
import type { SourceAudioArchivePlan, SourceRecordingData } from "./types";

export function toDateOrNull(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        const normalized = value > 10_000_000_000 ? value : value * 1000;
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value === "string" && value.trim()) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return toDateOrNull(numeric);
        }

        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
}

export function safeNumber(value: unknown, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

export function extractFileExtension(
    urlOrName: string | null | undefined,
    fallback = "mp3",
) {
    if (!urlOrName) {
        return fallback;
    }

    const match = urlOrName.match(/\.([a-z0-9]{2,5})(?:$|[?#])/i);
    return match?.[1]?.toLowerCase() ?? fallback;
}

function sanitizeSourceArchiveBaseName(filename: string, fallback: string) {
    const withoutExtension = filename.replace(/\.[^.]+$/, "");
    const sanitized = withoutExtension.replace(/[/\\:*?"<>|]/g, "-").trim();
    return sanitized || fallback;
}

function normalizeSourceAudioExtension(
    extension: string | null | undefined,
    fallback: string,
) {
    const normalized = extension?.trim().replace(/^\./, "").toLowerCase();
    return normalized || fallback;
}

export function buildSourceAudioArchivePlan(
    sourceRecording: Pick<
        SourceRecordingData,
        "filename" | "sourceRecordingId" | "audioDownload"
    >,
): SourceAudioArchivePlan | null {
    if (!sourceRecording.audioDownload?.url) {
        return null;
    }

    const fallbackExtension = extractFileExtension(
        sourceRecording.filename,
        extractFileExtension(sourceRecording.audioDownload.url, "mp3"),
    );
    const fileExtension = normalizeSourceAudioExtension(
        sourceRecording.audioDownload.fileExtension,
        fallbackExtension,
    );

    return {
        url: sourceRecording.audioDownload.url,
        headers: sourceRecording.audioDownload.headers,
        archiveBaseName: sanitizeSourceArchiveBaseName(
            sourceRecording.filename,
            sourceRecording.sourceRecordingId,
        ),
        fileExtension,
        contentType: getAudioMimeType(`audio.${fileExtension}`),
    };
}

function safeAudioRequestLabel(url: string) {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return "remote audio endpoint";
    }
}

export async function fetchBuffer(
    url: string,
    options?: {
        headers?: Record<string, string>;
        errorLabel?: string;
    },
) {
    const errorLabel = options?.errorLabel ?? "Failed to fetch source audio";

    try {
        const response = await fetch(url, {
            headers: options?.headers,
        });
        if (!response.ok) {
            throw new Error(
                `${errorLabel} (${response.status} ${response.statusText})`,
            );
        }

        return Buffer.from(await response.arrayBuffer());
    } catch (error) {
        if (error instanceof Error && error.message.startsWith(errorLabel)) {
            throw error;
        }

        throw new Error(
            `${errorLabel}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

export async function downloadSourceAudioBuffer(
    provider: string,
    archivePlan: Pick<SourceAudioArchivePlan, "url" | "headers">,
) {
    const requestLabel = safeAudioRequestLabel(archivePlan.url);

    return await fetchBuffer(archivePlan.url, {
        headers: archivePlan.headers,
        errorLabel: `[${provider}] Failed to download source audio from ${requestLabel}`,
    });
}

export function parseJsonString<T>(value: unknown, fallback: T): T {
    if (typeof value !== "string" || !value.trim()) {
        return fallback;
    }

    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}
