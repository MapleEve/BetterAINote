import type {
    ResolvedSourceConnection,
    SourceConnectionTestResult,
    SourceRecordingData,
    SourceTranscriptSegment,
} from "@/lib/data-sources/types";
import {
    extractFileExtension,
    safeNumber,
    toDateOrNull,
} from "@/lib/data-sources/utils";

const DINGTALK_CONVERSATION_LIST_PATH = "/ai/tingji/getConversationList";
const DINGTALK_MINUTES_DETAIL_PATH = "/api/v1/webShare/minutesDetailV2";
const DINGTALK_AGENT_TOKEN_HEADER = ["dt", "meeting", "agent", "token"].join(
    "-",
);

export function buildDingTalkHeaders(connection: ResolvedSourceConnection) {
    const headers: Record<string, string> = {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Origin: "https://shanji.dingtalk.com",
        Referer: "https://shanji.dingtalk.com/",
    };

    if (connection.authMode === "agent-token") {
        headers[DINGTALK_AGENT_TOKEN_HEADER] =
            connection.secrets.agentToken ?? "";
    }

    if (connection.authMode === "cookie" && connection.secrets.cookie) {
        headers.Cookie = connection.secrets.cookie;
    }

    return headers;
}

type DingTalkConversation = Record<string, unknown>;

function getConversationList(payload: Record<string, unknown>) {
    const data = payload.data as Record<string, unknown> | undefined;
    const candidates = [
        payload.conversations,
        payload.items,
        payload.list,
        data?.conversations,
        data?.items,
        data?.list,
        data?.data,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate as DingTalkConversation[];
        }
    }

    return [];
}

export function hasDingTalkConversationListPayload(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const payload = value as Record<string, unknown>;
    const data = payload.data as Record<string, unknown> | undefined;
    return [
        payload.conversations,
        payload.items,
        payload.list,
        data?.conversations,
        data?.items,
        data?.list,
        data?.data,
    ].some((candidate) => Array.isArray(candidate));
}

export function hasDingTalkMinutesDetailPayload(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const payload = value as Record<string, unknown>;
    const data =
        payload.data &&
        typeof payload.data === "object" &&
        !Array.isArray(payload.data)
            ? (payload.data as Record<string, unknown>)
            : null;

    return (
        "paragraphs" in payload ||
        "minutesInfo" in payload ||
        "meetingInfo" in payload ||
        "transcript" in payload ||
        "summary" in payload ||
        (data !== null &&
            ("paragraphs" in data ||
                "minutesInfo" in data ||
                "meetingInfo" in data ||
                "transcript" in data ||
                "summary" in data))
    );
}

export function buildMissingDingTalkSecretMessage() {
    return "请填写钉钉闪记登录信息。";
}

export function buildRejectedDingTalkSessionMessage(
    _connection: ResolvedSourceConnection,
    status: number,
) {
    void _connection;
    void status;
    return "连接失败，请重新填写钉钉闪记登录信息。";
}

export function buildInvalidDingTalkSessionPayloadMessage() {
    return "钉钉闪记连接失败，请重新填写登录信息。";
}

export function buildMinutesDetailEvidenceMessage(detail: string) {
    void detail;
    return "钉钉闪记连接成功，录音详情将在导入时继续处理。";
}

function normalizeDingTalkText(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectTranscriptSegments(
    value: unknown,
    results: SourceTranscriptSegment[],
) {
    if (!value) {
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectTranscriptSegments(item, results);
        }
        return;
    }

    if (typeof value !== "object") {
        return;
    }

    const candidate = value as Record<string, unknown>;
    const text =
        typeof candidate.text === "string"
            ? candidate.text.trim()
            : typeof candidate.content === "string"
              ? candidate.content.trim()
              : null;
    const startMs = safeNumber(
        candidate.startMs ??
            candidate.start_time ??
            candidate.start ??
            candidate.beginTime,
        NaN,
    );
    const endMs = safeNumber(
        candidate.endMs ??
            candidate.end_time ??
            candidate.end ??
            candidate.endTime,
        NaN,
    );

    if (
        text &&
        Number.isFinite(startMs) &&
        Number.isFinite(endMs) &&
        endMs >= startMs
    ) {
        results.push({
            speaker:
                typeof candidate.speaker === "string"
                    ? candidate.speaker
                    : typeof candidate.speakerName === "string"
                      ? candidate.speakerName
                      : "SPEAKER_00",
            startMs,
            endMs,
            text,
        });
    }

    for (const nested of Object.values(candidate)) {
        if (nested && typeof nested === "object") {
            collectTranscriptSegments(nested, results);
        }
    }
}

