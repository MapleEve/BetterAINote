import type {
    ResolvedSourceConnection,
    SourceConnectionTestResult,
    SourceTranscriptSegment,
} from "@/lib/data-sources/types";
import {
    extractFileExtension,
    parseJsonString,
    safeNumber,
    toDateOrNull,
} from "@/lib/data-sources/utils";

interface TicNoteChat {
    id?: string;
    name?: string;
    organizationId?: string;
    project_id?: string;
    projectInfo?: {
        id?: string;
    };
}

interface TicNoteFileNode {
    id?: string;
    fileId?: string;
    name?: string;
    recordTime?: string | number;
    createTime?: string | number;
    updateTime?: string | number;
    subRemark?: {
        recordTime?: string | number;
        duration?: number;
    };
    voiceInfo?: {
        url?: string;
        summaryId?: string;
        transcribeId?: string;
    };
    children?: TicNoteFileNode[];
}

function getTicNoteRecordTime(
    value: Record<string, unknown> | TicNoteFileNode,
) {
    const recordTime = value.recordTime;
    if (typeof recordTime === "string" || typeof recordTime === "number") {
        return recordTime;
    }

    const subRemark = value.subRemark;
    if (subRemark && typeof subRemark === "object") {
        const nestedRecordTime = (subRemark as { recordTime?: string | number })
            .recordTime;
        if (
            typeof nestedRecordTime === "string" ||
            typeof nestedRecordTime === "number"
        ) {
            return nestedRecordTime;
        }
    }

    return null;
}

interface TicNoteFileDetailPayload {
    data?: Record<string, unknown>;
}

interface TicNoteFileTreePayload {
    data?: TicNoteFileNode[];
    fileTree?: TicNoteFileNode[];
}

interface TicNoteChatsPayload {
    data?: TicNoteChat[];
    chats?: TicNoteChat[];
}

interface TicNoteUpdateTitleResponse {
    code?: number;
    data?: {
        path?: string;
        absolutePath?: string;
    };
}

type TicNoteTranscriptSegment = {
    speaker?: string;
    start?: number;
    end?: number;
    text?: string;
};

type TicNoteSummary = {
    title?: string;
    md?: string;
    md2?: string;
};

class TicNoteApiError extends Error {
    constructor(
        message: string,
        readonly code: string,
    ) {
        super(message);
        this.name = "TicNoteApiError";
    }
}

export type TicNoteRegion = "cn" | "intl";

export interface TicNoteRecordingSnapshot {
    recordingId: string;
    title: string;
    durationMs: number;
    startTime: Date;
    filesize: number | null;
    version: string | null;
    metadata: Record<string, unknown>;
    audioUrl: string | null;
    audioExtension: string;
    transcriptSegments: SourceTranscriptSegment[];
    transcriptText: string;
    summaryMarkdown: string | null;
}

export const TICNOTE_DEFAULT_BASE_URL = "https://voice-api.ticnote.cn";
export const TICNOTE_LANGUAGE_OPTIONS = ["zh", "en", "ja"] as const;
export const TICNOTE_REGION_BASE_URLS: Record<TicNoteRegion, string> = {
    cn: TICNOTE_DEFAULT_BASE_URL,
    intl: "https://prd-backend-api.ticnote.com/api",
};

export function resolveTicNoteConnectionConfig(
    baseUrl: string | null | undefined,
    config: Record<string, unknown> | null | undefined,
) {
    const normalizedBaseUrl = baseUrl?.replace(/\/$/, "") ?? null;
    const region =
        typeof config?.region === "string" &&
        (config.region === "cn" || config.region === "intl")
            ? config.region
            : normalizedBaseUrl === TICNOTE_REGION_BASE_URLS.intl
              ? "intl"
              : "cn";
    const orgId = typeof config?.orgId === "string" ? config.orgId.trim() : "";
    const timezone = normalizeTicNoteTimezone(
        config?.timezone,
        "Asia/Shanghai",
    );
    const language = normalizeTicNoteLanguage(config?.language, "zh");
    const syncTitleToSource =
        typeof config?.syncTitleToSource === "boolean"
            ? config.syncTitleToSource
            : false;

    return {
        region,
        orgId,
        timezone,
        language,
        syncTitleToSource,
    };
}

