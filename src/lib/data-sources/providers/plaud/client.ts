import { gunzipSync } from "node:zlib";
import type {
    PlaudApiError,
    PlaudDeviceListResponse,
    PlaudFileDetailData,
    PlaudFileDetailResponse,
    PlaudFileListResponse,
    PlaudRecordingsResponse,
    PlaudSummaryContent,
    PlaudTempUrlResponse,
    PlaudTranscriptSegment,
    PlaudTranssummResponse,
} from "@/types/plaud";
import { DEFAULT_SERVER_KEY, PLAUD_SERVERS } from "./servers";

export interface PlaudUpdateFilenameResponse {
    status: number;
    msg: string;
    data_file?: unknown;
}

export const DEFAULT_PLAUD_API_BASE = PLAUD_SERVERS[DEFAULT_SERVER_KEY].apiBase;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export function normalizePlaudBearerToken(rawToken: string): string {
    return rawToken
        .replace(/\r/g, "\n")
        .replace(/^\s*authorization\s*[:：]\s*/i, "")
        .replace(/^\s*bearer(?:\s|[:：])+/i, "")
        .replace(/\s+/g, "")
        .trim();
}

function isRetriablePlaudNetworkError(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    const cause = (error as Error & { cause?: unknown }).cause;
    const causeRecord =
        cause && typeof cause === "object"
            ? (cause as Record<string, unknown>)
            : {};
    const text = [
        error.name,
        error.message,
        typeof causeRecord.message === "string" ? causeRecord.message : "",
        typeof causeRecord.code === "string" ? causeRecord.code : "",
    ]
        .join(" ")
        .toLowerCase();

    return (
        (error instanceof TypeError && text.includes("fetch")) ||
        text.includes("socket connection was closed unexpectedly") ||
        text.includes("client network socket disconnected") ||
        text.includes("econnreset")
    );
}

function formatStoredTranscript(segments: PlaudTranscriptSegment[]): {
    text: string;
    segments: Array<{
        speaker: string;
        startMs: number;
        endMs: number;
        text: string;
    }>;
} {
    const sourceSegments = segments.map((segment, index) => ({
        ...segment,
        speaker:
            typeof segment.speaker === "string" && segment.speaker.trim()
                ? segment.speaker.trim()
                : `Speaker ${index + 1}`,
    }));
    const speakerOrder: string[] = [];
    for (const { speaker } of sourceSegments) {
        if (!speakerOrder.includes(speaker)) {
            speakerOrder.push(speaker);
        }
    }

    const isRaw = speakerOrder.some((speaker) => /^SPEAKER_\d+$/.test(speaker));
    const labelFor = (speaker: string) =>
        isRaw ? `Speaker ${speakerOrder.indexOf(speaker) + 1}` : speaker;

    const normalizedSegments = sourceSegments.map((segment) => ({
        speaker: labelFor(segment.speaker),
        startMs: segment.start_time,
        endMs: segment.end_time,
        text: segment.content.trim(),
    }));

    const turns: Array<{
        speaker: string;
        startMs: number;
        endMs: number;
        text: string;
    }> = [];

    for (const segment of normalizedSegments) {
        const last = turns.at(-1);
        if (last && last.speaker === segment.speaker) {
            last.text += ` ${segment.text}`;
            last.endMs = segment.endMs;
            continue;
        }

        turns.push({ ...segment });
    }

    return {
        text: turns
            .map(({ speaker, text }) => `${speaker}: ${text}`)
            .join("\n\n"),
        segments: normalizedSegments,
    };
}

function extractSummaryMarkdown(
    raw: PlaudSummaryContent | string | null,
): string | null {
    if (!raw) {
        return null;
    }

    let content: PlaudSummaryContent | null = null;
    if (typeof raw === "string") {
        try {
            content = JSON.parse(raw) as PlaudSummaryContent;
        } catch {
            return raw.trim().length > 0 ? raw : null;
        }
    } else {
        content = raw;
    }

    if (typeof content?.content === "string") {
        return content.content.trim().length > 0 ? content.content : null;
    }

    const markdown = content?.content?.markdown;
    return typeof markdown === "string" && markdown.trim().length > 0
        ? markdown
        : null;
}

function decodeMaybeGzippedText(buffer: Buffer): string {
    try {
        return gunzipSync(buffer).toString("utf8");
    } catch {
        return buffer.toString("utf8");
    }
}

