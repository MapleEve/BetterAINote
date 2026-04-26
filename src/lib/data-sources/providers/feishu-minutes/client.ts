import type { ResolvedSourceConnection } from "@/lib/data-sources/types";
import {
    extractFileExtension,
    safeNumber,
    toDateOrNull,
} from "@/lib/data-sources/utils";

const FEISHU_API_OK = 0;
const FEISHU_SPACE_NAME_PARAM = ["space", "name"].join("_");

export const FEISHU_DEFAULT_BASE_URL = "https://open.feishu.cn";
export const FEISHU_WEB_DEFAULT_BASE_URL = "https://meetings.feishu.cn";

export interface FeishuMinutesRecordingSnapshot {
    recordingId: string;
    title: string;
    durationMs: number;
    startTime: Date;
    version: string | null;
    metadata: {
        meeting: Record<string, unknown>;
        recording: Record<string, unknown>;
        minute: Record<string, unknown>;
    };
    audioUrl: string | null;
    audioExtension: string;
    transcriptText: string | null;
    summaryMarkdown: string | null;
    detailPayload: {
        meeting: Record<string, unknown>;
        recording: Record<string, unknown>;
        minute: Record<string, unknown>;
        artifacts: Record<string, unknown>;
        minuteToken: string | null;
    };
}

export function resolveFeishuApiBase(baseUrl: string | null) {
    if (!baseUrl) {
        return FEISHU_DEFAULT_BASE_URL;
    }

    if (baseUrl.includes("meetings.feishu.cn")) {
        return FEISHU_DEFAULT_BASE_URL;
    }

    return baseUrl.replace(/\/$/, "");
}

export function resolveFeishuWebBase(_baseUrl: string | null) {
    return FEISHU_WEB_DEFAULT_BASE_URL;
}

export function getFeishuUserAccessToken(connection: ResolvedSourceConnection) {
    const token = connection.secrets.userAccessToken?.trim();
    if (!token) {
        throw new Error(
            "Feishu Minutes access-token mode requires a saved access token.",
        );
    }
    return token;
}

function getFeishuWebCookie(connection: ResolvedSourceConnection) {
    const cookie = connection.secrets.webCookie?.trim();
    if (!cookie) {
        throw new Error(
            "Feishu Minutes web sign-in mode requires saved browser session details.",
        );
    }
    return cookie;
}

function getFeishuWebSpaceName(connection: ResolvedSourceConnection) {
    const spaceName = connection.config.spaceName;
    return typeof spaceName === "string" && spaceName.trim()
        ? spaceName.trim()
        : "cn";
}

function isFeishuMeetingSearchData(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const data = value as Record<string, unknown>;
    return Array.isArray(data.items) || Array.isArray(data.meetings);
}