export function resolveTicNoteRegion(
    incoming: unknown,
    fallbackBaseUrl: string | null,
) {
    const normalizedFallbackBaseUrl =
        fallbackBaseUrl?.replace(/\/$/, "") ?? null;

    if (incoming === "cn" || incoming === "intl") {
        return incoming;
    }

    if (normalizedFallbackBaseUrl === TICNOTE_REGION_BASE_URLS.intl) {
        return "intl";
    }

    if (
        normalizedFallbackBaseUrl === TICNOTE_REGION_BASE_URLS.cn ||
        !normalizedFallbackBaseUrl
    ) {
        return "cn";
    }

    throw new Error("TicNote region must be one of cn, intl");
}

export function normalizeTicNoteTimezone(incoming: unknown, fallback: string) {
    const timezone =
        typeof incoming === "string" && incoming.trim()
            ? incoming.trim()
            : fallback;

    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(
            new Date(),
        );
    } catch {
        throw new Error("TicNote timezone is invalid");
    }

    return timezone;
}

export function normalizeTicNoteLanguage(incoming: unknown, fallback: string) {
    const language =
        typeof incoming === "string" && incoming.trim()
            ? incoming.trim()
            : fallback;

    if (!(TICNOTE_LANGUAGE_OPTIONS as readonly string[]).includes(language)) {
        throw new Error("TicNote language must be one of zh, en, ja");
    }

    return language;
}

function buildTicNoteUrl(baseUrl: string | null, path: string) {
    const normalizedBaseUrl = (baseUrl ?? TICNOTE_DEFAULT_BASE_URL).replace(
        /\/$/,
        "",
    );
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (normalizedBaseUrl.endsWith("/api")) {
        return `${normalizedBaseUrl}${normalizedPath}`;
    }

    return `${normalizedBaseUrl}/api${normalizedPath}`;
}

function isSensitiveTicNoteKey(key: string) {
    return /authorization|cookie|token|orgid|org-id|x-tic-org-id/i.test(key);
}

function redactSensitiveTicNoteText(
    value: string,
    connection: ResolvedSourceConnection,
) {
    const sensitiveValues = [
        connection.secrets.bearerToken,
        typeof connection.config.orgId === "string"
            ? connection.config.orgId
            : "",
    ].filter((item): item is string => item.trim().length > 0);

    return sensitiveValues.reduce(
        (current, sensitiveValue) =>
            current.split(sensitiveValue).join("[redacted]"),
        value
            .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
            .replace(
                /((?:^|[;\s])[^=;\s]*cookie[^=;\s]*=)[^;\s]+/gi,
                "$1[redacted]",
            ),
    );
}

function sanitizeTicNotePayload(
    value: unknown,
    connection: ResolvedSourceConnection,
): unknown {
    if (Array.isArray(value)) {
        return value
            .slice(0, 5)
            .map((item) => sanitizeTicNotePayload(item, connection));
    }

    if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([key]) => !isSensitiveTicNoteKey(key))
            .slice(0, 8)
            .map(([key, item]) => [
                key,
                sanitizeTicNotePayload(item, connection),
            ]);

        return Object.fromEntries(entries);
    }

    if (typeof value === "string") {
        return redactSensitiveTicNoteText(value, connection);
    }

    return value;
}

function summarizeTicNotePayload(
    payload: unknown,
    connection: ResolvedSourceConnection,
) {
    const sanitized = sanitizeTicNotePayload(payload, connection);
    const summary = JSON.stringify(sanitized);
    if (!summary || summary === "{}" || summary === "[]") {
        return "response body contained only redacted fields";
    }

    return summary.length > 240 ? `${summary.slice(0, 240)}...` : summary;
}

async function buildTicNoteResponseSummary(
    response: Response,
    connection: ResolvedSourceConnection,
) {
    try {
        const text = await response.text();
        if (!text.trim()) {
            return "empty response body";
        }

        try {
            return summarizeTicNotePayload(JSON.parse(text), connection);
        } catch {
            const sanitized = redactSensitiveTicNoteText(text, connection)
                .replace(/\s+/g, " ")
                .trim();
            return sanitized.length > 240
                ? `${sanitized.slice(0, 240)}...`
                : sanitized;
        }
    } catch {
        return "response body was unreadable";
    }
}

