import type {
    Voiceprint,
    VoiceprintEnrollmentResult,
    VoiceTranscribeConnection,
    VoiceTranscribeExportFormat,
    VoiceTranscribeHistoryItem,
} from "./types";

const REQUEST_TIMEOUT_MS = 15_000;

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    return null;
}

function normalizeTimestamp(value: unknown): string | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        const date = new Date(value > 1_000_000_000_000 ? value : value * 1000);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    return normalizeString(value);
}

function getErrorMessage(data: unknown, fallback: string): string {
    if (typeof data === "string") {
        return data.trim() || fallback;
    }

    const record = asRecord(data);
    if (!record) {
        return fallback;
    }

    return (
        normalizeString(record.error) ??
        normalizeString(record.message) ??
        normalizeString(record.detail) ??
        fallback
    );
}

function extractVoiceprintCollection(data: unknown): unknown[] | null {
    if (Array.isArray(data)) {
        return data;
    }

    const record = asRecord(data);
    if (!record) {
        return null;
    }

    const directKeys = ["voiceprints", "items", "results", "data"];
    for (const key of directKeys) {
        const value = record[key];
        if (Array.isArray(value)) {
            return value;
        }

        const nested = asRecord(value);
        if (!nested) {
            continue;
        }

        for (const nestedKey of directKeys) {
            if (Array.isArray(nested[nestedKey])) {
                return nested[nestedKey] as unknown[];
            }
        }
    }

    return null;
}

function normalizeVoiceprint(value: unknown): Voiceprint | null {
    const record = asRecord(value);
    if (!record) {
        return null;
    }

    const id =
        normalizeString(record.id) ??
        normalizeString(record.voiceprintId) ??
        normalizeString(record.voiceprint_id) ??
        normalizeString(record.voiceprintRef) ??
        normalizeString(record.voiceprint_ref) ??
        normalizeString(record.ref);

    if (!id) {
        return null;
    }

    return {
        id,
        displayName:
            normalizeString(record.displayName) ??
            normalizeString(record.display_name) ??
            normalizeString(record.name) ??
            normalizeString(record.speakerName) ??
            normalizeString(record.speaker_name) ??
            normalizeString(record.label) ??
            id,
        sampleCount:
            normalizeNumber(record.sampleCount) ??
            normalizeNumber(record.sample_count),
        createdAt: normalizeTimestamp(record.createdAt ?? record.created_at),
        updatedAt: normalizeTimestamp(record.updatedAt ?? record.updated_at),
    };
}

function normalizeVoiceprintMutation(data: unknown): Voiceprint | null {
    const record = asRecord(data);
    if (!record) {
        return normalizeVoiceprint(data);
    }

    return (
        normalizeVoiceprint(record.voiceprint) ??
        normalizeVoiceprint(record.item) ??
        normalizeVoiceprint(record.result) ??
        normalizeVoiceprint(record.data) ??
        normalizeVoiceprint(data)
    );
}

function normalizeHistoryItem(
    value: unknown,
): VoiceTranscribeHistoryItem | null {
    const record = asRecord(value);
    if (!record) {
        return null;
    }

    const id = normalizeString(record.id);
    if (!id) {
        return null;
    }

    return {
        id,
        filename: normalizeString(record.filename),
        createdAt: normalizeTimestamp(record.created_at ?? record.createdAt),
        segmentCount: normalizeNumber(
            record.segment_count ?? record.segmentCount,
        ),
        speakerCount: normalizeNumber(
            record.speaker_count ?? record.speakerCount,
        ),
    };
}

async function parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

export class VoiceTranscribeHttpError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "VoiceTranscribeHttpError";
    }
}

export class VoiceTranscribeClient {
    constructor(private readonly connection: VoiceTranscribeConnection) {}

    async listVoiceprints(): Promise<Voiceprint[]> {
        const data = await this.request("/api/voiceprints", {
            method: "GET",
        });
        const collection = extractVoiceprintCollection(data);

        if (!collection) {
            throw new Error(
                "Voice-transcribe returned an unexpected voiceprint list payload",
            );
        }

        return collection
            .map((item) => normalizeVoiceprint(item))
            .filter((item): item is Voiceprint => item !== null);
    }

    async renameVoiceprint(id: string, displayName: string) {
        const formData = new FormData();
        formData.append("name", displayName);

        const data = await this.request(
            `/api/voiceprints/${encodeURIComponent(id)}/name`,
            {
                method: "PUT",
                body: formData,
            },
        );

        return (
            normalizeVoiceprintMutation(data) ?? {
                id,
                displayName,
                sampleCount: null,
                createdAt: null,
                updatedAt: null,
            }
        );
    }

