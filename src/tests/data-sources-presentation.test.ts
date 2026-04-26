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
    getSourceRecordDescription,
    getSourceTabLabel,
    getSupportedSourceCapabilityDisplayItems,
    groupDataSourceProvidersByStage,
    providerUsesCustomServerSelector,
} from "@/lib/data-sources/presentation";
import { translations } from "@/lib/i18n";

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

    it("derives provider labels and source tab labels from shared metadata", () => {
        expect(getSourceProviderLabel("plaud", "zh-CN")).toBe("Plaud");
        expect(getSourceProviderLabel("dingtalk-a1", "en")).toBe("DingTalk A1");
        expect(getSourceTabLabel("plaud", "zh-CN")).toBe("Plaud 来源原始记录");
        expect(getSourceTabLabel("ticnote", "en")).toBe(
            "TicNote source record",
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
            "space_name + Cookie",
        );
        expect(getSourceAuthModeDisplayLabel("web-reverse", "en")).toBe(
            "space_name + Cookie",
        );
        expect(getSourceAuthModeDisplayLabel("session-header", "zh-CN")).toBe(
            "X-Session-Id",
        );
        expect(getSourceAuthModeDisplayLabel("session-header", "en")).toBe(
            "X-Session-Id",
        );
        expect(getSourceAuthModeDisplayLabel("device-signin", "zh-CN")).toBe(
            "dt-meeting-agent-token",
        );
        expect(getSourceAuthModeDisplayLabel("oauth-device-flow", "en")).toBe(
            "Open platform user_access_token",
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
        drafts.ticnote.secrets.bearerToken = "Bearer \n tic-token-123 ";

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
            "en",
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
                bearerToken: "tic-token-123",
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
        drafts["feishu-minutes"].secrets.userAccessToken = "  u-123  ";
        drafts["feishu-minutes"].secrets.webCookie =
            "  minutes_csrf_token=csrf-value; session=redacted  ";
        drafts["feishu-minutes"].secrets.webToken = "  web-token-redacted  ";
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
                userAccessToken: "u-123",
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
                webCookie: "minutes_csrf_token=csrf-value; session=redacted",
                webToken: "web-token-redacted",
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
            description:
                "用于飞书开放平台接口；填写 user_access_token 时使用这个地址。",
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
                "用于飞书妙记网页请求；填写 space_name、Cookie 时使用这个地址。",
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
            label: "钉钉闪记服务地址",
            value: "https://meeting-ai-tingji.dingtalk.com",
            description:
                "用于 getConversationList、minutesDetailV2 等钉钉闪记接口。",
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
                        deviceCredential: "dt-token",
                    },
                },
                "zh-CN",
            ),
        ).toMatchObject({
            baseUrl: "https://meeting-ai-tingji.dingtalk.com",
        });
    });

    it("labels DingTalk A1 sign-in fields with the exact request field to paste", () => {
        const [field] = getProviderFormFields(
            {
                provider: "dingtalk-a1",
                enabled: true,
                authMode: "device-signin",
                baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                config: {},
                secretsConfigured: {},
            },
            {
                "dingtalk-a1": {
                    deviceCredential: "",
                },
            },
            "en",
            "settings",
        );

        expect(field?.label).toBe("dt-meeting-agent-token");
        expect(field?.description).toContain("getConversationList");
        expect(field?.description).toContain("dt-meeting-agent-token");
        expect(field?.placeholder).toBe("dt-meeting-agent-token");
    });

    it("labels Feishu Minutes sign-in choices with the exact fields to paste", () => {
        expect(
            getSourceAuthModeDisplayLabel("oauth-device-flow", "zh-CN"),
        ).toBe("开放平台 user_access_token");
        expect(getSourceAuthModeDisplayLabel("web-reverse", "zh-CN")).toBe(
            "space_name + Cookie",
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
            label: "FEISHU_APP_ID / app_id",
            placeholder: "cli_xxx",
        });
        expect(tokenFields[0]?.description).toContain("app_id");
        expect(tokenFields[1]).toMatchObject({
            label: "user_access_token",
            placeholder: "user_access_token",
        });
        expect(tokenFields[1]?.description).toContain("user_access_token");
        expect(fields[0]).toMatchObject({
            label: "space_name",
            placeholder: "cn",
        });
        expect(fields[1]).toMatchObject({
            label: "Cookie",
            placeholder: "Cookie: minutes_csrf_token=...",
        });
        expect(fields[1]?.description).toContain("list?size=");
        expect(fields[1]?.description).toContain("minutes_csrf_token=");
        expect(fields[2]).toMatchObject({
            label: "X-Feishu-Minutes-Token（可选）",
            placeholder: "X-Feishu-Minutes-Token",
        });
        expect(fields[2]?.description).toContain("X-Feishu-Minutes-Token");
    });

    it("labels Plaud sign-in inputs with the exact request field to paste", () => {
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
                "Plaud Authorization",
            ]),
        );
        expect(
            fields.find((field) => field.key === "bearerToken")?.placeholder,
        ).toBe("••••••••••••••••");
        expect(
            fields.find((field) => field.key === "bearerToken")?.description,
        ).toContain("Authorization");
    });

    it("labels iFLYTEK and TicNote inputs with the exact fields to paste", () => {
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

        expect(iflyrecFields[0]?.label).toBe("X-Biz-Id");
        expect(iflyrecFields[0]?.description).toContain("X-Biz-Id");
        expect(iflyrecFields[1]?.label).toBe("X-Session-Id");
        expect(iflyrecFields[1]?.description).toContain("X-Session-Id");
        expect(
            ticnoteFields.find((field) => field.key === "bearerToken"),
        ).toMatchObject({
            label: "TicNote Authorization / tic_token",
            placeholder: "••••••••••••••••",
        });
        expect(
            ticnoteFields.find((field) => field.key === "bearerToken")
                ?.description,
        ).toContain("Authorization");
        expect(
            ticnoteFields.find((field) => field.key === "bearerToken")
                ?.description,
        ).toContain("localStorage.tic_token");
        expect(ticnoteFields.some((field) => field.key === "language")).toBe(
            false,
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