function buildHeaders(
    connection: ResolvedSourceConnection,
    options: { includeOrgHeader?: boolean } = {},
) {
    const includeOrgHeader = options.includeOrgHeader ?? true;
    const orgId =
        typeof connection.config.orgId === "string"
            ? connection.config.orgId
            : "";
    const timezone =
        typeof connection.config.timezone === "string"
            ? connection.config.timezone
            : "Asia/Shanghai";
    const language =
        typeof connection.config.language === "string"
            ? connection.config.language
            : "zh";

    return {
        Authorization: `Bearer ${connection.secrets.bearerToken}`,
        ...(includeOrgHeader && orgId ? { "X-Tic-Org-Id": orgId } : {}),
        "X-Tic-Lang": language,
        "X-Tic-Client-Info": "web",
        Timezone: timezone,
        Accept: "application/json, text/plain, */*",
    };
}

function flattenFileNodes(nodes: TicNoteFileNode[]): TicNoteFileNode[] {
    return nodes.flatMap((node) => [
        node,
        ...flattenFileNodes(node.children ?? []),
    ]);
}

function parseTranscriptSegments(value: unknown): TicNoteTranscriptSegment[] {
    if (Array.isArray(value)) {
        return value as TicNoteTranscriptSegment[];
    }

    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (Array.isArray(record.segments)) {
            return record.segments as TicNoteTranscriptSegment[];
        }
        if (Array.isArray(record.data)) {
            return record.data as TicNoteTranscriptSegment[];
        }
    }

    return parseJsonString<TicNoteTranscriptSegment[]>(value, []);
}

function parseSummary(value: unknown): TicNoteSummary {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as TicNoteSummary;
    }

    return parseJsonString<TicNoteSummary>(value, {});
}

function isTicNoteChatsPayload(value: unknown) {
    return Array.isArray(extractTicNoteChats(value));
}

function extractTicNoteChats(value: unknown): TicNoteChat[] | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const payload = value as TicNoteChatsPayload;
    if (Array.isArray(payload.data)) {
        return payload.data;
    }
    if (Array.isArray(payload.chats)) {
        return payload.chats;
    }

    return null;
}

function extractTicNoteFileTree(value: unknown): TicNoteFileNode[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return [];
    }

    const payload = value as TicNoteFileTreePayload;
    if (Array.isArray(payload.data)) {
        return payload.data;
    }
    if (Array.isArray(payload.fileTree)) {
        return payload.fileTree;
    }

    return [];
}

function normalizeSegments(
    segments: TicNoteTranscriptSegment[],
): SourceTranscriptSegment[] {
    return segments
        .map((segment) => ({
            speaker: segment.speaker ?? "SPEAKER_00",
            startMs: Math.round(safeNumber(segment.start, 0) * 1000),
            endMs: Math.round(safeNumber(segment.end, 0) * 1000),
            text: (segment.text ?? "").trim(),
        }))
        .filter(
            (segment) =>
                segment.text.length > 0 && segment.endMs >= segment.startMs,
        );
}

export class TicNoteClient {
    constructor(private readonly connection: ResolvedSourceConnection) {}

    async discoverOrganizationIds(): Promise<string[]> {
        const payload = await this.requestJson<TicNoteChatsPayload>(
            "/v2/file-index/chats",
            {},
            { includeOrgHeader: false },
        );
        const chats = extractTicNoteChats(payload) ?? [];
        return Array.from(
            new Set(
                chats
                    .map((chat) =>
                        typeof chat.organizationId === "string"
                            ? chat.organizationId.trim()
                            : "",
                    )
                    .filter((organizationId) => organizationId.length > 0),
            ),
        );
    }

    async testConnection(): Promise<SourceConnectionTestResult> {
        try {
            const payload = await this.requestJson<unknown>(
                "/v2/file-index/chats",
            );
            if (!isTicNoteChatsPayload(payload)) {
                return {
                    ok: false,
                    code: "invalid-response-shape",
                    message:
                        "TicNote returned a response from /v2/file-index/chats, but it was not the expected chats payload.",
                };
            }

            return {
                ok: true,
                code: "ok",
                message: "TicNote connection validated.",
            };
        } catch (error) {
            return {
                ok: false,
                code:
                    error instanceof TicNoteApiError
                        ? error.code
                        : "request-failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "TicNote connection validation failed.",
            };
        }
    }