    async deleteVoiceprint(id: string) {
        await this.request(`/api/voiceprints/${encodeURIComponent(id)}`, {
            method: "DELETE",
        });
    }

    async enrollVoiceprint(input: {
        transcriptionId: string;
        speakerLabel: string;
        speakerName: string;
        speakerId?: string | null;
    }): Promise<VoiceprintEnrollmentResult> {
        const formData = new FormData();
        formData.append("tr_id", input.transcriptionId);
        formData.append("speaker_label", input.speakerLabel);
        formData.append("speaker_name", input.speakerName);
        if (input.speakerId) {
            formData.append("speaker_id", input.speakerId);
        }

        const data = await this.request("/api/voiceprints/enroll", {
            method: "POST",
            body: formData,
        });
        const record = asRecord(data);
        const speakerId =
            normalizeString(record?.speaker_id) ??
            normalizeString(record?.speakerId);

        if (!speakerId) {
            throw new Error(
                "Voice-transcribe returned an unexpected enrollment payload",
            );
        }

        return {
            action:
                normalizeString(record?.action) ??
                normalizeString(record?.result) ??
                null,
            speakerId,
        };
    }

    async listTranscriptions(): Promise<VoiceTranscribeHistoryItem[]> {
        const data = await this.request("/api/transcriptions", {
            method: "GET",
        });

        if (!Array.isArray(data)) {
            throw new Error(
                "Voice-transcribe returned an unexpected transcription history payload",
            );
        }

        return data
            .map((item) => normalizeHistoryItem(item))
            .filter(
                (item): item is VoiceTranscribeHistoryItem => item !== null,
            );
    }

    async getTranscription(id: string) {
        return await this.request(
            `/api/transcriptions/${encodeURIComponent(id)}`,
            {
                method: "GET",
            },
        );
    }

    async updateSegmentSpeaker(input: {
        transcriptionId: string;
        segmentId: number;
        speakerName: string;
        speakerId?: string | null;
    }) {
        const formData = new FormData();
        formData.append("speaker_name", input.speakerName);
        if (input.speakerId) {
            formData.append("speaker_id", input.speakerId);
        }

        return await this.request(
            `/api/transcriptions/${encodeURIComponent(input.transcriptionId)}/segments/${input.segmentId}/speaker`,
            {
                method: "PUT",
                body: formData,
            },
        );
    }

    async rebuildVoiceprintCohort() {
        return await this.request("/api/voiceprints/rebuild-cohort", {
            method: "POST",
        });
    }

    async exportTranscription(
        id: string,
        format: VoiceTranscribeExportFormat,
    ): Promise<Blob> {
        const headers = new Headers();
        headers.set("Accept", "application/octet-stream");
        if (this.connection.apiKey) {
            headers.set("Authorization", `Bearer ${this.connection.apiKey}`);
            headers.set("X-API-Key", this.connection.apiKey);
        }

        const response = await fetch(
            `${this.connection.baseUrl.replace(/\/$/, "")}/api/export/${encodeURIComponent(id)}?format=${format}`,
            {
                method: "GET",
                headers,
                cache: "no-store",
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            },
        );

        if (!response.ok) {
            const data = await parseResponseBody(response);
            throw new VoiceTranscribeHttpError(
                getErrorMessage(
                    data,
                    `Voice-transcribe export failed with status ${response.status}`,
                ),
                response.status,
            );
        }

        return await response.blob();
    }

    private async request(path: string, init: RequestInit) {
        const headers = new Headers(init.headers);
        headers.set("Accept", "application/json");

        if (this.connection.apiKey) {
            headers.set("Authorization", `Bearer ${this.connection.apiKey}`);
            headers.set("X-API-Key", this.connection.apiKey);
        }

        if (init.body !== undefined && !(init.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(
            `${this.connection.baseUrl.replace(/\/$/, "")}${path}`,
            {
                ...init,
                headers,
                cache: "no-store",
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            },
        );

        const data = await parseResponseBody(response);
        if (!response.ok) {
            throw new VoiceTranscribeHttpError(
                getErrorMessage(
                    data,
                    `Voice-transcribe request failed with status ${response.status}`,
                ),
                response.status,
            );
        }

        return data;
    }
}
