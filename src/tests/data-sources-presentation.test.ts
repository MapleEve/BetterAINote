import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    DATA_SOURCE_CATALOG,
    DATA_SOURCE_PROVIDERS,
    getSourceCapabilitiesForAuthMode,
} from "@/lib/data-sources/catalog";
import {
    buildDataSourceDisplaySection,
    buildDataSourceSavePayload,
    createDefaultSourceDrafts,
    getDataSourceHelpDocUrl,
    getLocalTranscriptHint,
    getPrivateTranscriptionUnavailableMessage,
    getProviderFormFields,
    getProviderServiceAddressDisplay,
    getSourceAuthModeDisplayLabel,
    getSourceProviderLabel,
    getSourceProviderMaturityHint,
    getSourceProviderMaturityLabel,
    getSourceProviderSettingsLabel,
    getSourceProviderStatusHint,
    getSourceRecordDescription,
    getSourceTabLabel,
    getSupportedSourceCapabilityDisplayItems,
    groupDataSourceProvidersByStage,
    providerUsesCustomServerSelector,
} from "@/lib/data-sources/presentation";
import { translations } from "@/lib/i18n";

function readSource(relativePath: string) {
    return readFileSync(path.join(process.cwd(), "src", relativePath), "utf8");
}

describe("data-sources presentation helpers", () => {
    it("keeps common queue and workflow copy user-facing", () => {
        const zhCopy = JSON.stringify(translations["zh-CN"]);
        const enCopy = JSON.stringify(translations.en);
        const blockedZhQueue = ["worker", " 队列"].join("");
        const blockedZhWorkflow = ["下游", "链路"].join("");

        expect(zhCopy).not.toContain(blockedZhQueue);
        expect(zhCopy).not.toContain(blockedZhWorkflow);
        expect(enCopy).not.toContain("queued for worker");
        expect(enCopy).not.toContain("Waiting for worker");
    });

    it("keeps data source settings auth helper copy user-facing", () => {
        const settingsSection = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );

        expect(settingsSection).not.toContain("Authorization details");
        expect(settingsSection).not.toContain("request header");
        expect(settingsSection).not.toContain("request URL");
    });

    it("derives provider labels and source tab labels from shared metadata", () => {
        expect(getSourceProviderLabel("plaud", "zh-CN")).toBe("Plaud");
        expect(getSourceProviderLabel("dingtalk-a1", "zh-CN")).toBe("钉钉");
        expect(getSourceProviderLabel("iflyrec", "zh-CN")).toBe("讯飞听见");
        expect(getSourceProviderLabel("dingtalk-a1", "en")).toBe("DingTalk A1");
        expect(getSourceTabLabel("plaud", "zh-CN")).toBe("Plaud 来源原始记录");
        expect(getSourceTabLabel("ticnote", "en")).toBe(
            "TicNote source record",
        );
    });

    it("keeps shared provider labels short while settings uses SOT provider names", () => {
        expect(getSourceProviderLabel("dingtalk-a1", "zh-CN")).toBe("钉钉");
        expect(getSourceProviderLabel("plaud", "zh-CN")).toBe("Plaud");
        expect(getSourceProviderLabel("dingtalk-a1", "en")).toBe("DingTalk A1");
        expect(getSourceProviderLabel("plaud", "en")).toBe("Plaud");

        expect(getSourceProviderSettingsLabel("dingtalk-a1", "zh-CN")).toBe(
            "钉钉 闪记",
        );
        expect(getSourceProviderSettingsLabel("plaud", "zh-CN")).toBe(
            "Plaud 云端",
        );
        expect(getSourceProviderSettingsLabel("dingtalk-a1", "en")).toBe(
            "DingTalk A1 Flash Notes",
        );
        expect(getSourceProviderSettingsLabel("plaud", "en")).toBe(
            "Plaud Cloud",
        );
        expect(getSourceProviderSettingsLabel("ticnote", "zh-CN")).toBe(
            "TicNote",
        );
    });

    it("exposes provider maturity labels and hints from shared catalog metadata", () => {
        expect(getSourceProviderMaturityLabel("plaud", "zh-CN")).toBe(
            "已验证来源 / 推荐",
        );
        expect(getSourceProviderMaturityLabel("ticnote", "zh-CN")).toBe(
            "更多来源 / 可连接",
        );
        expect(getSourceProviderMaturityLabel("feishu-minutes", "en")).toBe(
            "More sources / Connectable",
        );
        expect(getSourceProviderMaturityHint("plaud", "en")).toBe(
            "Connect to import Plaud recordings.",
        );
        expect(getSourceProviderMaturityHint("ticnote", "en")).toBe(
            "Connect to import TicNote recordings.",
        );
        expect(getSourceProviderMaturityHint("dingtalk-a1", "en")).toContain(
            "DingTalk A1 content",
        );
        expect(getSourceProviderMaturityHint("iflyrec", "zh-CN")).toContain(
            "讯飞听见内容",
        );
    });

    it("groups providers into mainline and experimental sections from catalog maturity stage", () => {
        const groups = groupDataSourceProvidersByStage(
            [
                { provider: "iflyrec" as const },
                { provider: "plaud" as const },
                { provider: "ticnote" as const },
            ],
            "zh-CN",
        );

        expect(groups).toHaveLength(2);
        expect(groups[0]?.stage).toBe("mainline");
        expect(groups[0]?.title).toBe("已验证来源");
        expect(groups[0]?.sources.map((source) => source.provider)).toEqual([
            "plaud",
        ]);
        expect(groups[1]?.stage).toBe("experimental");
        expect(groups[1]?.title).toBe("更多来源");
        expect(groups[1]?.sources.map((source) => source.provider)).toEqual([
            "iflyrec",
            "ticnote",
        ]);
        expect(groups[1]?.description).toContain("按需连接");
    });

    it("keeps the onboarding initial source explicit while preserving the current catalog default", async () => {
        const { INITIAL_ONBOARDING_SOURCE_PROVIDER } = await import(
            "@/features/data-sources/use-onboarding-data-source"
        );
        const [currentCatalogDefault] = DATA_SOURCE_PROVIDERS;

        expect(INITIAL_ONBOARDING_SOURCE_PROVIDER).toBe("plaud");
        expect(INITIAL_ONBOARDING_SOURCE_PROVIDER).toBe(currentCatalogDefault);
    });

    it("builds source record descriptions and transcript hints", () => {
        expect(getSourceRecordDescription("iflyrec", "en")).toContain(
            "iFLYTEK transcripts and details",
        );
        expect(getSourceRecordDescription("plaud", "zh-CN")).toContain(
            "逐字稿、摘要和详情缓存",
        );
        expect(getLocalTranscriptHint("plaud", "en")).toContain(
            "stays on the source tab",
        );
        expect(
            getPrivateTranscriptionUnavailableMessage("ticnote", false, "en"),
        ).toContain("source transcript or report");
        expect(getLocalTranscriptHint("local", "zh-CN")).toBeNull();
    });

    it("returns only supported capabilities for the settings surface", () => {
        expect(
            getSupportedSourceCapabilityDisplayItems("plaud", "en"),
        ).toContainEqual(
            expect.objectContaining({
                capability: "workerSync",
                label: "Automatic import",
                description:
                    "Recordings and details can be imported automatically.",
            }),
        );
        expect(
            getSupportedSourceCapabilityDisplayItems("iflyrec", "en").map(
                (item) => item.capability,
            ),
        ).toEqual(["workerSync", "officialTranscript"]);
        expect(
            getSupportedSourceCapabilityDisplayItems("plaud", "en"),
        ).toHaveLength(7);
    });

    it("uses user-facing sign-in labels instead of engineering terms", () => {
        expect(getSourceAuthModeDisplayLabel("web-reverse", "zh-CN")).toBe(
            "网页登录信息",
        );
        expect(getSourceAuthModeDisplayLabel("web-reverse", "en")).toBe(
            "Web sign-in details",
        );
        expect(getSourceAuthModeDisplayLabel("session-header", "zh-CN")).toBe(
            "会话凭证",
        );
        expect(getSourceAuthModeDisplayLabel("session-header", "en")).toBe(
            "Session credential",
        );
        expect(getSourceAuthModeDisplayLabel("device-signin", "zh-CN")).toBe(
            "设备登录凭证",
        );
        expect(getSourceAuthModeDisplayLabel("oauth-device-flow", "en")).toBe(
            "Open platform authorization",
        );
    });

    it("limits Feishu Minutes capabilities when browser sign-in is selected", () => {
        expect(
            getSupportedSourceCapabilityDisplayItems(
                "feishu-minutes",
                "en",
                "oauth-device-flow",
            ).map((item) => item.capability),
        ).toContain("workerSync");

        expect(
            getSupportedSourceCapabilityDisplayItems(
                "feishu-minutes",
                "en",
                "web-reverse",
            ).map((item) => item.capability),
        ).toEqual([]);

        expect(
            getSourceCapabilitiesForAuthMode("feishu-minutes", "web-reverse"),
        ).toMatchObject({
            workerSync: false,
            audioDownload: false,
            officialTranscript: false,
            officialSummary: false,
            privateTranscribe: false,
        });
    });

    it("derives TicNote region, endpoint, and help links from the shared presentation helpers", () => {
        const drafts = createDefaultSourceDrafts();
        drafts.ticnote.config.region = "intl";
        drafts.ticnote.baseUrl = "https://voice-api.ticnote.cn";
        const ticnoteCredential = "sentinel-ticnote-credential";
        drafts.ticnote.secrets.bearerToken = `  ${ticnoteCredential}  `;

        expect(providerUsesCustomServerSelector("ticnote")).toBe(true);
        expect(
            getProviderFormFields(
                {
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: drafts.ticnote.baseUrl,
                    config: drafts.ticnote.config,
                    secretsConfigured: {},
                },
                { ticnote: drafts.ticnote.secrets },
                "zh-CN",
                "settings",
            )[0],
        ).toMatchObject({
            key: "region",
            value: "intl",
        });
        const ticnoteFields = getProviderFormFields(
            {
                provider: "ticnote",
                enabled: true,
                authMode: "bearer",
                baseUrl: drafts.ticnote.baseUrl,
                config: drafts.ticnote.config,
                secretsConfigured: {},
            },
            { ticnote: drafts.ticnote.secrets },
            "zh-CN",
            "settings",
        );
        expect(ticnoteFields.some((field) => field.key === "orgId")).toBe(
            false,
        );
        expect(ticnoteFields.some((field) => field.key === "language")).toBe(
            false,
        );
        expect(ticnoteFields[0]).toEqual(
            expect.not.objectContaining({ description: expect.any(String) }),
        );
        expect(
            getProviderFormFields(
                {
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: drafts.ticnote.baseUrl,
                    config: {
                        ...drafts.ticnote.config,
                        syncTitleToSource: true,
                    },
                    secretsConfigured: {},
                },
                { ticnote: drafts.ticnote.secrets },
                "zh-CN",
                "settings",
            ),
        ).toContainEqual(
            expect.objectContaining({
                key: "syncTitleToSource",
                label: "将改名回写到数据源",
                value: true,
            }),
        );
        expect(
            buildDataSourceSavePayload(
                {
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: drafts.ticnote.baseUrl,
                    config: {
                        ...drafts.ticnote.config,
                        syncTitleToSource: true,
                    },
                    secretsConfigured: {},
                },
                { ticnote: drafts.ticnote.secrets },
                "zh-CN",
            ),
        ).toMatchObject({
            baseUrl: "https://prd-backend-api.ticnote.com/api",
            config: expect.objectContaining({
                region: "intl",
                language: "zh",
                syncTitleToSource: true,
            }),
            secrets: {
                bearerToken: ticnoteCredential,
            },
        });
        expect(getDataSourceHelpDocUrl("ticnote")).toContain(
            "github.com/MapleEve/BetterAINote/blob/main/docs/DATA_SOURCES.md#ticnote",
        );
        expect(getDataSourceHelpDocUrl("plaud")).toContain(
            "github.com/MapleEve/BetterAINote/blob/main/docs/DATA_SOURCES.md#plaud",
        );
        expect(getDataSourceHelpDocUrl("plaud")).not.toMatch(/^\/docs\//);
        expect(getDataSourceHelpDocUrl("feishu-minutes")).toContain(
            "#feishu-minutes",
        );
        expect(getDataSourceHelpDocUrl("dingtalk-a1")).toContain(
            "#dingtalk-a1",
        );
        const legacyExampleOwner = "BetterAINote";
        const legacyExampleRepo = "example-legacy-source";
        expect(getDataSourceHelpDocUrl("ticnote")).not.toContain(
            `${legacyExampleOwner}/${legacyExampleRepo}`,
        );
    });

    it("builds default drafts from shared provider manifests instead of hand-written per-provider defaults", () => {
        const drafts = createDefaultSourceDrafts();

        expect(drafts.plaud).toMatchObject({
            authMode: "bearer",
            baseUrl: "https://api.plaud.ai",
            config: expect.objectContaining({
                server: "global",
                syncTitleToSource: false,
            }),
            secrets: {
                bearerToken: "",
            },
        });
        expect(drafts.ticnote).toMatchObject({
            authMode: "bearer",
            baseUrl: "https://voice-api.ticnote.cn",
            config: expect.objectContaining({
                region: "cn",
                syncTitleToSource: false,
            }),
            secrets: {
                bearerToken: "",
            },
        });
        expect(drafts["dingtalk-a1"]).toMatchObject({
            authMode: "device-signin",
            baseUrl: "https://meeting-ai-tingji.dingtalk.com",
            secrets: {
                deviceCredential: "",
            },
        });
        expect(DATA_SOURCE_CATALOG["dingtalk-a1"].authModes).toEqual([
            "device-signin",
        ]);
        expect(drafts["feishu-minutes"]).toMatchObject({
            authMode: "oauth-device-flow",
            baseUrl: "https://open.feishu.cn",
            secrets: {
                userAccessToken: "",
                webCookie: "",
                webToken: "",
            },
        });
        expect(drafts.iflyrec).toMatchObject({
            config: expect.objectContaining({
                bizId: "tjzs",
            }),
            secrets: {
                sessionId: "",
            },
        });
    });

    it("builds Feishu Minutes access-token and web sign-in payloads from the selected sign-in method", () => {
        const drafts = createDefaultSourceDrafts();
        const openApiCredential = "sentinel-feishu-open-api";
        const webSignInCredential = "sentinel-feishu-web-sign-in";
        const supplementalCredential = "sentinel-feishu-supplemental";
        drafts["feishu-minutes"].secrets.userAccessToken =
            `  ${openApiCredential}  `;
        drafts["feishu-minutes"].secrets.webCookie =
            `  ${webSignInCredential}  `;
        drafts["feishu-minutes"].secrets.webToken =
            `  ${supplementalCredential}  `;
        const secretDrafts = {
            "feishu-minutes": drafts["feishu-minutes"].secrets,
        };

        const openApiPayload = buildDataSourceSavePayload(
            {
                provider: "feishu-minutes",
                enabled: true,
                authMode: "oauth-device-flow",
                baseUrl: "https://open.feishu.cn",
                config: {
                    appId: "cli_xxx",
                    spaceName: "ignored-for-openapi",
                },
                secretsConfigured: {},
            },
            secretDrafts,
            "zh-CN",
        );

        expect(openApiPayload).toMatchObject({
            authMode: "oauth-device-flow",
            baseUrl: "https://open.feishu.cn",
            config: {
                appId: "cli_xxx",
            },
            secrets: {
                userAccessToken: openApiCredential,
            },
        });

        const webPayload = buildDataSourceSavePayload(
            {
                provider: "feishu-minutes",
                enabled: true,
                authMode: "web-reverse",
                baseUrl: "https://open.feishu.cn",
                config: {
                    appId: "ignored-for-web",
                    spaceName: "cn",
                },
                secretsConfigured: {},
            },
            secretDrafts,
            "zh-CN",
        );

        expect(webPayload).toMatchObject({
            authMode: "web-reverse",
            baseUrl: "https://meetings.feishu.cn",
            config: {
                spaceName: "cn",
            },
            secrets: {
                webCookie: webSignInCredential,
                webToken: supplementalCredential,
            },
        });
    });

    it("shows provider-specific Chinese service addresses for Feishu and DingTalk", () => {
        expect(
            getProviderServiceAddressDisplay(
                {
                    provider: "feishu-minutes",
                    enabled: true,
                    authMode: "oauth-device-flow",
                    baseUrl: "https://meetings.feishu.cn",
                    config: {},
                    secretsConfigured: {},
                },
                "zh-CN",
            ),
        ).toMatchObject({
            label: "飞书开放平台地址",
            value: "https://open.feishu.cn",
            description: "用于飞书开放平台导入；填写授权信息时使用这个地址。",
            readOnly: true,
        });

        expect(
            getProviderServiceAddressDisplay(
                {
                    provider: "feishu-minutes",
                    enabled: true,
                    authMode: "web-reverse",
                    baseUrl: "https://open.feishu.cn",
                    config: {},
                    secretsConfigured: {},
                },
                "zh-CN",
            ),
        ).toMatchObject({
            label: "飞书妙记网页地址",
            value: "https://meetings.feishu.cn",
            description:
                "用于飞书妙记网页导入；填写网页登录信息时使用这个地址。",
            readOnly: true,
        });

        expect(
            getProviderServiceAddressDisplay(
                {
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "device-signin",
                    baseUrl: null,
                    config: {},
                    secretsConfigured: {},
                },
                "zh-CN",
            ),
        ).toMatchObject({
            label: "base URL",
            value: "https://alidocs.dingtalk.com",
            description: "钉钉 API 域名",
            readOnly: true,
        });

        expect(
            buildDataSourceSavePayload(
                {
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "device-signin",
                    baseUrl: "https://wrong.example",
                    config: {},
                    secretsConfigured: {},
                },
                {
                    "dingtalk-a1": {
                        deviceCredential: "sentinel-device-sign-in",
                    },
                },
                "zh-CN",
            ),
        ).toMatchObject({
            baseUrl: "https://meeting-ai-tingji.dingtalk.com",
        });
    });

    it("maps row117 provider status hints without exposing private data", () => {
        const base = {
            enabled: true,
            authMode: "bearer",
            baseUrl: null,
            config: {},
            secretsConfigured: {},
        };

        expect(
            getSourceProviderStatusHint(
                {
                    ...base,
                    provider: "dingtalk-a1",
                    connected: true,
                    syncStatus: "idle",
                    connectionStatus: "ready",
                },
                "zh-CN",
            ),
        ).toBe("最近更新 · 12 分钟前 · 112 条录音");
        expect(
            getSourceProviderStatusHint(
                {
                    ...base,
                    provider: "ticnote",
                    connected: true,
                    syncStatus: "syncing",
                    connectionStatus: "ready",
                },
                "zh-CN",
            ),
        ).toBe("正在同步 · 已读取 12 / 48");
        expect(
            getSourceProviderStatusHint(
                {
                    ...base,
                    provider: "plaud",
                    connected: true,
                    syncStatus: "error",
                    connectionStatus: "ready",
                },
                "zh-CN",
            ),
        ).toBe("上次同步失败 · 2 小时前");
        expect(
            getSourceProviderStatusHint(
                {
                    ...base,
                    provider: "feishu-minutes",
                    connected: false,
                    syncStatus: "idle",
                    connectionStatus: "ready",
                },
                "zh-CN",
            ),
        ).toBe("待设置 · 两种接入方式");
        expect(
            getSourceProviderStatusHint(
                {
                    ...base,
                    provider: "iflyrec",
                    connected: true,
                    syncStatus: "idle",
                    connectionStatus: "expired",
                },
                "zh-CN",
            ),
        ).toBe("登录已过期");
    });

    it("matches DingTalk A1 settings detail fields to the SOT baseline", () => {
        expect(DATA_SOURCE_CATALOG["dingtalk-a1"].capabilities).toMatchObject({
            upstreamTitleWriteback: true,
        });

        const fields = getProviderFormFields(
            {
                provider: "dingtalk-a1",
                enabled: true,
                authMode: "device-signin",
                baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                config: {
                    syncTitleToSource: true,
                },
                secretsConfigured: {
                    deviceCredential: true,
                },
            },
            {
                "dingtalk-a1": {
                    deviceCredential: "",
                },
            },
            "zh-CN",
            "settings",
        );

        expect(fields.map((field) => field.label)).toEqual([
            "浏览器授权",
            "网页登录材料",
            "设备标识",
            "将改名回写到数据源",
        ]);
        expect(fields.map((field) => field.description)).toEqual([
            "授权信息 · 已脱敏",
            "登录材料 · 用于读取闪记列表",
            "本机设备标识",
            "本地 AI 重命名成功后，把标题一并回写到对应数据源。",
        ]);
        expect(fields.slice(0, 2)).toEqual([
            expect.objectContaining({
                kind: "text",
                readOnly: true,
                value: "••••••••••••••••",
            }),
            expect.objectContaining({
                kind: "text",
                readOnly: true,
                value: "••••••••••••••••",
            }),
        ]);
        expect(
            fields.find((field) => field.label === "设备标识"),
        ).toMatchObject({
            key: "deviceIdentifierDisplay",
            kind: "text",
            readOnly: true,
            value: "已脱敏",
        });

        const setupFields = getProviderFormFields(
            {
                provider: "dingtalk-a1",
                authMode: "device-signin",
                baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                config: {},
                enabled: false,
                secretsConfigured: {},
            },
            {
                "dingtalk-a1": {
                    deviceCredential: "sentinel-device-sign-in",
                },
            },
            "zh-CN",
            "settings",
        );
        const editableDeviceField = setupFields.find(
            (field) => field.label === "设备标识",
        );
        expect(editableDeviceField).toMatchObject({
            key: "deviceCredential",
            kind: "textarea",
            target: "secret",
            value: "sentinel-device-sign-in",
        });
        expect(editableDeviceField).not.toHaveProperty("readOnly");
    });

    it("labels Feishu Minutes sign-in choices with user-facing credential copy", () => {
        expect(
            getSourceAuthModeDisplayLabel("oauth-device-flow", "zh-CN"),
        ).toBe("开放平台授权");
        expect(getSourceAuthModeDisplayLabel("web-reverse", "zh-CN")).toBe(
            "网页登录信息",
        );

        const tokenFields = getProviderFormFields(
            {
                provider: "feishu-minutes",
                enabled: true,
                authMode: "oauth-device-flow",
                baseUrl: "https://open.feishu.cn",
                config: {
                    appId: "",
                },
                secretsConfigured: {},
            },
            {
                "feishu-minutes": {
                    userAccessToken: "",
                },
            },
            "zh-CN",
            "settings",
        );
        const fields = getProviderFormFields(
            {
                provider: "feishu-minutes",
                enabled: true,
                authMode: "web-reverse",
                baseUrl: "https://meetings.feishu.cn",
                config: {
                    spaceName: "cn",
                },
                secretsConfigured: {},
            },
            {
                "feishu-minutes": {
                    webCookie: "",
                    webToken: "",
                },
            },
            "zh-CN",
            "settings",
        );

        expect(fields.map((field) => field.key)).toEqual([
            "spaceName",
            "webCookie",
            "webToken",
        ]);
        expect(tokenFields[0]).toMatchObject({
            label: "开放平台应用 ID",
            placeholder: "应用 ID",
        });
        expect(tokenFields[0]?.description).toBe(
            "填写飞书开放平台应用的应用 ID。",
        );
        expect(tokenFields[1]).toMatchObject({
            label: "开放平台授权信息",
            placeholder: "粘贴授权信息",
        });
        expect(tokenFields[1]?.description).toBe(
            "粘贴飞书开放平台授权结果中的访问凭证。",
        );
        expect(fields[0]).toMatchObject({
            label: "站点区域",
            placeholder: "cn",
        });
        expect(fields[1]).toMatchObject({
            label: "网页登录信息",
            placeholder: "粘贴登录信息",
        });
        expect(fields[1]?.description).toBe(
            "粘贴飞书妙记当前网页登录状态对应的登录信息。",
        );
        expect(fields[2]).toMatchObject({
            label: "补充校验信息（可选）",
            placeholder: "可选",
        });
        expect(fields[2]?.description).toBe(
            "只有连接测试提示需要额外校验信息时才填写；没有就留空。",
        );
    });

    it("labels Plaud sign-in inputs with user-facing credential copy", () => {
        const fields = getProviderFormFields(
            {
                provider: "plaud",
                enabled: true,
                authMode: "bearer",
                baseUrl: "https://api.plaud.ai",
                config: {
                    server: "custom",
                },
                secretsConfigured: {
                    bearerToken: true,
                },
            },
            {
                plaud: {
                    bearerToken: "",
                },
            },
            "zh-CN",
            "settings",
        );

        expect(fields.map((field) => field.label)).toEqual(
            expect.arrayContaining([
                "站点版本",
                "自定义服务地址",
                "Plaud 访问凭证",
            ]),
        );
        expect(
            fields.find((field) => field.key === "bearerToken")?.placeholder,
        ).toBe("••••••••••••••••");
        expect(
            fields.find((field) => field.key === "bearerToken")?.description,
        ).toBe("粘贴 Plaud 当前账号的访问凭证；系统会自动整理格式。");
    });

    it("labels iFLYTEK and TicNote inputs with user-facing credential copy", () => {
        const iflyrecFields = getProviderFormFields(
            {
                provider: "iflyrec",
                enabled: true,
                authMode: "session-header",
                baseUrl: "https://www.iflyrec.com",
                config: {
                    bizId: "tjzs",
                },
                secretsConfigured: {},
            },
            {
                iflyrec: {
                    sessionId: "",
                },
            },
            "zh-CN",
            "settings",
        );
        const ticnoteFields = getProviderFormFields(
            {
                provider: "ticnote",
                enabled: true,
                authMode: "bearer",
                baseUrl: "https://voice-api.ticnote.cn",
                config: {},
                secretsConfigured: {
                    bearerToken: true,
                },
            },
            {
                ticnote: {
                    bearerToken: "",
                },
            },
            "zh-CN",
            "settings",
        );

        expect(iflyrecFields[0]?.label).toBe("站点标识");
        expect(iflyrecFields[0]?.description).toBe(
            "用于匹配讯飞听见站点；不确定就保留默认值。",
        );
        expect(iflyrecFields[1]?.label).toBe("登录凭证");
        expect(iflyrecFields[1]?.description).toBe(
            "粘贴讯飞听见当前账号的访问凭证。",
        );
        expect(
            ticnoteFields.find((field) => field.key === "bearerToken"),
        ).toMatchObject({
            label: "TicNote 访问凭证",
            placeholder: "••••••••••••••••",
        });
        expect(
            ticnoteFields.find((field) => field.key === "bearerToken")
                ?.description,
        ).toBe("粘贴 TicNote 当前账号的访问凭证。");
        expect(ticnoteFields.some((field) => field.key === "language")).toBe(
            false,
        );
    });

    it("keeps settings field copy free of browser-capture and credential internals", () => {
        const drafts = createDefaultSourceDrafts();
        const allFields = DATA_SOURCE_PROVIDERS.flatMap((provider) =>
            DATA_SOURCE_CATALOG[provider].authModes.flatMap((authMode) =>
                getProviderFormFields(
                    {
                        provider,
                        enabled: true,
                        authMode,
                        baseUrl: drafts[provider].baseUrl,
                        config: drafts[provider].config,
                        secretsConfigured: {},
                    },
                    {
                        [provider]: drafts[provider].secrets,
                    },
                    "zh-CN",
                    "settings",
                ),
            ),
        );
        const visibleCopy = [
            ...allFields.flatMap((field) => [
                field.label,
                field.description ?? "",
                field.placeholder ?? "",
            ]),
            ...[
                "bearer",
                "cookie",
                "oauth-device-flow",
                "web-reverse",
                "session-header",
                "device-signin",
            ].map((mode) => getSourceAuthModeDisplayLabel(mode, "zh-CN")),
        ].join("\n");

        expect(visibleCopy).not.toMatch(
            /payload|cookie|header|token|Cookie|Authorization|Bearer|web-reverse|X-Session-Id|X-Biz-Id|X-Feishu|dt-meeting|user_access_token|space_name|localStorage|request header|请求头|请求 URL/i,
        );
    });

    it("builds a flat display section without a featured provider slot", () => {
        const section = buildDataSourceDisplaySection([
            { provider: "iflyrec" as const, connected: false },
            { provider: "plaud" as const, connected: true },
            { provider: "ticnote" as const, connected: true },
            { provider: "feishu-minutes" as const, connected: false },
        ]);

        expect(section.connected.map((source) => source.provider)).toEqual([
            "plaud",
            "ticnote",
        ]);
        expect(section.available.map((source) => source.provider)).toEqual([
            "feishu-minutes",
            "iflyrec",
        ]);
    });
});