    async listRecordingSnapshots(): Promise<TicNoteRecordingSnapshot[]> {
        const chatsPayload = await this.requestJson<TicNoteChatsPayload>(
            "/v2/file-index/chats",
        );
        const projectId = this.resolveRecordingsProjectId(
            extractTicNoteChats(chatsPayload) ?? [],
        );
        if (!projectId) {
            return [];
        }

        const treePayload = await this.requestJson<TicNoteFileTreePayload>(
            `/v1/file-index/file-tree?rootId=${encodeURIComponent(projectId)}`,
        );
        const nodes = flattenFileNodes(
            extractTicNoteFileTree(treePayload),
        ).filter(
            (node): node is TicNoteFileNode & { id: string } =>
                typeof node.id === "string",
        );

        return await Promise.all(
            nodes.map(async (node) => {
                const detailPayload =
                    await this.requestJson<TicNoteFileDetailPayload>(
                        `/v2/file-index/file-detail/${node.id}`,
                    );
                return this.buildRecordingSnapshot(
                    node,
                    detailPayload.data ?? {},
                );
            }),
        );
    }

    async updateTitle(
        recordingId: string,
        title: string,
    ): Promise<TicNoteUpdateTitleResponse> {
        return this.requestJson<TicNoteUpdateTitleResponse>(
            `/v1/knowledge/edit/${encodeURIComponent(recordingId)}`,
            {
                method: "PUT",
                body: JSON.stringify({ title }),
            },
        );
    }

    private async requestJson<T>(
        path: string,
        init: RequestInit = {},
        options: { includeOrgHeader?: boolean } = {},
    ): Promise<T> {
        const response = await fetch(
            buildTicNoteUrl(this.connection.baseUrl, path),
            {
                ...init,
                headers: {
                    ...buildHeaders(this.connection, options),
                    ...(init.body
                        ? { "Content-Type": "application/json" }
                        : {}),
                    ...init.headers,
                },
            },
        );

        if (!response.ok) {
            const summary = await buildTicNoteResponseSummary(
                response,
                this.connection,
            );
            throw new TicNoteApiError(
                `TicNote rejected ${path} with HTTP ${response.status}. Response: ${summary}`,
                "http-error",
            );
        }

        try {
            return (await response.json()) as T;
        } catch {
            throw new TicNoteApiError(
                `TicNote returned HTTP ${response.status}, but the response body was not valid JSON.`,
                "invalid-json",
            );
        }
    }

    private resolveRecordingsProjectId(chats: TicNoteChat[]) {
        const recordingsChat =
            chats.find((chat) => /record/i.test(chat.name ?? "")) ??
            chats.find((chat) =>
                Boolean(chat.project_id || chat.projectInfo?.id),
            );

        return (
            recordingsChat?.project_id ??
            recordingsChat?.projectInfo?.id ??
            null
        );
    }

    private buildRecordingSnapshot(
        node: TicNoteFileNode & { id: string },
        detail: Record<string, unknown>,
    ): TicNoteRecordingSnapshot {
        const transcriptSegments = normalizeSegments(
            parseTranscriptSegments(detail.transcribeJson),
        );
        const summary = parseSummary(detail.summaryJson);
        const startTime =
            toDateOrNull(detail.startTime) ??
            toDateOrNull(getTicNoteRecordTime(detail)) ??
            toDateOrNull(getTicNoteRecordTime(node)) ??
            toDateOrNull(detail.createTime) ??
            toDateOrNull(node.createTime) ??
            new Date();
        const durationMs = Math.round(
            safeNumber(detail.duration ?? node.subRemark?.duration, 0) * 1000,
        );
        const audioUrl =
            typeof detail.formatUrl === "string"
                ? detail.formatUrl
                : typeof detail.fileUrl === "string"
                  ? detail.fileUrl
                  : typeof node.voiceInfo?.url === "string"
                    ? node.voiceInfo.url
                    : null;

        return {
            recordingId: node.id,
            title:
                String(
                    detail.title ??
                        detail.fileName ??
                        node.name ??
                        node.fileId ??
                        node.id,
                ) || node.id,
            durationMs,
            startTime,
            filesize: safeNumber(detail.fileSize, 0) || null,
            version:
                typeof detail.updateTime === "string" ||
                typeof detail.updateTime === "number"
                    ? String(detail.updateTime)
                    : typeof node.updateTime === "string" ||
                        typeof node.updateTime === "number"
                      ? String(node.updateTime)
                      : null,
            metadata: detail,
            audioUrl,
            audioExtension: extractFileExtension(audioUrl, "wav"),
            transcriptSegments,
            transcriptText: transcriptSegments
                .map((segment) => `${segment.speaker}: ${segment.text}`)
                .join("\n\n"),
            summaryMarkdown:
                summary.md2 ??
                summary.md ??
                (summary.title ? `# ${summary.title}` : null),
        };
    }
}