async function fetchJsonOrNull(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<unknown> {
    const response = await fetch(input, init);
    if (!response.ok) {
        return null;
    }

    return response.json();
}

export class DingTalkA1Client {
    constructor(private readonly connection: ResolvedSourceConnection) {}

    async testConnection(): Promise<SourceConnectionTestResult> {
        const signInInfo =
            this.connection.authMode === "cookie"
                ? this.connection.secrets.cookie?.trim()
                : this.connection.secrets.agentToken?.trim();
        if (!signInInfo) {
            return {
                ok: false,
                code: "missing-secret",
                message: buildMissingDingTalkSecretMessage(),
            };
        }

        try {
            const response = await fetch(
                `${this.connection.baseUrl}${DINGTALK_CONVERSATION_LIST_PATH}`,
                {
                    method: "POST",
                    headers: buildDingTalkHeaders(this.connection),
                    body: JSON.stringify({ scene: "" }),
                },
            );
            if (!response.ok) {
                return {
                    ok: false,
                    code: "http-error",
                    message: buildRejectedDingTalkSessionMessage(
                        this.connection,
                        response.status,
                    ),
                };
            }

            let payload: unknown;
            try {
                payload = (await response.json()) as unknown;
            } catch {
                return {
                    ok: false,
                    code: "invalid-session-payload",
                    message: buildInvalidDingTalkSessionPayloadMessage(),
                };
            }

            if (!hasDingTalkConversationListPayload(payload)) {
                return {
                    ok: false,
                    code: "invalid-session-payload",
                    message: buildInvalidDingTalkSessionPayloadMessage(),
                };
            }

            return {
                ok: true,
                code: "conversation-list-only",
                message: "钉钉闪记连接成功，录音详情将在导入时继续处理。",
            };
        } catch {
            return {
                ok: false,
                code: "request-failed",
                message: "钉钉闪记连接失败，请重新填写登录信息。",
            };
        }
    }

    async listRecordings(): Promise<SourceRecordingData[]> {
        const headers = buildDingTalkHeaders(this.connection);
        const listResponse = await fetch(
            `${this.connection.baseUrl}${DINGTALK_CONVERSATION_LIST_PATH}`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({ scene: "" }),
            },
        );
        if (!listResponse.ok) {
            throw new Error("Failed to fetch DingTalk A1 conversations");
        }

        const payload = (await listResponse.json()) as Record<string, unknown>;
        const conversations = getConversationList(payload);

        return Promise.all(
            conversations
                .map((conversation) => {
                    const uuid =
                        conversation.uuid ??
                        conversation.taskUuid ??
                        conversation.task_uuid;
                    return typeof uuid === "string"
                        ? { uuid, conversation }
                        : null;
                })
                .filter(
                    (
                        entry,
                    ): entry is {
                        uuid: string;
                        conversation: Record<string, unknown>;
                    } => Boolean(entry),
                )
                .map(async ({ uuid, conversation }) =>
                    this.buildRecording(uuid, conversation, headers),
                ),
        );
    }

    private async buildRecording(
        uuid: string,
        conversation: Record<string, unknown>,
        headers: Record<string, string>,
    ): Promise<SourceRecordingData> {
        const [detailPayload, playInfoPayload, meetingBriefPayload] =
            await Promise.all([
                fetchJsonOrNull(
                    `${this.connection.baseUrl}${DINGTALK_MINUTES_DETAIL_PATH}?uuid=${encodeURIComponent(uuid)}`,
                    { headers },
                ).then((payload) => payload ?? {}),
                fetchJsonOrNull(
                    `${this.connection.baseUrl}/api/v1/webShare/queryPlayInfo`,
                    {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ taskUuid: uuid }),
                    },
                ).then((payload) => payload ?? {}),
                fetchJsonOrNull(
                    `${this.connection.baseUrl}/api/v1/webShare/queryMeetingBrief`,
                    {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ taskUuid: uuid }),
                    },
                ).then((payload) => payload ?? {}),
            ]);

        const transcriptSegments: SourceTranscriptSegment[] = [];
        collectTranscriptSegments(detailPayload, transcriptSegments);

        const startTime =
            toDateOrNull(
                conversation.startTime ??
                    conversation.gmtCreate ??
                    conversation.createTime,
            ) ?? new Date();
        const durationMs = safeNumber(
            conversation.duration ??
                conversation.audioDuration ??
                conversation.durationMs,
            0,
        );

        const playInfo =
            (playInfoPayload as { playInfo?: Record<string, unknown> })
                .playInfo ?? {};
        const avList = Array.isArray(
            (playInfoPayload as { avList?: unknown }).avList,
        )
            ? (playInfoPayload as { avList: Array<Record<string, unknown>> })
                  .avList
            : [];
        const audioUrl =
            (typeof playInfo.pcAudioUrl === "string"
                ? playInfo.pcAudioUrl
                : null) ??
            (typeof avList[0]?.fileUrl === "string"
                ? String(avList[0].fileUrl)
                : null);

        const summaryText = normalizeDingTalkText(
            (meetingBriefPayload as { fullTextSummary?: unknown })
                .fullTextSummary,
        );

        return {
            sourceProvider: "dingtalk-a1",
            sourceRecordingId: uuid,
            filename: String(
                conversation.title ??
                    conversation.subject ??
                    `DingTalk ${uuid}`,
            ),
            durationMs,
            startTime,
            endTime: new Date(startTime.getTime() + durationMs),
            filesize: null,
            version:
                typeof conversation.updateTime === "string" ||
                typeof conversation.updateTime === "number"
                    ? String(conversation.updateTime)
                    : null,
            metadata: {
                conversation,
            },
            audioDownload: audioUrl
                ? {
                      url: audioUrl,
                      fileExtension: extractFileExtension(audioUrl, "mp3"),
                  }
                : null,
            artifacts: {
                transcriptText: transcriptSegments
                    .map((segment) => `${segment.speaker}: ${segment.text}`)
                    .join("\n\n"),
                transcriptSegments,
                summaryMarkdown: summaryText,
                detailPayload: {
                    detail: detailPayload as Record<string, unknown>,
                    playInfo: playInfoPayload as Record<string, unknown>,
                    meetingBrief: meetingBriefPayload as Record<
                        string,
                        unknown
                    >,
                },
            },
        };
    }
}