async function fetchContentLinkText(url: string): Promise<string | null> {
    const response = await fetch(url);
    if (!response.ok) {
        return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const text = decodeMaybeGzippedText(buffer).trim();
    return text.length > 0 ? text : null;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Plaud service client.
 * Handles Plaud service requests.
 */
export class PlaudClient {
    private bearerToken: string;
    private apiBase: string;

    constructor(bearerToken: string, apiBase: string = DEFAULT_PLAUD_API_BASE) {
        this.bearerToken = normalizePlaudBearerToken(bearerToken);
        this.apiBase = apiBase;
    }

    /**
     * Make authenticated Plaud service requests with retry logic.
     */
    private async request<T>(
        endpoint: string,
        options?: RequestInit,
        retryCount = 0,
    ): Promise<T> {
        const url = `${this.apiBase}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options?.headers,
                    Authorization: `Bearer ${this.bearerToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (response.status === 429 && retryCount < MAX_RETRIES) {
                const retryAfter = response.headers.get("Retry-After");
                const delay = retryAfter
                    ? Number.parseInt(retryAfter, 10) * 1000
                    : INITIAL_RETRY_DELAY * 2 ** retryCount; // Exponential backoff
                await sleep(delay);
                return this.request<T>(endpoint, options, retryCount + 1);
            }

            if (!response.ok) {
                const error = (await response.json()) as PlaudApiError;
                const errorMessage = `Unable to connect to Plaud (${response.status}): ${error.msg || response.statusText}`;

                if (
                    response.status >= 500 &&
                    response.status < 600 &&
                    retryCount < MAX_RETRIES
                ) {
                    const delay = INITIAL_RETRY_DELAY * 2 ** retryCount;
                    await sleep(delay);
                    return this.request<T>(endpoint, options, retryCount + 1);
                }

                throw new Error(errorMessage);
            }

            return (await response.json()) as T;
        } catch (error) {
            if (
                isRetriablePlaudNetworkError(error) &&
                retryCount < MAX_RETRIES
            ) {
                const delay = INITIAL_RETRY_DELAY * 2 ** retryCount;
                await sleep(delay);
                return this.request<T>(endpoint, options, retryCount + 1);
            }

            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Unable to connect to Plaud: ${String(error)}`);
        }
    }

    /**
     * List all devices associated with the account
     */
    async listDevices(): Promise<PlaudDeviceListResponse> {
        return this.request<PlaudDeviceListResponse>("/device/list");
    }

    /**
     * Get all recordings
     * @param skip - Number of recordings to skip
     * @param limit - Maximum number of recordings to return
     * @param isTrash - Whether to get trashed recordings (0 = active, 1 = trash)
     * @param sortBy - Field to sort by (default: start_time)
     * @param isDesc - Sort in descending order (default: true)
     */
    async getRecordings(
        skip: number = 0,
        limit: number = 99999,
        isTrash: number = 0,
        sortBy: string = "start_time",
        isDesc: boolean = true,
    ): Promise<PlaudRecordingsResponse> {
        const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString(),
            is_trash: isTrash.toString(),
            sort_by: sortBy,
            is_desc: isDesc.toString(),
        });

        return this.request<PlaudRecordingsResponse>(
            `/file/simple/web?${params.toString()}`,
        );
    }

    /**
     * Get temporary URL for downloading audio file
     * @param fileId - The recording file ID
     * @param isOpus - Whether to get OPUS format URL (default: true)
     */
    async getTempUrl(
        fileId: string,
        isOpus: boolean = true,
    ): Promise<PlaudTempUrlResponse> {
        const params = new URLSearchParams({
            is_opus: isOpus ? "1" : "0",
        });

        return this.request<PlaudTempUrlResponse>(
            `/file/temp-url/${fileId}?${params.toString()}`,
        );
    }

    /**
     * Download audio file as buffer
     * @param fileId - The recording file ID
     * @param preferOpus - Whether to prefer OPUS format (smaller size)
     */
    async downloadRecording(
        fileId: string,
        preferOpus: boolean = true,
    ): Promise<Buffer> {
        try {
            const tempUrlResponse = await this.getTempUrl(fileId, preferOpus);
            const downloadUrl =
                preferOpus && tempUrlResponse.temp_url_opus
                    ? tempUrlResponse.temp_url_opus
                    : tempUrlResponse.temp_url;

            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(
                    `Failed to download file: ${response.statusText}`,
                );
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            throw new Error(
                `Failed to download recording: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Test connection to Plaud.
     * Returns true if bearer token is valid
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.listDevices();
            return response.status === 0;
        } catch {
            return false;
        }
    }

    /**
     * Fetch stored transcript text for a recording that has been transcribed on Plaud's servers.
     * Returns formatted text ("Speaker N: text" blocks) or null if no transcript is stored.
     * @param fileId - The recording file ID
     */
    async fetchTranscript(fileId: string): Promise<string | null> {
        const detail = await this.fetchTranscriptDetail(fileId);
        return detail?.text ?? null;
    }

    /**
     * Fetch stored transcript detail for a recording that has already been transcribed on Plaud.
     * Returns normalized text plus speaker segments with timing offsets.
     */
    async fetchTranscriptDetail(fileId: string): Promise<{
        text: string;
        segments: Array<{
            speaker: string;
            startMs: number;
            endMs: number;
            text: string;
        }>;
    } | null> {
        const response = await this.request<PlaudFileListResponse>(
            "/file/list",
            {
                method: "POST",
                body: JSON.stringify([fileId]),
            },
        );

        const file = response.data_file_list?.[0];
        if (!file?.trans_result?.length) return null;
        return formatStoredTranscript(file.trans_result);
    }

    async getFileDetail(fileId: string): Promise<PlaudFileDetailData> {
        const response = await this.request<PlaudFileDetailResponse>(
            `/file/detail/${fileId}`,
        );
        return response.data;
    }

    async getTranscriptAndSummary(
        fileId: string,
    ): Promise<PlaudTranssummResponse> {
        return this.request<PlaudTranssummResponse>(`/ai/transsumm/${fileId}`, {
            method: "POST",
            body: "{}",
        });
    }

    async fetchOfficialArtifacts(fileId: string): Promise<{
        transcript: {
            text: string;
            segments: Array<{
                speaker: string;
                startMs: number;
                endMs: number;
                text: string;
            }>;
        } | null;
        summaryMarkdown: string | null;
        detail: PlaudFileDetailData | null;
    }> {
        const transsumm = await this.getTranscriptAndSummary(fileId).catch(
            () => null,
        );

        let detail: PlaudFileDetailData | null = null;
        let transcript =
            transsumm?.data_result && transsumm.data_result.length > 0
                ? formatStoredTranscript(transsumm.data_result)
                : null;
        let summaryMarkdown = extractSummaryMarkdown(
            transsumm?.data_result_summ ?? null,
        );

        if (transcript && summaryMarkdown) {
            return { transcript, summaryMarkdown, detail };
        }

        detail = await this.getFileDetail(fileId).catch(() => null);
        if (!detail?.content_list?.length) {
            return { transcript, summaryMarkdown, detail };
        }

        if (!transcript) {
            const transactionItem = detail.content_list.find(
                (item) => item.data_type === "transaction" && !!item.data_link,
            );
            if (transactionItem?.data_link) {
                const transcriptText = await fetchContentLinkText(
                    transactionItem.data_link,
                );
                if (transcriptText) {
                    const parsed = JSON.parse(transcriptText) as
                        | PlaudTranscriptSegment[]
                        | Record<string, PlaudTranscriptSegment>;
                    const segments = Array.isArray(parsed)
                        ? parsed
                        : Object.values(parsed);
                    if (segments.length > 0) {
                        transcript = formatStoredTranscript(segments);
                    }
                }
            }
        }

        if (!summaryMarkdown) {
            const summaryItem = detail.content_list.find(
                (item) =>
                    item.data_type === "auto_sum_note" && !!item.data_link,
            );
            if (summaryItem?.data_link) {
                summaryMarkdown = await fetchContentLinkText(
                    summaryItem.data_link,
                );
            }
        }

        return {
            transcript,
            summaryMarkdown,
            detail,
        };
    }

    /**
     * Update filename for a recording
     * @param fileId - The recording file ID
     * @param filename - New filename to set
     */
    async updateFilename(
        fileId: string,
        filename: string,
    ): Promise<PlaudUpdateFilenameResponse> {
        return this.request<PlaudUpdateFilenameResponse>(`/file/${fileId}`, {
            method: "PATCH",
            body: JSON.stringify({ filename }),
        });
    }
}

/**
 * Create Plaud client from encrypted bearer token
 */
export async function createPlaudClient(
    encryptedToken: string,
    apiBase: string = DEFAULT_PLAUD_API_BASE,
): Promise<PlaudClient> {
    const { decrypt } = await import("@/lib/encryption");
    const bearerToken = decrypt(encryptedToken);
    return new PlaudClient(bearerToken, apiBase);
}

export * from "./types";