function normalizeFeishuText(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractMinuteToken(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }

    const match = value.match(/\/minutes\/([^/?#]+)/);
    return match?.[1] ?? null;
}

interface FeishuApiEnvelope {
    code?: number;
    msg?: string;
    data?: Record<string, unknown>;
}

export class FeishuMinutesClient {
    private readonly baseUrl: string;
    private readonly connection: ResolvedSourceConnection;

    constructor(connection: ResolvedSourceConnection) {
        this.connection = connection;
        this.baseUrl =
            connection.authMode === "web-reverse"
                ? resolveFeishuWebBase(connection.baseUrl)
                : resolveFeishuApiBase(connection.baseUrl);
    }

    async testConnection() {
        if (this.connection.authMode === "web-reverse") {
            return await this.testWebReverseConnection();
        }

        try {
            const searchData = await this.getJson(
                "/open-apis/vc/v1/meetings/search?page_size=1",
            );
            return isFeishuMeetingSearchData(searchData);
        } catch {
            return false;
        }
    }

    private async testWebReverseConnection() {
        try {
            const params = new URLSearchParams({
                size: "1",
                [FEISHU_SPACE_NAME_PARAM]: getFeishuWebSpaceName(
                    this.connection,
                ),
            });
            const payload = await this.getWebJson(`/list?${params.toString()}`);
            return hasFeishuWebListPayload(payload);
        } catch {
            return false;
        }
    }

    async listRecordingSnapshots(): Promise<FeishuMinutesRecordingSnapshot[]> {
        if (this.connection.authMode === "web-reverse") {
            throw new Error(
                "飞书妙记连接方式暂不可读取录音，请改用开放平台 user_access_token。",
            );
        }

        const searchData = await this.getJson(
            "/open-apis/vc/v1/meetings/search?page_size=100",
        );
        const meetings = Array.isArray(searchData.items)
            ? (searchData.items as Array<Record<string, unknown>>)
            : Array.isArray(searchData.meetings)
              ? (searchData.meetings as Array<Record<string, unknown>>)
              : [];

        return await Promise.all(
            meetings
                .map((meeting) => {
                    const meetingId =
                        meeting.id ?? meeting.meeting_id ?? meeting.meetingId;
                    return typeof meetingId === "string" ? meetingId : null;
                })
                .filter((meetingId): meetingId is string => Boolean(meetingId))
                .map(async (meetingId) => this.fetchMeetingSnapshot(meetingId)),
        );
    }

    private async fetchMeetingSnapshot(
        meetingId: string,
    ): Promise<FeishuMinutesRecordingSnapshot> {
        const [meetingDetail, recordingData] = await Promise.all([
            this.getJson(
                `/open-apis/vc/v1/meetings/${encodeURIComponent(
                    meetingId,
                )}?with_participants=false&query_mode=0`,
            ),
            this.getJson(
                `/open-apis/vc/v1/meetings/${encodeURIComponent(
                    meetingId,
                )}/recording`,
            ),
        ]);

        const minuteToken =
            extractMinuteToken(recordingData.minute_url) ??
            extractMinuteToken(recordingData.recording_url) ??
            extractMinuteToken(recordingData.url) ??
            null;

        const minuteArtifacts = minuteToken
            ? await this.fetchMinuteArtifacts(minuteToken)
            : {
                  minute: {},
                  artifacts: {},
                  transcriptText: null,
                  mediaUrl: null,
              };

        const startTime =
            toDateOrNull(
                meetingDetail.start_time ??
                    meetingDetail.create_time ??
                    minuteArtifacts.minute.create_time,
            ) ?? new Date();
        const durationMs = Math.max(
            safeNumber(
                recordingData.duration ??
                    meetingDetail.duration ??
                    minuteArtifacts.minute.duration,
                0,
            ) * 1000,
            0,
        );

        return {
            recordingId: meetingId,
            title: String(
                minuteArtifacts.minute.title ??
                    meetingDetail.topic ??
                    meetingDetail.title ??
                    `Feishu ${meetingId}`,
            ),
            durationMs,
            startTime,
            version:
                typeof meetingDetail.update_time === "string" ||
                typeof meetingDetail.update_time === "number"
                    ? String(meetingDetail.update_time)
                    : null,
            metadata: {
                meeting: meetingDetail,
                recording: recordingData,
                minute: minuteArtifacts.minute,
            },
            audioUrl: minuteArtifacts.mediaUrl,
            audioExtension: extractFileExtension(
                minuteArtifacts.mediaUrl,
                "mp4",
            ),
            transcriptText: minuteArtifacts.transcriptText,
            summaryMarkdown: normalizeFeishuText(
                minuteArtifacts.artifacts.summary,
            ),
            detailPayload: {
                meeting: meetingDetail,
                recording: recordingData,
                minute: minuteArtifacts.minute,
                artifacts: minuteArtifacts.artifacts,
                minuteToken,
            },
        };
    }

    private async fetchMinuteArtifacts(minuteToken: string) {
        const emptyRecord: Record<string, unknown> = {};
        const [minute, artifacts, transcriptText, mediaUrl] = await Promise.all(
            [
                this.getJson(
                    `/open-apis/minutes/v1/minutes/${encodeURIComponent(
                        minuteToken,
                    )}`,
                ).catch(() => emptyRecord),
                this.getJson(
                    `/open-apis/minutes/v1/minutes/${encodeURIComponent(
                        minuteToken,
                    )}/artifacts`,
                ).catch(() => emptyRecord),
                this.getText(
                    `/open-apis/minutes/v1/minutes/${encodeURIComponent(
                        minuteToken,
                    )}/transcript?need_speaker=true&need_timestamp=true&file_format=txt`,
                ).catch(() => null),
                this.getJson(
                    `/open-apis/minutes/v1/minutes/${encodeURIComponent(
                        minuteToken,
                    )}/media`,
                )
                    .then((media) => (media.download_url as string) ?? null)
                    .catch(() => null),
            ],
        );

        return {
            minute,
            artifacts,
            transcriptText: normalizeFeishuText(transcriptText),
            mediaUrl,
        };
    }

    private async getJson(path: string) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            headers: {
                Authorization: `Bearer ${getFeishuUserAccessToken(this.connection)}`,
                Accept: "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`Feishu API request failed: ${response.status}`);
        }

        const payload = (await response.json()) as FeishuApiEnvelope;
        if (payload.code !== FEISHU_API_OK) {
            throw new Error(
                `Feishu API request failed: ${payload.msg ?? payload.code ?? "unknown error"}`,
            );
        }

        return payload.data ?? {};
    }

    private async getText(path: string) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            headers: {
                Authorization: `Bearer ${getFeishuUserAccessToken(this.connection)}`,
            },
        });
        if (!response.ok) {
            throw new Error(
                `Feishu transcript request failed: ${response.status}`,
            );
        }

        return await response.text();
    }

    private async getWebJson(path: string) {
        const response = await fetch(buildFeishuWebUrl(path), {
            headers: buildFeishuWebHeaders(this.connection),
        });
        if (!response.ok) {
            throw new Error(
                `Feishu Minutes web request failed: ${response.status}`,
            );
        }

        return (await response.json()) as unknown;
    }
}

function buildFeishuWebUrl(path: string) {
    const url = new URL(path, FEISHU_WEB_DEFAULT_BASE_URL);
    if (url.origin !== FEISHU_WEB_DEFAULT_BASE_URL) {
        throw new Error("请输入飞书妙记的官方服务地址。");
    }

    return url.toString();
}

function getMinutesCsrfToken(cookie: string) {
    const match = cookie.match(/(?:^|;\s*)minutes_csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export function buildFeishuWebHeaders(connection: ResolvedSourceConnection) {
    const cookie = getFeishuWebCookie(connection);
    const headers: Record<string, string> = {
        Accept: "application/json",
        Cookie: cookie,
        Origin: FEISHU_WEB_DEFAULT_BASE_URL,
        Referer: `${FEISHU_WEB_DEFAULT_BASE_URL}/`,
    };

    const csrfToken = getMinutesCsrfToken(cookie);
    if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
    }

    const webToken = connection.secrets.webToken?.trim();
    if (webToken) {
        headers["X-Feishu-Minutes-Token"] = webToken;
    }

    return headers;
}

function hasFeishuWebListPayload(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const payload = value as Record<string, unknown>;
    const data =
        payload.data && typeof payload.data === "object"
            ? (payload.data as Record<string, unknown>)
            : null;

    return [
        payload.list,
        payload.items,
        payload.minutes,
        data?.list,
        data?.items,
        data?.minutes,
    ].some((candidate) => Array.isArray(candidate));
}
