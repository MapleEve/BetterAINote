import type {
    ResolvedSourceConnection,
    SourceRecordingData,
    SourceTranscriptSegment,
} from "@/lib/data-sources/types";
import { safeNumber, toDateOrNull } from "@/lib/data-sources/utils";

export const IFLYREC_DEFAULT_BASE_URL = "https://www.iflyrec.com";
const IFLYREC_BIZ_ID_HEADER = ["X", "Biz", "Id"].join("-");
const IFLYREC_SESSION_ID_HEADER = ["X", "Session", "Id"].join("-");

export function buildIflyrecHeaders(connection: ResolvedSourceConnection) {
    return {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        [IFLYREC_BIZ_ID_HEADER]:
            typeof connection.config.bizId === "string"
                ? connection.config.bizId
                : "tjzs",
        [IFLYREC_SESSION_ID_HEADER]: connection.secrets.sessionId ?? "",
    };
}

function getRecentOrdersUrl(baseUrl: string | null) {
    return `${baseUrl ?? IFLYREC_DEFAULT_BASE_URL}/XFTJWebAdaptService/v2/hjProcess/recentOperationFiles`;
}

function getTranscriptUrl(
    baseUrl: string | null,
    orderId: string,
    originAudioId: string,
) {
    return `${baseUrl ?? IFLYREC_DEFAULT_BASE_URL}/XFTJWebAdaptService/v1/hyjy/${encodeURIComponent(orderId)}/transcriptResults/16?fileSource=app&originAudioId=${encodeURIComponent(originAudioId)}`;
}

function parseTranscriptResult(payload: Record<string, unknown>) {
    const biz = payload.biz as Record<string, unknown> | undefined;
    const transcriptResult = biz?.transcriptResult;
    if (typeof transcriptResult !== "string" || !transcriptResult.trim()) {
        return [] as SourceTranscriptSegment[];
    }

    try {
        const parsed = JSON.parse(transcriptResult) as {
            ps?: Array<{
                pTime?: number[];
                role?: string;
                words?: Array<{
                    text?: string;
                    time?: number[];
                    rl?: string;
                }>;
            }>;
        };
        return (parsed.ps ?? [])
            .map((paragraph) => ({
                speaker: paragraph.role ?? "SPEAKER_00",
                startMs: safeNumber(paragraph.pTime?.[0], 0),
                endMs: safeNumber(paragraph.pTime?.[1], 0),
                text: (paragraph.words ?? [])
                    .map((word) => word.text ?? "")
                    .join("")
                    .trim(),
            }))
            .filter(
                (segment) =>
                    segment.text.length > 0 && segment.endMs >= segment.startMs,
            );
    } catch {
        return [];
    }
}

export function isIflyrecRecentOrdersPayload(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const payload = value as {
        biz?: {
            hjList?: unknown;
            hj_list?: unknown;
        };
    };
    return Boolean(
        payload.biz &&
            typeof payload.biz === "object" &&
            !Array.isArray(payload.biz) &&
            (Array.isArray(payload.biz.hjList) ||
                Array.isArray(payload.biz.hj_list)),
    );
}

function normalizeIflyrecText(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fetchJsonOrEmpty(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Record<string, unknown>> {
    try {
        const response = await fetch(input, init);
        if (!response.ok) {
            return {};
        }

        return (await response.json()) as Record<string, unknown>;
    } catch {
        return {};
    }
}

export class IflyrecClient {
    constructor(private readonly connection: ResolvedSourceConnection) {}

    async testConnection() {
        try {
            const response = await fetch(
                getRecentOrdersUrl(this.connection.baseUrl),
                {
                    method: "POST",
                    headers: buildIflyrecHeaders(this.connection),
                    body: "{}",
                },
            );
            if (!response.ok) {
                return false;
            }

            const payload = (await response.json()) as unknown;
            return isIflyrecRecentOrdersPayload(payload);
        } catch {
            return false;
        }
    }

    async listRecordings(): Promise<SourceRecordingData[]> {
        const recentResponse = await fetch(
            getRecentOrdersUrl(this.connection.baseUrl),
            {
                method: "POST",
                headers: buildIflyrecHeaders(this.connection),
                body: "{}",
            },
        );
        if (!recentResponse.ok) {
            throw new Error("Failed to fetch iflyrec recent orders");
        }

        const recentPayload = (await recentResponse.json()) as {
            biz?: {
                hjList?: Array<Record<string, unknown>>;
                hj_list?: Array<Record<string, unknown>>;
            };
        };
        const orders =
            recentPayload.biz?.hjList ?? recentPayload.biz?.hj_list ?? [];

        return Promise.all(
            orders
                .map((order) => {
                    const orderId = order.orderId ?? order.order_id;
                    const originAudioId =
                        order.originAudioId ?? order.origin_audio_id;
                    return typeof orderId === "string" &&
                        typeof originAudioId === "string"
                        ? { order, orderId, originAudioId }
                        : null;
                })
                .filter(
                    (
                        item,
                    ): item is {
                        order: Record<string, unknown>;
                        orderId: string;
                        originAudioId: string;
                    } => Boolean(item),
                )
                .map(async ({ order, orderId, originAudioId }) =>
                    this.buildRecording(order, orderId, originAudioId),
                ),
        );
    }

    private async buildRecording(
        order: Record<string, unknown>,
        orderId: string,
        originAudioId: string,
    ): Promise<SourceRecordingData> {
        const transcriptPayload = await fetchJsonOrEmpty(
            getTranscriptUrl(this.connection.baseUrl, orderId, originAudioId),
            {
                headers: buildIflyrecHeaders(this.connection),
            },
        );

        const transcriptSegments = parseTranscriptResult(transcriptPayload);
        const startTime =
            toDateOrNull(order.createTime ?? order.create_time) ?? new Date();
        const durationMs = safeNumber(
            order.audioDurations ?? order.audio_durations,
            0,
        );

        return {
            sourceProvider: "iflyrec",
            sourceRecordingId: orderId,
            filename: String(
                order.orderName ?? order.order_name ?? `iflyrec ${orderId}`,
            ),
            durationMs,
            startTime,
            endTime: new Date(startTime.getTime() + durationMs),
            filesize: safeNumber(order.hjSize ?? order.hj_size, 0),
            version:
                typeof order.lastOperateTime === "string" ||
                typeof order.lastOperateTime === "number"
                    ? String(order.lastOperateTime)
                    : typeof order.last_operate_time === "string" ||
                        typeof order.last_operate_time === "number"
                      ? String(order.last_operate_time)
                      : null,
            metadata: {
                order,
                transcriptPayload,
            },
            audioDownload: null,
            artifacts: {
                transcriptText: transcriptSegments
                    .map((segment) => `${segment.speaker}: ${segment.text}`)
                    .join("\n\n"),
                transcriptSegments,
                summaryMarkdown:
                    normalizeIflyrecText(order.fullTextAbstract) ??
                    normalizeIflyrecText(order.full_text_abstract),
                detailPayload: {
                    order,
                    transcriptPayload,
                },
            },
        };
    }
}
