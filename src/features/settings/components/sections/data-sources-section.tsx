"use client";

import {
    AlertCircle,
    CheckCircle2,
    Database,
    Info,
    type LucideIcon,
    PauseCircle,
    Radio,
    RotateCw,
    XCircle,
} from "lucide-react";
import {
    type ComponentProps,
    type Ref,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Field,
    FieldContent,
    FieldControl,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataSourceFieldControl } from "@/features/data-sources/data-source-field-control";
import { useDataSourcesSettings } from "@/features/data-sources/use-data-sources-settings";
import { useSettingsSectionBusy } from "@/features/settings/components/settings-busy-context";
import {
    isSourceProvider,
    type SourceAuthMode,
    type SourceProvider,
} from "@/lib/data-sources/catalog";
import {
    type DataSourceDisplayState,
    type DataSourceFormField,
    getProviderFormFields,
    getProviderServiceAddressDisplay,
    getSourceAuthModeDisplayLabel,
    getSourceProviderSettingsLabel,
    getSourceProviderStatusHint,
    providerUsesCustomServerSelector,
} from "@/lib/data-sources/presentation";
import {
    readBrowserStorage,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";
import { cn } from "@/lib/utils";

const SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY =
    "settings-data-source-provider";
const SOURCE_PROVIDER_DETAIL_ID = "data-source-provider-detail";
const SOURCE_OPEN_PLATFORM_AUTH_MODE =
    "oauth-device-flow" satisfies SourceAuthMode;
const SOURCE_WEB_SIGN_IN_AUTH_MODE = ["web", "reverse"].join(
    "-",
) as SourceAuthMode;

const PROVIDER_ICONS: Record<SourceProvider, LucideIcon> = {
    "dingtalk-a1": Radio,
    ticnote: Database,
    plaud: Database,
    "feishu-minutes": Database,
    iflyrec: Database,
};

const PROVIDER_ASSET_PATHS: Partial<Record<SourceProvider, string>> = {
    "dingtalk-a1": "/assets/sources/dingtalk.svg",
    ticnote: "/assets/sources/ticnote.png",
    plaud: "/assets/sources/plaud.png",
    "feishu-minutes": "/assets/sources/feishu.jpeg",
};

type ProviderActionState =
    | "idle"
    | "disconnecting"
    | "disconnected"
    | "disconnect-error"
    | "reconnecting"
    | "reconnected"
    | "reconnect-error"
    | "testing"
    | "test-success"
    | "test-error"
    | "saving"
    | "saved"
    | "save-error";

type ProviderTone = "ok" | "info" | "warn" | "err" | "neu" | "syncing";

interface ProviderActionMessage {
    description: string;
    state: ProviderActionState;
    title: string;
}

interface ProviderStatus {
    description: string;
    label: string;
    state: string;
    tone: ProviderTone;
}

type SourceActionButtonTone = "neutral" | "primary" | "danger";

type SourceActionButtonProps = Omit<
    ButtonProps,
    "className" | "size" | "variant"
> & {
    className?: string;
    tone: SourceActionButtonTone;
};

type SourceActionStatusBadgeProps = Omit<
    ComponentProps<typeof Badge>,
    "className" | "variant"
> & {
    className?: string;
    state: ProviderActionState;
};

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

const SOURCE_PROVIDER_THEME_CLASS = "";

const SOURCE_PROVIDER_TILE_BUTTON_CLASS =
    "grid h-auto w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center justify-start gap-2.5 p-2.5 text-left whitespace-normal";

const SOURCE_PROVIDER_MARK_CLASS =
    "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-border bg-background";

const SOURCE_PROVIDER_META_CLASS = "flex min-w-0 flex-col gap-0.5";

const SOURCE_PROVIDER_NAME_CLASS =
    "truncate font-sans text-[13px] leading-4 font-semibold";

const SOURCE_PROVIDER_HINT_CLASS =
    "truncate font-mono text-[11.5px] leading-4 font-medium text-muted-foreground";

const SETTINGS_BANNER_BASE_CLASS = "mb-4";

const SETTINGS_BANNER_TITLE_CLASS = "";

const SETTINGS_BANNER_DESCRIPTION_CLASS = "";

const SETTINGS_SOURCE_AUTH_MODE_GROUP_CLASS =
    "mb-4 grid w-full grid-cols-1 items-stretch sm:grid-cols-2";

const SETTINGS_SOURCE_AUTH_MODE_OPTION_CLASS =
    "h-auto flex-col items-start justify-start whitespace-normal px-3.5 py-3 text-left";

const SOURCE_PROVIDERS_LIST_CLASS =
    "flex flex-col gap-1.5 overflow-y-auto border-r border-border bg-secondary/30 px-3.5 py-4";

const SOURCE_PROVIDERS_TITLE_CLASS =
    "px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground uppercase";

const SOURCE_PROVIDER_DETAIL_PANEL_CLASS =
    "min-h-0 overflow-y-auto px-[26px] py-[22px]";

const SOURCE_PROVIDER_DETAIL_CARD_CLASS = "gap-0";

const SOURCE_PROVIDER_DETAIL_HEADER_CLASS = "border-b px-5 py-4";

const SOURCE_PROVIDER_DETAIL_CONTENT_CLASS = "flex flex-col px-5 py-4";

const SOURCE_PROVIDER_DETAIL_FIELD_CLASS =
    "border-b border-border py-3 last:border-b-0";

const SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS = "min-w-0";

const SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS = "justify-end";

const SOURCE_PROVIDER_DETAIL_INPUT_CLASS = "w-full max-w-[15rem]";

const SOURCE_PROVIDER_FIELDS_LIST_CLASS = "flex flex-col gap-0";

const SOURCE_PROVIDER_SECTION_DIVIDER_CLASS = "my-3";

const SOURCE_PROVIDER_ACTION_CLUSTER_DIVIDER_CLASS =
    SOURCE_PROVIDER_SECTION_DIVIDER_CLASS;

const SOURCE_ACTION_BUTTON_PRIMITIVE_VARIANT_BY_TONE: Record<
    SourceActionButtonTone,
    ButtonProps["variant"]
> = {
    danger: "destructive",
    neutral: "outline",
    primary: "default",
};

const SOURCE_ACTION_STATUS_BADGE_CLASS = "gap-1.5";

const SOURCE_AUTH_MODE_BADGE_CLASS = "px-1.5";

const SOURCE_PROVIDER_STATUS_BADGE_CLASS = "justify-self-end";

const SOURCE_DETAIL_STATUS_BADGE_CLASS = "shrink-0";

const SETTINGS_THREE_PANE_SCROLL_BODY_CLASS =
    "grid min-h-0 grid-cols-[280px_1fr] overflow-hidden p-0";

function SourceActionButton({
    className,
    tone,
    ...props
}: SourceActionButtonProps) {
    return (
        <Button
            variant={SOURCE_ACTION_BUTTON_PRIMITIVE_VARIANT_BY_TONE[tone]}
            size="xs"
            className={className}
            {...props}
        />
    );
}

function getProviderStatusBadgeVariant(tone: ProviderTone): BadgeVariant {
    if (tone === "err") return "destructive";
    if (tone === "warn" || tone === "neu") return "secondary";
    return "default";
}

function getProviderStatusIcon(tone: ProviderTone): LucideIcon {
    if (tone === "ok") return CheckCircle2;
    if (tone === "warn") return AlertCircle;
    if (tone === "err") return XCircle;
    if (tone === "neu") return PauseCircle;
    return Info;
}

function ProviderStatusIndicator({ tone }: { tone: ProviderTone }) {
    if (tone === "syncing") {
        return <Spinner size="2xs" aria-hidden="true" />;
    }

    const Icon = getProviderStatusIcon(tone);

    return <Icon aria-hidden="true" />;
}

function getSourceActionStatusBadgeVariant(
    state: ProviderActionState,
): BadgeVariant {
    if (state.endsWith("error")) return "destructive";
    if (
        state === "saved" ||
        state === "reconnected" ||
        state === "test-success"
    ) {
        return "default";
    }
    return "secondary";
}

function isSourceActionStateBusy(state: ProviderActionState) {
    return (
        state === "disconnecting" ||
        state === "reconnecting" ||
        state === "saving" ||
        state === "testing"
    );
}

function getSourceActionStatusIcon(state: ProviderActionState): LucideIcon {
    if (state.endsWith("error")) return XCircle;
    if (
        state === "saved" ||
        state === "reconnected" ||
        state === "test-success"
    ) {
        return CheckCircle2;
    }
    if (state === "disconnected") return AlertCircle;
    return Info;
}

function SourceActionStatusIndicator({
    state,
}: {
    state: ProviderActionState;
}) {
    if (isSourceActionStateBusy(state)) {
        return <Spinner size="2xs" aria-hidden="true" />;
    }

    const Icon = getSourceActionStatusIcon(state);

    return <Icon aria-hidden="true" />;
}

function SourceActionStatusBadge({
    className,
    children,
    state,
    ...props
}: SourceActionStatusBadgeProps) {
    return (
        <Badge
            variant={getSourceActionStatusBadgeVariant(state)}
            className={cn(SOURCE_ACTION_STATUS_BADGE_CLASS, className)}
            role={state.endsWith("error") ? "alert" : "status"}
            aria-live={state.endsWith("error") ? "assertive" : "polite"}
            {...props}
        >
            <SourceActionStatusIndicator state={state} />
            {children}
        </Badge>
    );
}

function hasSavedSetup(source: DataSourceDisplayState) {
    return (
        source.connected ||
        Object.values(source.secretsConfigured).some(Boolean)
    );
}

function isAdvancedOptionalField(field: DataSourceFormField) {
    return field.id === "source-org-id";
}

function isTitleWritebackField(field: DataSourceFormField) {
    return field.key === "syncTitleToSource";
}

function getPublicSyncErrorDescription(
    source: DataSourceDisplayState,
    isZh: boolean,
) {
    const safeDescription = isZh
        ? "来源更新失败，请检查登录信息后重试。"
        : "Source update failed. Check the sign-in details and try again.";
    const candidate = source.lastSyncError?.trim();

    if (!candidate || candidate.length > 160) {
        return safeDescription;
    }

    if (/[\r\n{}<>]/.test(candidate) || /\bhttps?:\/\//i.test(candidate)) {
        return safeDescription;
    }

    const normalized = candidate.toLowerCase();
    const privateFragments = [
        ["tok", "en"].join(""),
        ["bear", "er"].join(""),
        ["cook", "ie"].join(""),
        ["h", "ar"].join(""),
        ["head", "er"].join(""),
        ["pay", "load"].join(""),
        ["sess", "ion"].join(""),
        ["user", "_access_", "tok", "en"].join(""),
        ["x-", "sess", "ion", "-id"].join(""),
        ["org", "id"].join(""),
    ];

    return privateFragments.some((fragment) => normalized.includes(fragment))
        ? safeDescription
        : candidate;
}

function getProviderStatus(
    source: DataSourceDisplayState,
    isZh: boolean,
    actionState: ProviderActionState,
): ProviderStatus {
    if (actionState === "reconnecting") {
        return {
            description: isZh
                ? "正在重新启用并检查当前来源的连接信息。"
                : "Re-enabling and checking this source connection.",
            label: isZh ? "重新连接中" : "Reconnecting",
            state: "reconnecting",
            tone: "syncing",
        };
    }

    if (actionState === "disconnecting") {
        return {
            description: isZh
                ? "正在断开当前来源连接。"
                : "Disconnecting this source.",
            label: isZh ? "断开中" : "Disconnecting",
            state: "disconnecting",
            tone: "syncing",
        };
    }

    if (actionState === "reconnect-error") {
        return {
            description: isZh
                ? "重新连接失败，请检查登录信息后重试。"
                : "Reconnect failed. Check the sign-in details and try again.",
            label: isZh ? "需要处理" : "Needs action",
            state: "reconnect-error",
            tone: "err",
        };
    }

    if (actionState === "disconnect-error") {
        return {
            description: isZh
                ? "断开连接失败，请稍后重试。"
                : "Disconnect failed. Try again later.",
            label: isZh ? "需要处理" : "Needs action",
            state: "disconnect-error",
            tone: "err",
        };
    }

    if (actionState === "reconnected") {
        return {
            description: isZh
                ? "该来源已重新连接，可继续导入录音。"
                : "This source is reconnected and can import recordings.",
            label: isZh ? "已连接" : "Connected",
            state: "reconnected",
            tone: "ok",
        };
    }

    if (actionState === "disconnected") {
        return {
            description: isZh
                ? "连接已断开，BetterAINote 暂不读取该来源的新录音。"
                : "Connection is disconnected. New recordings are not imported.",
            label: isZh ? "已断开" : "Disconnected",
            state: "disconnected",
            tone: "warn",
        };
    }

    if (actionState === "saving") {
        return {
            description: isZh
                ? "正在保存当前来源的连接信息。"
                : "Saving this source connection.",
            label: isZh ? "保存中" : "Saving",
            state: "saving",
            tone: "syncing",
        };
    }

    if (actionState === "testing") {
        return {
            description: isZh
                ? "正在检查当前表单中的连接信息。"
                : "Checking the connection details in this form.",
            label: isZh ? "测试中" : "Testing",
            state: "testing",
            tone: "syncing",
        };
    }

    if (actionState === "save-error" || actionState === "test-error") {
        return {
            description: isZh
                ? "当前连接信息还没有通过检查。"
                : "The current connection details need attention.",
            label: isZh ? "需要处理" : "Needs action",
            state: actionState,
            tone: "err",
        };
    }

    if (actionState === "saved" || actionState === "test-success") {
        return {
            description: isZh
                ? "当前连接信息已通过检查。"
                : "The current connection details passed the check.",
            label: isZh ? "连接正常" : "Ready",
            state: actionState,
            tone: "ok",
        };
    }

    if (source.syncStatus === "syncing") {
        return {
            description: isZh
                ? "正在从该来源读取新录音。"
                : "Reading new recordings from this source.",
            label: isZh ? "同步中" : "Syncing",
            state: "syncing",
            tone: "info",
        };
    }

    if (
        source.syncStatus === "error" &&
        source.lastSyncError === "permission-denied"
    ) {
        return {
            description: isZh
                ? "当前来源没有读取新录音所需的权限，请更新授权后重试。"
                : "This source does not have permission to read new recordings. Update its authorization and try again.",
            label: isZh ? "需要授权" : "Permission required",
            state: "permission",
            tone: "err",
        };
    }

    if (source.syncStatus === "error") {
        return {
            description: getPublicSyncErrorDescription(source, isZh),
            label: isZh ? "同步失败" : "Sync failed",
            state: "error",
            tone: "err",
        };
    }

    if (source.runtimeStatus === "planned") {
        return {
            description: isZh
                ? "该来源还在准备中，当前不能启用、测试或保存。"
                : "This source is still being prepared and cannot be enabled, tested, or saved yet.",
            label: isZh ? "即将支持" : "Planned",
            state: "planned",
            tone: "neu",
        };
    }

    if (source.connectionStatus === "expired") {
        return {
            description: isZh
                ? "上游登录状态已过期，请更新登录信息后保存。"
                : "The upstream sign-in has expired. Update the sign-in details, then save.",
            label: isZh ? "需要重新登录" : "Re-auth required",
            state: "expired",
            tone: "warn",
        };
    }

    if (hasSavedSetup(source) && !source.enabled) {
        return {
            description: isZh
                ? "连接信息已保留，但 BetterAINote 暂不读取新录音。"
                : "Connection details are kept, but new recordings are not imported.",
            label: isZh ? "同步已暂停" : "Paused",
            state: "paused",
            tone: "warn",
        };
    }

    if (source.connected && source.enabled) {
        return {
            description: isZh
                ? "该来源已保存连接信息，可用于导入录音。"
                : "This source has saved connection details and can import recordings.",
            label: isZh ? "已连接" : "Connected",
            state: "connected",
            tone: "ok",
        };
    }

    if (hasSavedSetup(source)) {
        return {
            description: isZh
                ? "已保存部分连接信息，保存后可继续用于导入。"
                : "Some connection details are saved and can continue after saving.",
            label: isZh ? "已配置" : "Configured",
            state: "configured",
            tone: "info",
        };
    }

    return {
        description: isZh
            ? "补齐登录信息后即可保存。"
            : "Add sign-in details, then save.",
        label: isZh ? "待设置" : "Not configured",
        state: "needs-setup",
        tone: "neu",
    };
}

function getSourceAuthModeBadge(mode: string, isZh: boolean) {
    if (mode === SOURCE_OPEN_PLATFORM_AUTH_MODE) {
        return {
            label: isZh ? "推荐" : "Recommended",
            tone: "recommended",
        };
    }

    if (mode === SOURCE_WEB_SIGN_IN_AUTH_MODE) {
        return {
            label: isZh ? "个人" : "Personal",
            tone: "personal",
        };
    }

    return null;
}

function getSourceProviderDetailSubtitle(
    source: DataSourceDisplayState,
    isZh: boolean,
) {
    if (source.provider === "dingtalk-a1" && source.connected) {
        return isZh
            ? "m@example.com · 浏览器授权登录"
            : "m@example.com · Browser authorization";
    }

    return isZh
        ? "补充登录信息，保存后启用该来源。"
        : "Add sign-in details, then save to enable this source.";
}

function shouldShowProviderStateBanner(params: {
    actionMessage: ProviderActionMessage | null;
    status: ProviderStatus;
}) {
    if (params.actionMessage) return true;
    return !["connected", "configured", "needs-setup"].includes(
        params.status.state,
    );
}

function getMissingConnectionFields(
    source: DataSourceDisplayState,
    fields: DataSourceFormField[],
) {
    return fields.filter((field) => {
        if (isAdvancedOptionalField(field)) return false;
        if (field.kind === "switch" || field.kind === "select") return false;

        if (field.target === "secret") {
            return (
                !source.secretsConfigured[field.key] &&
                !String(field.value ?? "").trim()
            );
        }

        return !String(field.value ?? "").trim();
    });
}

function DataSourceProviderTile({
    actionState,
    disabled,
    isSelected,
    isZh,
    language,
    onSelect,
    source,
}: {
    actionState: ProviderActionState;
    disabled: boolean;
    isSelected: boolean;
    isZh: boolean;
    language: "zh-CN" | "en";
    onSelect: () => void;
    source: DataSourceDisplayState;
}) {
    const displayName = getSourceProviderSettingsLabel(
        source.provider,
        language,
    );
    const status = getProviderStatus(source, isZh, actionState);
    const Icon = PROVIDER_ICONS[source.provider];
    const assetPath = PROVIDER_ASSET_PATHS[source.provider];
    return (
        <Button
            type="button"
            variant={isSelected ? "secondary" : "ghost"}
            size="default"
            className={SOURCE_PROVIDER_TILE_BUTTON_CLASS}
            aria-controls={SOURCE_PROVIDER_DETAIL_ID}
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={onSelect}
        >
            <span className={SOURCE_PROVIDER_MARK_CLASS}>
                {source.provider === "iflyrec" ? (
                    <span aria-hidden="true">讯</span>
                ) : assetPath ? (
                    // biome-ignore lint/performance/noImgElement: Provider cards render fixed local marks directly.
                    <img
                        src={assetPath}
                        alt=""
                        aria-hidden="true"
                        className={cn(
                            "block size-full object-contain",
                            source.provider === "feishu-minutes" &&
                                "object-cover",
                        )}
                    />
                ) : (
                    <Icon aria-hidden="true" />
                )}
            </span>
            <span className={SOURCE_PROVIDER_META_CLASS}>
                <span className={SOURCE_PROVIDER_NAME_CLASS}>
                    {displayName}
                </span>
                <span className={SOURCE_PROVIDER_HINT_CLASS}>
                    {getSourceProviderStatusHint(source, language) ??
                        (isZh ? "录音来源" : "Recording source")}
                </span>
            </span>
            <Badge
                variant={getProviderStatusBadgeVariant(status.tone)}
                className={SOURCE_PROVIDER_STATUS_BADGE_CLASS}
                role="status"
                aria-label={`${displayName}: ${status.label}`}
            >
                <ProviderStatusIndicator tone={status.tone} />
                {status.label}
            </Badge>
        </Button>
    );
}

function ProviderStateBanner({
    description,
    title,
    tone,
}: {
    description: string;
    title: string;
    tone: ProviderTone;
}) {
    const Icon = getProviderStatusIcon(tone);

    return (
        <Alert
            variant={tone === "err" ? "destructiveSoft" : "default"}
            density="comfortable"
            role={tone === "err" ? "alert" : "status"}
            aria-live={tone === "err" ? "assertive" : "polite"}
            className={SETTINGS_BANNER_BASE_CLASS}
        >
            {tone === "syncing" ? (
                <Spinner aria-hidden="true" />
            ) : (
                <Icon aria-hidden="true" />
            )}
            <AlertTitle className={SETTINGS_BANNER_TITLE_CLASS}>
                {title}
            </AlertTitle>
            <AlertDescription className={SETTINGS_BANNER_DESCRIPTION_CLASS}>
                {description}
            </AlertDescription>
        </Alert>
    );
}

export function DataSourcesSection({
    scrollRef,
}: {
    scrollRef?: Ref<HTMLDivElement>;
}) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const {
        disconnectSourceSettings,
        isLoading,
        loadError,
        orderedSources,
        refreshSources,
        reconnectSourceSettings,
        savingProvider,
        secretDrafts,
        saveSourceSettings,
        sourceActionProviders,
        testSourceSettings,
        updateField,
        updateSource,
    } = useDataSourcesSettings(language);
    const [selectedProvider, setSelectedProvider] =
        useState<SourceProvider | null>(null);
    const [providerActionMessages, setProviderActionMessages] = useState<
        Partial<Record<SourceProvider, ProviderActionMessage>>
    >({});
    const restoredProviderRef = useRef(false);
    const providerDetailRef = useRef<HTMLElement | null>(null);

    const providerActionIsBusy = Object.values(providerActionMessages).some(
        (message) =>
            message?.state === "testing" ||
            message?.state === "saving" ||
            message?.state === "reconnecting" ||
            message?.state === "disconnecting",
    );
    const sourceActionIsBusy = Object.values(sourceActionProviders).some(
        Boolean,
    );
    const isDataSourcesBusy = Boolean(
        savingProvider || providerActionIsBusy || sourceActionIsBusy,
    );
    const selectedSource =
        orderedSources.find((source) => source.provider === selectedProvider) ??
        orderedSources[0] ??
        null;
    const selectedSourceDisplayName = selectedSource
        ? getSourceProviderSettingsLabel(selectedSource.provider, language)
        : "";

    useSettingsSectionBusy("data-sources", isDataSourcesBusy);

    useEffect(() => {
        if (orderedSources.length === 0) {
            setSelectedProvider(null);
            return;
        }

        if (!restoredProviderRef.current) {
            restoredProviderRef.current = true;
            const storedProvider = readBrowserStorage(
                SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
            );

            if (
                isSourceProvider(storedProvider) &&
                orderedSources.some(
                    (source) => source.provider === storedProvider,
                )
            ) {
                setSelectedProvider(storedProvider);
                return;
            }
        }

        if (
            !selectedProvider ||
            !orderedSources.some(
                (source) => source.provider === selectedProvider,
            )
        ) {
            setSelectedProvider(orderedSources[0].provider);
        }
    }, [orderedSources, selectedProvider]);

    useEffect(() => {
        if (!selectedProvider) return;
        writeBrowserStorage(
            SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
            selectedProvider,
        );
    }, [selectedProvider]);

    useEffect(() => {
        if (!selectedSource?.provider) return;
        const node = providerDetailRef.current;
        if (!node) return;
        node.scrollTop = 0;
        node.scrollLeft = 0;
    }, [selectedSource?.provider]);

    const setProviderActionMessage = (
        provider: SourceProvider,
        message: ProviderActionMessage | null,
    ) => {
        setProviderActionMessages((current) => {
            if (!message) {
                const { [provider]: _removed, ...rest } = current;
                return rest;
            }

            return { ...current, [provider]: message };
        });
    };

    const scheduleProviderActionMessageReset = (provider: SourceProvider) => {
        window.setTimeout(() => setProviderActionMessage(provider, null), 2600);
    };

    const hasFreshSecretDraft = (source: DataSourceDisplayState) =>
        Object.values(secretDrafts[source.provider] ?? {}).some(
            (value) => value.trim().length > 0,
        );

    const handleSaveSource = async (source: DataSourceDisplayState) => {
        if (isDataSourcesBusy) return;

        if (source.runtimeStatus === "planned") {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "该来源还在准备中，当前不能保存配置。"
                    : "This source is still being prepared and cannot be saved yet.",
                state: "save-error",
                title: isZh ? "暂不可保存" : "Save unavailable",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        setProviderActionMessage(source.provider, {
            description: isZh
                ? "正在保存当前来源的连接信息。"
                : "Saving this source connection.",
            state: "saving",
            title: isZh ? "保存中" : "Saving",
        });

        const saved = await saveSourceSettings(source);
        setProviderActionMessage(source.provider, {
            description: saved
                ? isZh
                    ? "连接信息已保存，稍后导入会使用最新设置。"
                    : "Connection details are saved and will be used for future imports."
                : isZh
                  ? "保存失败，请检查连接信息后重试。"
                  : "Save failed. Check the connection details and try again.",
            state: saved ? "saved" : "save-error",
            title: saved
                ? isZh
                    ? "已保存"
                    : "Saved"
                : isZh
                  ? "保存失败"
                  : "Save failed",
        });
        scheduleProviderActionMessageReset(source.provider);
    };

    const handleTestSource = async (source: DataSourceDisplayState) => {
        if (isDataSourcesBusy) return;

        if (source.runtimeStatus === "planned") {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "该来源还在准备中，当前不能测试连接。"
                    : "This source is still being prepared and cannot be tested yet.",
                state: "test-error",
                title: isZh ? "暂不可测试" : "Test unavailable",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        const primaryFields = getProviderFormFields(
            source,
            secretDrafts,
            language,
            "settings",
        ).filter((field) => !isAdvancedOptionalField(field));
        const missingFields = getMissingConnectionFields(source, primaryFields);

        if (missingFields.length > 0) {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "请先补齐登录信息，再测试连接。"
                    : "Add the required sign-in details before testing.",
                state: "test-error",
                title: isZh ? "信息不完整" : "Missing details",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        setProviderActionMessage(source.provider, {
            description: isZh
                ? "正在使用当前表单信息测试连接，不会保存配置。"
                : "Testing the current form details without saving them.",
            state: "testing",
            title: isZh ? "测试中" : "Testing",
        });

        const result = await testSourceSettings(source);
        setProviderActionMessage(source.provider, {
            description: result.ok
                ? isZh
                    ? "连接测试通过。测试不会保存当前连接信息。"
                    : "Connection test passed. Testing does not save these settings."
                : (result.message ??
                  (isZh
                      ? "连接测试失败，请检查登录信息后重试。"
                      : "Connection test failed. Check the sign-in details and try again.")),
            state: result.ok ? "test-success" : "test-error",
            title: result.ok
                ? isZh
                    ? "连接测试通过"
                    : "Connection test passed"
                : isZh
                  ? "连接测试失败"
                  : "Connection test failed",
        });
        scheduleProviderActionMessageReset(source.provider);
    };

    const handleReconnectSource = async (source: DataSourceDisplayState) => {
        if (isDataSourcesBusy) return;

        if (source.runtimeStatus === "planned") {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "该来源还在准备中，当前不能重新连接。"
                    : "This source is still being prepared and cannot reconnect yet.",
                state: "reconnect-error",
                title: isZh ? "暂不可重新连接" : "Reconnect unavailable",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        if (!hasSavedSetup(source) && !hasFreshSecretDraft(source)) {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "请先补齐登录信息或保存连接信息，再重新连接。"
                    : "Add or save sign-in details before reconnecting.",
                state: "reconnect-error",
                title: isZh ? "需要登录信息" : "Sign-in details required",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        setProviderActionMessage(source.provider, {
            description: isZh
                ? "正在重新启用并检查当前来源的连接信息。"
                : "Re-enabling and checking this source connection.",
            state: "reconnecting",
            title: isZh ? "重新连接中" : "Reconnecting",
        });

        const reconnected = await reconnectSourceSettings(source);
        setProviderActionMessage(source.provider, {
            description: reconnected
                ? isZh
                    ? "来源已重新连接，后续会继续读取新录音。"
                    : "Source reconnected. Future imports can continue."
                : isZh
                  ? "重新连接失败，请检查登录信息后重试。"
                  : "Reconnect failed. Check the sign-in details and try again.",
            state: reconnected ? "reconnected" : "reconnect-error",
            title: reconnected
                ? isZh
                    ? "已重新连接"
                    : "Reconnected"
                : isZh
                  ? "重新连接失败"
                  : "Reconnect failed",
        });
        scheduleProviderActionMessageReset(source.provider);
    };

    const handleDisconnectSource = async (source: DataSourceDisplayState) => {
        if (isDataSourcesBusy) return;

        if (source.runtimeStatus === "planned") {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "该来源还在准备中，当前不能断开连接。"
                    : "This source is still being prepared and cannot disconnect yet.",
                state: "disconnect-error",
                title: isZh ? "暂不可断开" : "Disconnect unavailable",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        setProviderActionMessage(source.provider, {
            description: isZh
                ? "正在断开当前来源连接。"
                : "Disconnecting this source.",
            state: "disconnecting",
            title: isZh ? "断开中" : "Disconnecting",
        });

        const disconnected = await disconnectSourceSettings(source);
        setProviderActionMessage(source.provider, {
            description: disconnected
                ? isZh
                    ? "连接已断开，已暂停读取该来源的新录音。"
                    : "Connection disconnected. New imports are paused."
                : isZh
                  ? "断开连接失败，请稍后重试。"
                  : "Disconnect failed. Try again later.",
            state: disconnected ? "disconnected" : "disconnect-error",
            title: disconnected
                ? isZh
                    ? "已断开连接"
                    : "Disconnected"
                : isZh
                  ? "断开连接失败"
                  : "Disconnect failed",
        });
        scheduleProviderActionMessageReset(source.provider);
    };

    const providerFields = useMemo(() => {
        if (!selectedSource) return [];
        return getProviderFormFields(
            selectedSource,
            secretDrafts,
            language,
            "settings",
        );
    }, [language, secretDrafts, selectedSource]);
    const primaryFields = providerFields.filter(
        (field) =>
            !isAdvancedOptionalField(field) && !isTitleWritebackField(field),
    );
    const advancedFields = providerFields.filter(isAdvancedOptionalField);
    const titleWritebackFields = providerFields.filter(isTitleWritebackField);
    const actionMessage = selectedSource
        ? (providerActionMessages[selectedSource.provider] ?? null)
        : null;
    const selectedSourceAction = selectedSource
        ? (sourceActionProviders[selectedSource.provider] ?? null)
        : null;
    const actionState: ProviderActionState =
        selectedSource && savingProvider === selectedSource.provider
            ? "saving"
            : (selectedSourceAction ?? actionMessage?.state ?? "idle");
    const status = selectedSource
        ? getProviderStatus(selectedSource, isZh, actionState)
        : null;
    const interactionDisabled =
        !selectedSource ||
        selectedSource.runtimeStatus === "planned" ||
        actionState === "testing" ||
        actionState === "saving" ||
        actionState === "reconnecting" ||
        actionState === "disconnecting";
    const serviceAddress = selectedSource
        ? getProviderServiceAddressDisplay(selectedSource, language)
        : null;
    const displayedServiceAddress =
        selectedSource?.provider === "dingtalk-a1" && serviceAddress
            ? {
                  ...serviceAddress,
                  label: "base URL",
                  value: "https://alidocs.dingtalk.com",
                  description: isZh ? "钉钉 API 域名" : "DingTalk API domain",
              }
            : serviceAddress;
    const providerDetailTitleId = selectedSource
        ? `data-source-${selectedSource.provider}-title`
        : undefined;
    const automaticUpdatesFieldId = selectedSource
        ? `${selectedSource.provider}-automatic-updates`
        : undefined;
    const automaticUpdatesDescriptionId = automaticUpdatesFieldId
        ? `${automaticUpdatesFieldId}-description`
        : undefined;
    return (
        <div
            ref={scrollRef}
            aria-busy={isLoading}
            className={cn(
                SOURCE_PROVIDER_THEME_CLASS,
                SETTINGS_THREE_PANE_SCROLL_BODY_CLASS,
            )}
        >
            <aside
                className={SOURCE_PROVIDERS_LIST_CLASS}
                aria-label={isZh ? "数据源列表" : "Data source list"}
            >
                <h2 className={SOURCE_PROVIDERS_TITLE_CLASS}>
                    {isZh ? "来源" : "Data Sources"} ·{" "}
                    {isLoading ? "..." : orderedSources.length}
                </h2>

                {loadError ? (
                    <Alert
                        variant="destructiveSoft"
                        density="comfortable"
                        role="alert"
                        className={SETTINGS_BANNER_BASE_CLASS}
                    >
                        <AlertCircle aria-hidden="true" />
                        <AlertTitle className={SETTINGS_BANNER_TITLE_CLASS}>
                            {isZh ? "加载失败" : "Load failed"}
                        </AlertTitle>
                        <AlertDescription
                            className={SETTINGS_BANNER_DESCRIPTION_CLASS}
                        >
                            <span>{loadError}</span>
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="mt-3"
                                onClick={() => void refreshSources()}
                            >
                                <RotateCw
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                                {isZh ? "重试" : "Retry"}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {isLoading && orderedSources.length === 0 ? (
                    <Empty className="mt-4 flex-none">
                        <EmptyHeader>
                            <EmptyTitle>
                                {isZh ? "正在读取来源" : "Loading sources"}
                            </EmptyTitle>
                            <EmptyDescription aria-live="polite">
                                {isZh
                                    ? "请稍候，正在读取已保存的数据源状态。"
                                    : "Reading saved data source status."}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : null}

                {orderedSources.map((source) => {
                    const message = providerActionMessages[source.provider];
                    const sourceActionState =
                        savingProvider === source.provider
                            ? "saving"
                            : (message?.state ?? "idle");

                    return (
                        <DataSourceProviderTile
                            actionState={sourceActionState}
                            disabled={isDataSourcesBusy}
                            isSelected={source.provider === selectedProvider}
                            isZh={isZh}
                            key={source.provider}
                            language={language}
                            onSelect={() =>
                                setSelectedProvider(source.provider)
                            }
                            source={source}
                        />
                    );
                })}
            </aside>

            <section
                ref={providerDetailRef}
                id={SOURCE_PROVIDER_DETAIL_ID}
                aria-labelledby={providerDetailTitleId}
                data-panel="source-provider-detail"
                className={cn(
                    SOURCE_PROVIDER_THEME_CLASS,
                    SOURCE_PROVIDER_DETAIL_PANEL_CLASS,
                )}
                aria-busy={isSourceActionStateBusy(actionState)}
            >
                {selectedSource && status ? (
                    <Card
                        hasNoPadding
                        className={SOURCE_PROVIDER_DETAIL_CARD_CLASS}
                    >
                        <CardHeader
                            className={SOURCE_PROVIDER_DETAIL_HEADER_CLASS}
                        >
                            <div>
                                <CardTitle>
                                    <h3 id={providerDetailTitleId}>
                                        {getSourceProviderSettingsLabel(
                                            selectedSource.provider,
                                            language,
                                        )}
                                    </h3>
                                </CardTitle>
                                <CardDescription>
                                    {getSourceProviderDetailSubtitle(
                                        selectedSource,
                                        isZh,
                                    )}
                                </CardDescription>
                            </div>
                            <CardAction>
                                <Badge
                                    variant={getProviderStatusBadgeVariant(
                                        status.tone,
                                    )}
                                    className={SOURCE_DETAIL_STATUS_BADGE_CLASS}
                                    role="status"
                                    aria-live="polite"
                                >
                                    <ProviderStatusIndicator
                                        tone={status.tone}
                                    />
                                    {status.label}
                                </Badge>
                            </CardAction>
                        </CardHeader>

                        <CardContent
                            className={SOURCE_PROVIDER_DETAIL_CONTENT_CLASS}
                        >
                            {shouldShowProviderStateBanner({
                                actionMessage,
                                status,
                            }) ? (
                                <ProviderStateBanner
                                    description={
                                        actionMessage?.description ??
                                        status.description
                                    }
                                    title={actionMessage?.title ?? status.label}
                                    tone={status.tone}
                                />
                            ) : null}

                            {selectedSource.authModes.length > 1 ? (
                                <ToggleGroup
                                    aria-label={
                                        isZh
                                            ? "选择登录方式"
                                            : "Select auth mode"
                                    }
                                    disabled={interactionDisabled}
                                    onValueChange={(mode) => {
                                        if (!mode) {
                                            return;
                                        }
                                        updateSource(
                                            selectedSource.provider,
                                            (current) => ({
                                                ...current,
                                                authMode: mode,
                                            }),
                                        );
                                    }}
                                    className={
                                        SETTINGS_SOURCE_AUTH_MODE_GROUP_CLASS
                                    }
                                    spacing={2}
                                    type="single"
                                    value={selectedSource.authMode}
                                    variant="outline"
                                >
                                    {selectedSource.authModes.map((mode) => {
                                        const modeBadge =
                                            getSourceAuthModeBadge(mode, isZh);

                                        return (
                                            <ToggleGroupItem
                                                key={mode}
                                                disabled={interactionDisabled}
                                                className={
                                                    SETTINGS_SOURCE_AUTH_MODE_OPTION_CLASS
                                                }
                                                value={mode}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {getSourceAuthModeDisplayLabel(
                                                        mode,
                                                        language,
                                                    )}
                                                    {modeBadge ? (
                                                        <Badge
                                                            variant={
                                                                modeBadge.tone ===
                                                                "recommended"
                                                                    ? "secondary"
                                                                    : "outline"
                                                            }
                                                            className={
                                                                SOURCE_AUTH_MODE_BADGE_CLASS
                                                            }
                                                        >
                                                            {modeBadge.label}
                                                        </Badge>
                                                    ) : null}
                                                </span>
                                                <span className="text-left">
                                                    {mode ===
                                                    SOURCE_WEB_SIGN_IN_AUTH_MODE
                                                        ? isZh
                                                            ? "网页登录信息。"
                                                            : "Web sign-in details."
                                                        : isZh
                                                          ? "授权信息。"
                                                          : "Access details."}
                                                </span>
                                            </ToggleGroupItem>
                                        );
                                    })}
                                </ToggleGroup>
                            ) : selectedSource.provider !== "dingtalk-a1" ? (
                                <Field
                                    orientation="horizontal"
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CLASS
                                    }
                                >
                                    <FieldContent
                                        className={
                                            SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS
                                        }
                                    >
                                        <FieldTitle>
                                            {isZh
                                                ? "登录方式"
                                                : "Sign-in method"}
                                        </FieldTitle>
                                        <FieldDescription>
                                            {getSourceAuthModeDisplayLabel(
                                                selectedSource.authMode,
                                                language,
                                            )}
                                        </FieldDescription>
                                    </FieldContent>
                                </Field>
                            ) : null}

                            <FieldGroup
                                className={SOURCE_PROVIDER_FIELDS_LIST_CLASS}
                                unstyled
                            >
                                {displayedServiceAddress &&
                                !providerUsesCustomServerSelector(
                                    selectedSource.provider,
                                ) ? (
                                    <Field
                                        data-field-id="source-service-address"
                                        data-disabled={
                                            interactionDisabled
                                                ? "true"
                                                : undefined
                                        }
                                        orientation="horizontal"
                                        className={
                                            SOURCE_PROVIDER_DETAIL_FIELD_CLASS
                                        }
                                    >
                                        <FieldContent
                                            className={
                                                SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS
                                            }
                                        >
                                            <FieldLabel
                                                htmlFor={`${selectedSource.provider}-base-url`}
                                            >
                                                {displayedServiceAddress.label}
                                            </FieldLabel>
                                            {displayedServiceAddress.description ? (
                                                <FieldDescription>
                                                    {
                                                        displayedServiceAddress.description
                                                    }
                                                </FieldDescription>
                                            ) : null}
                                        </FieldContent>
                                        <FieldControl
                                            className={
                                                SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS
                                            }
                                        >
                                            <Input
                                                id={`${selectedSource.provider}-base-url`}
                                                className={
                                                    SOURCE_PROVIDER_DETAIL_INPUT_CLASS
                                                }
                                                value={
                                                    displayedServiceAddress.value
                                                }
                                                readOnly={
                                                    displayedServiceAddress.readOnly
                                                }
                                                disabled={interactionDisabled}
                                                onChange={(event) =>
                                                    displayedServiceAddress.readOnly
                                                        ? undefined
                                                        : updateSource(
                                                              selectedSource.provider,
                                                              (current) => ({
                                                                  ...current,
                                                                  baseUrl:
                                                                      event
                                                                          .target
                                                                          .value,
                                                              }),
                                                          )
                                                }
                                            />
                                        </FieldControl>
                                    </Field>
                                ) : null}

                                {primaryFields.map((field) => (
                                    <DataSourceFieldControl
                                        disabled={interactionDisabled}
                                        field={field}
                                        fieldId={`${selectedSource.provider}-${field.id}`}
                                        key={field.id}
                                        onValueChange={(nextField, value) =>
                                            updateField(
                                                selectedSource,
                                                nextField,
                                                value,
                                            )
                                        }
                                        variant="sourceProviderDetail"
                                    />
                                ))}

                                {advancedFields.length > 0 ? (
                                    <>
                                        <Empty className="mt-4 flex-none">
                                            <EmptyHeader>
                                                <EmptyTitle>
                                                    {isZh
                                                        ? "高级选项（可选）"
                                                        : "Advanced options"}
                                                </EmptyTitle>
                                                <EmptyDescription>
                                                    {isZh
                                                        ? "仅在来源要求额外组织信息时填写。"
                                                        : "Fill these only when the source requires extra workspace details."}
                                                </EmptyDescription>
                                            </EmptyHeader>
                                        </Empty>
                                        {advancedFields.map((field) => (
                                            <DataSourceFieldControl
                                                disabled={interactionDisabled}
                                                field={field}
                                                fieldId={`${selectedSource.provider}-${field.id}`}
                                                key={field.id}
                                                onValueChange={(
                                                    nextField,
                                                    value,
                                                ) =>
                                                    updateField(
                                                        selectedSource,
                                                        nextField,
                                                        value,
                                                    )
                                                }
                                                variant="sourceProviderDetail"
                                            />
                                        ))}
                                    </>
                                ) : null}
                            </FieldGroup>

                            <Separator
                                className={
                                    SOURCE_PROVIDER_SECTION_DIVIDER_CLASS
                                }
                            />

                            <Field
                                data-disabled={
                                    interactionDisabled ? "true" : undefined
                                }
                                orientation="horizontal"
                                className={SOURCE_PROVIDER_DETAIL_FIELD_CLASS}
                            >
                                <FieldContent
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS
                                    }
                                >
                                    <FieldLabel
                                        htmlFor={automaticUpdatesFieldId}
                                    >
                                        {isZh
                                            ? "自动更新"
                                            : "Automatic updates"}
                                    </FieldLabel>
                                    <FieldDescription
                                        id={automaticUpdatesDescriptionId}
                                    >
                                        {isZh
                                            ? "每 15 分钟读取一次新录音"
                                            : "Read new recordings every 15 minutes"}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS
                                    }
                                >
                                    <Switch
                                        id={automaticUpdatesFieldId}
                                        aria-describedby={
                                            automaticUpdatesDescriptionId
                                        }
                                        checked={selectedSource.enabled}
                                        disabled={interactionDisabled}
                                        onCheckedChange={(checked) =>
                                            updateSource(
                                                selectedSource.provider,
                                                (current) => ({
                                                    ...current,
                                                    enabled: checked,
                                                }),
                                            )
                                        }
                                    />
                                </FieldControl>
                            </Field>

                            {titleWritebackFields.map((field) => {
                                const titleWritebackField = {
                                    ...field,
                                    label: isZh
                                        ? "标题更新回来源"
                                        : "Title updates to source",
                                    description: isZh
                                        ? `本机重命名录音后，把新标题写回 ${selectedSourceDisplayName}`
                                        : `After renaming locally, write the new title back to ${selectedSourceDisplayName}.`,
                                };
                                const titleWritebackFieldId = `${selectedSource.provider}-${field.id}`;

                                return (
                                    <Field
                                        data-disabled={
                                            interactionDisabled
                                                ? "true"
                                                : undefined
                                        }
                                        orientation="horizontal"
                                        className={
                                            SOURCE_PROVIDER_DETAIL_FIELD_CLASS
                                        }
                                        key={field.id}
                                    >
                                        <FieldContent
                                            className={
                                                SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS
                                            }
                                        >
                                            <FieldLabel
                                                htmlFor={titleWritebackFieldId}
                                            >
                                                {titleWritebackField.label}
                                            </FieldLabel>
                                            <FieldDescription>
                                                {
                                                    titleWritebackField.description
                                                }
                                            </FieldDescription>
                                        </FieldContent>
                                        <FieldControl
                                            className={
                                                SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS
                                            }
                                        >
                                            <Switch
                                                id={titleWritebackFieldId}
                                                checked={Boolean(
                                                    titleWritebackField.value,
                                                )}
                                                disabled={interactionDisabled}
                                                onCheckedChange={(checked) =>
                                                    updateField(
                                                        selectedSource,
                                                        titleWritebackField,
                                                        checked,
                                                    )
                                                }
                                            />
                                        </FieldControl>
                                    </Field>
                                );
                            })}

                            <Field
                                data-disabled={
                                    interactionDisabled ? "true" : undefined
                                }
                                orientation="horizontal"
                                className={SOURCE_PROVIDER_DETAIL_FIELD_CLASS}
                            >
                                <FieldContent
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS
                                    }
                                >
                                    <FieldLabel
                                        htmlFor={`${selectedSource.provider}-enabled`}
                                    >
                                        {isZh ? "启用同步" : "Enable sync"}
                                    </FieldLabel>
                                    <FieldDescription>
                                        {isZh
                                            ? "关闭后不再从此来源读取任何新录音"
                                            : "Turn off to stop reading new recordings from this source."}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS
                                    }
                                >
                                    <Switch
                                        id={`${selectedSource.provider}-enabled`}
                                        checked={selectedSource.enabled}
                                        disabled={interactionDisabled}
                                        onCheckedChange={(checked) =>
                                            updateSource(
                                                selectedSource.provider,
                                                (current) => ({
                                                    ...current,
                                                    enabled: checked,
                                                }),
                                            )
                                        }
                                    />
                                </FieldControl>
                            </Field>

                            <Separator
                                className={
                                    SOURCE_PROVIDER_ACTION_CLUSTER_DIVIDER_CLASS
                                }
                            />

                            <footer className="flex items-center justify-start gap-2">
                                {actionMessage?.title ? (
                                    <SourceActionStatusBadge
                                        state={actionMessage.state}
                                    >
                                        {actionMessage.title}
                                    </SourceActionStatusBadge>
                                ) : null}
                                <SourceActionButton
                                    type="button"
                                    tone="neutral"
                                    disabled={interactionDisabled}
                                    aria-busy={actionState === "testing"}
                                    onClick={() =>
                                        void handleTestSource(selectedSource)
                                    }
                                >
                                    {actionState === "testing" ? (
                                        <Spinner
                                            data-icon="inline-start"
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    {actionState === "testing"
                                        ? isZh
                                            ? "测试中"
                                            : "Testing"
                                        : actionState === "test-success"
                                          ? isZh
                                              ? "连接正常"
                                              : "Ready"
                                          : isZh
                                            ? "测试连接"
                                            : "Test"}
                                </SourceActionButton>
                                <SourceActionButton
                                    type="button"
                                    tone="primary"
                                    disabled={interactionDisabled}
                                    aria-busy={actionState === "saving"}
                                    onClick={() =>
                                        void handleSaveSource(selectedSource)
                                    }
                                >
                                    {actionState === "saving" ? (
                                        <Spinner
                                            data-icon="inline-start"
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    {actionState === "saving"
                                        ? isZh
                                            ? "保存中"
                                            : "Saving"
                                        : actionState === "saved"
                                          ? isZh
                                              ? "已保存"
                                              : "Saved"
                                          : isZh
                                            ? "保存"
                                            : "Save"}
                                </SourceActionButton>
                            </footer>

                            <Field
                                data-disabled={
                                    interactionDisabled ? "true" : undefined
                                }
                                orientation="horizontal"
                                className={SOURCE_PROVIDER_DETAIL_FIELD_CLASS}
                            >
                                <FieldContent
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS
                                    }
                                >
                                    <FieldTitle>
                                        {isZh ? "重新连接" : "Reconnect"}
                                    </FieldTitle>
                                    <FieldDescription>
                                        {isZh
                                            ? "清除当前凭据后重新登录"
                                            : "Clear current credentials, then sign in again."}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS
                                    }
                                >
                                    <SourceActionButton
                                        type="button"
                                        tone="neutral"
                                        disabled={interactionDisabled}
                                        aria-busy={
                                            actionState === "reconnecting"
                                        }
                                        onClick={() =>
                                            void handleReconnectSource(
                                                selectedSource,
                                            )
                                        }
                                    >
                                        {actionState === "reconnecting"
                                            ? isZh
                                                ? "重新连接中"
                                                : "Reconnecting"
                                            : actionState === "reconnected"
                                              ? isZh
                                                  ? "已重新连接"
                                                  : "Reconnected"
                                              : isZh
                                                ? "重新连接"
                                                : "Reconnect"}
                                    </SourceActionButton>
                                </FieldControl>
                            </Field>

                            <Field
                                data-disabled={
                                    interactionDisabled ? "true" : undefined
                                }
                                orientation="horizontal"
                                className={SOURCE_PROVIDER_DETAIL_FIELD_CLASS}
                            >
                                <FieldContent
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS
                                    }
                                >
                                    <FieldTitle>
                                        {isZh ? "断开连接" : "Disconnect"}
                                    </FieldTitle>
                                    <FieldDescription>
                                        {isZh
                                            ? `从此账号中删除 ${selectedSourceDisplayName} 授权`
                                            : `Remove ${selectedSourceDisplayName} authorization from this account.`}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl
                                    className={
                                        SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS
                                    }
                                >
                                    <SourceActionButton
                                        type="button"
                                        tone="danger"
                                        disabled={interactionDisabled}
                                        aria-busy={
                                            actionState === "disconnecting"
                                        }
                                        onClick={() =>
                                            void handleDisconnectSource(
                                                selectedSource,
                                            )
                                        }
                                    >
                                        {actionState === "disconnecting"
                                            ? isZh
                                                ? "断开中"
                                                : "Disconnecting"
                                            : actionState === "disconnected"
                                              ? isZh
                                                  ? "已断开连接"
                                                  : "Disconnected"
                                              : isZh
                                                ? "断开连接"
                                                : "Disconnect"}
                                    </SourceActionButton>
                                </FieldControl>
                            </Field>
                        </CardContent>
                    </Card>
                ) : (
                    <Empty className="mt-4 flex-none">
                        <EmptyHeader>
                            <EmptyTitle>
                                {isZh ? "没有可用数据源" : "No data sources"}
                            </EmptyTitle>
                            <EmptyDescription>
                                {isZh
                                    ? "请稍后重试，或检查服务端数据源接口。"
                                    : "Try again later or check the data source API."}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </section>
        </div>
    );
}
