"use client";

import {
    AlertCircle,
    CheckCircle2,
    Database,
    Info,
    LoaderCircle,
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
    FieldError,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataSourceFieldControl } from "@/features/data-sources/data-source-field-control";
import { useDataSourcesSettings } from "@/features/data-sources/use-data-sources-settings";
import { SpeakerProfilesPanel } from "@/features/settings/components/sections/speaker-profiles-panel";
import { useSettingsSectionBusy } from "@/features/settings/components/settings-busy-context";
import { SettingsSectionSkeleton } from "@/features/settings/components/settings-skeletons";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import { usePlaybackSettingsStore } from "@/features/settings/playback-settings-store";
import { useSyncSettingsStore } from "@/features/settings/sync-settings-store";
import { useTitleGenerationSettingsStore } from "@/features/settings/title-generation-settings-store";
import { useTranscriptionSettingsStore } from "@/features/settings/transcription-settings-store";
import { useVoScriptSettingsStore } from "@/features/settings/voscript-settings-store";
import {
    isSourceProvider,
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
import type { UiLanguage } from "@/lib/i18n";
import {
    readBrowserStorage,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";
import { cn } from "@/lib/utils";
import type {
    DisplayDensity,
    DisplaySettings,
    RecordingListSortOrder,
    ThemeMode,
} from "@/services/display-settings";
import type {
    PlaybackSettings,
    PlaybackSpeed,
} from "@/services/playback-settings";
import { PLAYBACK_SPEED_OPTIONS } from "@/services/playback-settings";
import type { SyncSettings } from "@/services/sync-settings";
import { MIN_SYNC_INTERVAL_SECONDS } from "@/services/sync-settings";
import type {
    TitleGenerationSettings,
    TitleGenerationSettingsUpdate,
} from "@/services/title-generation-settings";
import type { TranscriptionSettings } from "@/services/transcription-settings";
import type {
    VoScriptDenoiseModel,
    VoScriptSettings,
    VoScriptSettingsUpdate,
} from "@/services/voscript-settings";
import { testVoScriptConnection } from "@/services/voscript-settings";
import type { SettingsSection } from "@/types/settings";

interface SettingsContentProps {
    activeSection: SettingsSection;
    scrollRef?: Ref<HTMLDivElement>;
}

const SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY =
    "settings-data-source-provider";

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
type VoScriptConnectionTestState =
    | "idle"
    | "testing"
    | "test-success"
    | "test-error";

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
};

const SOURCE_ACTION_BUTTON_SIZE_CLASS =
    "h-[26px] gap-[7px] rounded-[7px] px-[10px] text-[12px] font-semibold leading-[normal] has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[11px]";

const SOURCE_ACTION_BUTTON_PRIMITIVE_VARIANT_BY_TONE: Record<
    SourceActionButtonTone,
    ButtonProps["variant"]
> = {
    danger: "ghost",
    neutral: "ghost",
    primary: "default",
};

const SOURCE_ACTION_BUTTON_CLASS_BY_TONE: Record<
    SourceActionButtonTone,
    string
> = {
    danger:
        "border border-transparent bg-transparent text-[var(--signal-danger)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--signal-danger)]",
    neutral:
        "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] data-[sot-state=error]:text-destructive data-[sot-state=success]:text-primary",
    primary:
        "border border-[var(--source-provider-primary-border)] bg-[image:var(--source-provider-primary-bg)] text-[var(--accent-on)] shadow-[var(--source-provider-primary-shadow)] hover:bg-[image:var(--source-provider-primary-hover-bg)] data-[sot-state=error]:text-[var(--signal-danger)]",
};

const SOURCE_ACTION_STATUS_BADGE_CLASS =
    "h-auto gap-1.5 border-0 bg-transparent p-0 text-muted-foreground data-[sot-state=saved]:text-primary data-[sot-state=saving]:text-primary data-[sot-state=error]:text-destructive data-[sot-state=saved]:[&_[data-sot-part=source-action-status-indicator]]:bg-primary data-[sot-state=saving]:[&_[data-sot-part=source-action-status-indicator]]:animate-pulse data-[sot-state=saving]:[&_[data-sot-part=source-action-status-indicator]]:bg-primary data-[sot-state=error]:[&_[data-sot-part=source-action-status-indicator]]:bg-destructive";

const SOURCE_ACTION_STATUS_INDICATOR_CLASS =
    "size-2 rounded-full bg-secondary-foreground/45";

function SourceActionButton({
    className,
    tone,
    ...props
}: SourceActionButtonProps) {
    return (
        <Button
            variant={SOURCE_ACTION_BUTTON_PRIMITIVE_VARIANT_BY_TONE[tone]}
            size="xs"
            className={cn(
                SOURCE_ACTION_BUTTON_SIZE_CLASS,
                SOURCE_ACTION_BUTTON_CLASS_BY_TONE[tone],
                className,
            )}
            {...props}
        />
    );
}

function SourceActionStatusBadge({
    className,
    children,
    ...props
}: SourceActionStatusBadgeProps) {
    return (
        <Badge
            variant="ghost"
            className={cn(SOURCE_ACTION_STATUS_BADGE_CLASS, className)}
            {...props}
        >
            <span
                aria-hidden="true"
                data-sot-part="source-action-status-indicator"
                className={SOURCE_ACTION_STATUS_INDICATOR_CLASS}
            />
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
    const fallback = isZh
        ? "来源更新失败，请检查登录信息后重试。"
        : "Source update failed. Check the sign-in details and try again.";
    const candidate = source.lastSyncError?.trim();

    if (!candidate || candidate.length > 160) {
        return fallback;
    }

    if (/[\r\n{}<>]/.test(candidate) || /\bhttps?:\/\//i.test(candidate)) {
        return fallback;
    }

    const normalized = candidate.toLowerCase();
    const privateFragments = [
        ["tok", "en"].join(""),
        ["bear", "er"].join(""),
        ["cook", "ie"].join(""),
        ["har"].join(""),
        ["head", "er"].join(""),
        ["pay", "load"].join(""),
        ["sess", "ion"].join(""),
        ["user", "_access_", "tok", "en"].join(""),
        ["x-", "sess", "ion", "-id"].join(""),
        ["org", "id"].join(""),
    ];

    return privateFragments.some((fragment) => normalized.includes(fragment))
        ? fallback
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

function getBannerTone(tone: ProviderTone) {
    if (tone === "ok") return "info";
    if (tone === "err") return "err";
    if (tone === "warn") return "warn";
    return "info";
}

function getSourceAuthModeBadge(mode: string, isZh: boolean) {
    if (mode === "oauth-device-flow") {
        return {
            label: isZh ? "推荐" : "Recommended",
            tone: "recommended",
        };
    }

    if (mode === "web-reverse") {
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
    const isDimmed =
        status.state === "planned" ||
        status.state === "needs-setup" ||
        status.state === "expired";

    return (
        <Button
            type="button"
            variant="sourceProviderTile"
            size="sourceProviderTile"
            aria-pressed={isSelected}
            data-state={isSelected ? "selected" : "idle"}
            data-sot-provider-card=""
            data-sot-control="source-provider"
            data-sot-dimmed={isDimmed ? "true" : "false"}
            data-sot-provider={source.provider}
            data-sot-state={isSelected ? "selected" : "idle"}
            data-sot-status={status.state}
            disabled={disabled}
            onClick={onSelect}
        >
            <span
                data-sot-provider-icon=""
                data-sot-cover={
                    source.provider === "feishu-minutes" ? "true" : undefined
                }
                data-sot-part="source-provider-mark"
            >
                {source.provider === "iflyrec" ? (
                    <span aria-hidden="true">讯</span>
                ) : assetPath ? (
                    // biome-ignore lint/performance/noImgElement: SOT source cards render fixed local provider marks directly.
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
            <span
                data-sot-provider-meta=""
                data-sot-part="source-provider-meta"
            >
                <span
                    data-sot-provider-name=""
                >
                    {displayName}
                </span>
                <span
                    data-sot-provider-hint=""
                >
                    {getSourceProviderStatusHint(source, language) ??
                        (isZh ? "录音来源" : "Recording source")}
                </span>
            </span>
            <Badge
                variant="sourceProviderStatus"
                className="justify-self-end"
                data-sot-provider-status=""
                data-sot-state={status.state}
                data-sot-status={status.state}
                data-sot-tone={status.tone}
                data-state={status.state}
            >
                <span
                    data-sot-provider-status-dot=""
                />
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
    const Icon =
        tone === "ok"
            ? CheckCircle2
            : tone === "warn"
              ? AlertCircle
              : tone === "err"
                ? XCircle
                : tone === "syncing"
                  ? LoaderCircle
                  : tone === "neu"
                    ? PauseCircle
                    : Info;

    return (
        <Alert
            data-sot-banner="source-state"
            data-sot-panel="source-state-banner"
            data-sot-state={getBannerTone(tone)}
            data-sot-tone={tone}
            density="settingsBanner"
            layout="settingsBanner"
            variant={
                tone === "err" ? "settingsBannerError" : "settingsBanner"
            }
        >
            <span data-sot-banner-icon>
                <Icon
                    aria-hidden="true"
                    className={tone === "syncing" ? "animate-spin" : undefined}
                />
            </span>
            <div data-sot-banner-body>
                <AlertTitle density="settingsBanner" data-sot-banner-title>
                    {title}
                </AlertTitle>
                <AlertDescription
                    density="settingsBanner"
                    data-sot-banner-sub
                >
                    {description}
                </AlertDescription>
            </div>
        </Alert>
    );
}

function DataSourcesSettingsPanel({
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
    const sourceTestState =
        actionState === "testing"
            ? "testing"
            : actionState === "test-success"
              ? "success"
              : actionState === "test-error"
                ? "error"
                : interactionDisabled
                  ? "disabled"
                  : "idle";
    const sourceSaveState =
        actionState === "saving"
            ? "saving"
            : actionState === "saved"
              ? "saved"
              : actionState === "save-error"
                ? "error"
                : interactionDisabled
                  ? "disabled"
                  : "idle";
    const sourceReconnectState =
        actionState === "reconnecting"
            ? "reconnecting"
            : actionState === "reconnected"
              ? "reconnected"
              : actionState === "reconnect-error"
                ? "error"
                : interactionDisabled
                  ? "disabled"
                  : "idle";
    const sourceDisconnectState =
        actionState === "disconnecting"
            ? "disconnecting"
            : actionState === "disconnected"
              ? "disconnected"
              : actionState === "disconnect-error"
                ? "error"
                : interactionDisabled
                  ? "disabled"
                  : "idle";
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
    return (
        <div
            ref={scrollRef}
            data-sot-layout="three-pane"
            data-sot-panel="settings-scroll-body"
            data-sot-load-state={
                loadError ? "error" : isLoading ? "loading" : "ready"
            }
            data-sot-selected-provider={selectedSource?.provider ?? "none"}
            data-sot-surface="settings-data-sources"
            aria-busy={isLoading}
        >
            <aside data-sot-list="source-providers">
                <div data-sot-part="source-providers-title">
                    {isZh ? "来源" : "Data Sources"} ·{" "}
                    {isLoading ? "..." : orderedSources.length}
                </div>

                {loadError ? (
                    <Alert
                        data-sot-banner="source-load-error"
                        data-sot-panel="source-load-error"
                        data-sot-tone="err"
                        density="settingsBanner"
                        layout="settingsBannerAction"
                        variant="settingsLoadError"
                    >
                        <span data-sot-banner-icon>
                            <AlertCircle aria-hidden="true" />
                        </span>
                        <span data-sot-banner-body>
                            <AlertTitle
                                density="settingsBanner"
                                data-sot-banner-title
                            >
                                {isZh ? "加载失败" : "Load failed"}
                            </AlertTitle>
                            <AlertDescription
                                density="settingsBanner"
                                data-sot-banner-sub
                            >
                                {loadError}
                            </AlertDescription>
                        </span>
                        <Button
                            type="button"
                            variant="settingsSourceRetry"
                            size="settingsSourceRetry"
                            data-sot-control="source-load-retry"
                            onClick={() => void refreshSources()}
                        >
                            <RotateCw
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {isZh ? "重试" : "Retry"}
                        </Button>
                    </Alert>
                ) : null}

                {isLoading && orderedSources.length === 0 ? (
                    <Empty
                        className="mt-4 flex-none"
                        data-sot-panel="settings-empty-hint"
                        data-sot-section="data-sources"
                        data-sot-state="loading"
                    >
                        <EmptyHeader>
                            <EmptyTitle data-sot-part="settings-empty-title">
                                {isZh ? "正在读取来源" : "Loading sources"}
                            </EmptyTitle>
                            <EmptyDescription data-sot-part="settings-empty-description">
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
                data-sot-action-state={actionState}
                data-sot-interaction-disabled={
                    interactionDisabled ? "true" : "false"
                }
                data-sot-panel="source-provider-detail"
                data-sot-provider={selectedSource?.provider ?? "none"}
                data-sot-status={status?.state ?? "empty"}
            >
                {selectedSource && status ? (
                    <>
                        <div
                            data-sot-part="source-provider-header"
                            data-sot-state={status.state}
                        >
                            <div>
                                <h3 data-sot-part="source-provider-title">
                                    {getSourceProviderSettingsLabel(
                                        selectedSource.provider,
                                        language,
                                    )}
                                </h3>
                                <div data-sot-part="source-provider-subtitle">
                                    {getSourceProviderDetailSubtitle(
                                        selectedSource,
                                        isZh,
                                    )}
                                </div>
                            </div>
                            <Badge
                                variant="sourceProviderDetailStatus"
                                data-sot-status={status.state}
                                data-sot-tone={status.tone}
                            >
                                <span
                                    className="size-1.5 rounded-full bg-current"
                                    data-sot-status-dot
                                />
                                {status.label}
                            </Badge>
                        </div>

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
                                    isZh ? "选择登录方式" : "Select auth mode"
                                }
                                disabled={interactionDisabled}
                                data-sot-list="source-auth-modes"
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
                                layout="settingsSourceAuthMode"
                                size="settingsSourceAuthModeOption"
                                spacing="settingsSourceAuthMode"
                                type="single"
                                value={selectedSource.authMode}
                                variant="settingsSourceAuthModeOption"
                            >
                                {selectedSource.authModes.map((mode) => {
                                    const active =
                                        selectedSource.authMode === mode;
                                    const modeBadge = getSourceAuthModeBadge(
                                        mode,
                                        isZh,
                                    );

                                    return (
                                        <ToggleGroupItem
                                            key={mode}
                                            aria-pressed={active}
                                            data-sot-auth-mode={mode}
                                            data-sot-control="source-auth-mode"
                                            data-sot-state={
                                                active ? "selected" : "idle"
                                            }
                                            disabled={interactionDisabled}
                                            value={mode}
                                        >
                                            <span
                                                className="flex items-center gap-2"
                                                data-sot-part="source-auth-mode-title"
                                            >
                                                {getSourceAuthModeDisplayLabel(
                                                    mode,
                                                    language,
                                                )}
                                                {modeBadge ? (
                                                    <Badge
                                                        data-sot-badge="source-auth-mode"
                                                        data-sot-tone={
                                                            modeBadge.tone
                                                        }
                                                        variant="sourceAuthModeBadge"
                                                    >
                                                        {modeBadge.label}
                                                    </Badge>
                                                ) : null}
                                            </span>
                                            <span
                                                className="text-left"
                                                data-sot-part="source-auth-mode-description"
                                            >
                                                {mode === "web-reverse"
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
                            <div data-sot-section-group>
                                <Field
                                    orientation="horizontal"
                                    variant="sourceProviderDetail"
                                >
                                    <FieldContent
                                        variant="sourceProviderDetail"
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
                            </div>
                        ) : null}

                        <div
                            data-sot-list="source-fields"
                            data-sot-panel="source-provider-fields"
                        >
                            {displayedServiceAddress &&
                            !providerUsesCustomServerSelector(
                                selectedSource.provider,
                            ) ? (
                                <Field
                                    data-field-id="source-service-address"
                                    data-disabled={
                                        interactionDisabled ? "true" : undefined
                                    }
                                    orientation="horizontal"
                                    variant="sourceProviderDetail"
                                >
                                    <FieldContent
                                        variant="sourceProviderDetail"
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
                                    <FieldControl variant="sourceProviderDetail">
                                        <Input
                                            controlSize="sourceProviderDetail"
                                            id={`${selectedSource.provider}-base-url`}
                                            variant="sourceProviderDetail"
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
                                                                  event.target
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
                                    <Empty
                                        className="mt-4 flex-none"
                                        data-sot-panel="settings-empty-hint"
                                        data-sot-section="data-sources"
                                        data-sot-state="advanced"
                                    >
                                        <EmptyHeader>
                                            <EmptyTitle data-sot-part="settings-empty-title">
                                                {isZh
                                                    ? "高级选项（可选）"
                                                    : "Advanced options"}
                                            </EmptyTitle>
                                            <EmptyDescription data-sot-part="settings-empty-description">
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
                                </>
                            ) : null}
                        </div>

                        <div data-sot-section-divider />

                        <div data-sot-section-group>
                            <Field
                                data-sot-part="source-auto-update-row"
                                data-disabled={
                                    interactionDisabled ? "true" : undefined
                                }
                                orientation="horizontal"
                                variant="sourceProviderDetail"
                            >
                                <FieldContent
                                    variant="sourceProviderDetail"
                                >
                                    <FieldTitle>
                                        {isZh
                                            ? "自动更新"
                                            : "Automatic updates"}
                                    </FieldTitle>
                                    <FieldDescription>
                                        {isZh
                                            ? "每 15 分钟读取一次新录音"
                                            : "Read new recordings every 15 minutes"}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl variant="sourceProviderDetail">
                                    <Switch
                                        data-sot-control="source-auto-update"
                                        data-sot-provider={
                                            selectedSource.provider
                                        }
                                        data-sot-state={
                                            selectedSource.enabled
                                                ? "checked"
                                                : "unchecked"
                                        }
                                        checked={selectedSource.enabled}
                                        disabled={interactionDisabled}
                                        size="sourceProviderDetail"
                                        onCheckedChange={(checked) =>
                                            updateSource(
                                                selectedSource.provider,
                                                (current) => ({
                                                    ...current,
                                                    enabled: checked,
                                                }),
                                            )
                                        }
                                        variant="sourceProviderDetail"
                                    />
                                </FieldControl>
                            </Field>

                            {titleWritebackFields.map((field) => (
                                <DataSourceFieldControl
                                    disabled={interactionDisabled}
                                    field={{
                                        ...field,
                                        label: isZh
                                            ? "标题更新回来源"
                                            : "Title updates to source",
                                        description: isZh
                                            ? `本机重命名录音后，把新标题写回 ${selectedSourceDisplayName}`
                                            : `After renaming locally, write the new title back to ${selectedSourceDisplayName}.`,
                                    }}
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

                            <Field
                                data-disabled={
                                    interactionDisabled ? "true" : undefined
                                }
                                orientation="horizontal"
                                variant="sourceProviderDetail"
                            >
                                <FieldContent
                                    variant="sourceProviderDetail"
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
                                <FieldControl variant="sourceProviderDetail">
                                    <Switch
                                        id={`${selectedSource.provider}-enabled`}
                                        data-sot-control="source-enable-sync"
                                        data-sot-provider={
                                            selectedSource.provider
                                        }
                                        data-sot-state={
                                            selectedSource.enabled
                                                ? "checked"
                                                : "unchecked"
                                        }
                                        data-sot-enabled={
                                            selectedSource.enabled
                                                ? "true"
                                                : "false"
                                        }
                                        data-sot-disabled={
                                            interactionDisabled
                                                ? "true"
                                                : "false"
                                        }
                                        checked={selectedSource.enabled}
                                        disabled={interactionDisabled}
                                        size="sourceProviderDetail"
                                        onCheckedChange={(checked) =>
                                            updateSource(
                                                selectedSource.provider,
                                                (current) => ({
                                                    ...current,
                                                    enabled: checked,
                                                }),
                                            )
                                        }
                                        variant="sourceProviderDetail"
                                    />
                                </FieldControl>
                            </Field>
                        </div>

                        <footer
                            className="mt-[18px] mb-px ml-0 flex flex-row justify-start"
                            data-sot-panel="source-actions"
                            data-sot-provider={selectedSource.provider}
                            data-sot-state={sourceSaveState}
                        >
                            <SourceActionStatusBadge
                                data-sot-part="source-action-status"
                                data-sot-state={sourceSaveState}
                            >
                                {actionMessage?.title ?? ""}
                            </SourceActionStatusBadge>
                            <SourceActionButton
                                type="button"
                                tone="neutral"
                                data-sot-action="test"
                                data-sot-control="source-test"
                                data-sot-provider={selectedSource.provider}
                                data-sot-state={sourceTestState}
                                disabled={interactionDisabled}
                                aria-busy={actionState === "testing"}
                                onClick={() =>
                                    void handleTestSource(selectedSource)
                                }
                            >
                                {actionState === "testing" ? (
                                    <LoaderCircle
                                        data-icon="inline-start"
                                        aria-hidden="true"
                                        className="animate-spin"
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
                                data-sot-action="save"
                                data-sot-control="source-save"
                                data-sot-provider={selectedSource.provider}
                                data-sot-state={sourceSaveState}
                                disabled={interactionDisabled}
                                aria-busy={actionState === "saving"}
                                onClick={() =>
                                    void handleSaveSource(selectedSource)
                                }
                            >
                                {actionState === "saving" ? (
                                    <LoaderCircle
                                        data-icon="inline-start"
                                        aria-hidden="true"
                                        className="animate-spin"
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
                            data-sot-part="source-reconnect-row"
                            data-disabled={
                                interactionDisabled ? "true" : undefined
                            }
                            orientation="horizontal"
                            variant="sourceProviderDetail"
                        >
                            <FieldContent
                                variant="sourceProviderDetail"
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
                            <FieldControl variant="sourceProviderDetail">
                                <SourceActionButton
                                    type="button"
                                    tone="neutral"
                                    data-sot-control="source-reconnect"
                                    data-sot-state={sourceReconnectState}
                                    disabled={interactionDisabled}
                                    aria-busy={actionState === "reconnecting"}
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
                            data-sot-part="source-disconnect-row"
                            data-disabled={
                                interactionDisabled ? "true" : undefined
                            }
                            orientation="horizontal"
                            variant="sourceProviderDetail"
                        >
                            <FieldContent
                                variant="sourceProviderDetail"
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
                            <FieldControl variant="sourceProviderDetail">
                                <SourceActionButton
                                    type="button"
                                    tone="danger"
                                    data-sot-control="source-disconnect"
                                    data-sot-state={sourceDisconnectState}
                                    disabled={interactionDisabled}
                                    aria-busy={actionState === "disconnecting"}
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
                    </>
                ) : (
                    <Empty
                        className="mt-4 flex-none"
                        data-sot-panel="settings-empty-hint"
                        data-sot-section="data-sources"
                        data-sot-state="empty"
                    >
                        <EmptyHeader>
                            <EmptyTitle data-sot-part="settings-empty-title">
                                {isZh ? "没有可用数据源" : "No data sources"}
                            </EmptyTitle>
                            <EmptyDescription data-sot-part="settings-empty-description">
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

type SectionSaveState = "idle" | "saving" | "saved" | "error";

interface Option<Value extends string | number = string> {
    label: string;
    sotValue?: string;
    value: Value;
}

const ITEMS_PER_PAGE_MIN = 10;
const ITEMS_PER_PAGE_MAX = 200;
const TITLE_API_KEY_KEEP = "__keep_title_generation_key__";
const TITLE_API_KEY_CLEAR = "__clear_title_generation_key__";
const VOSCRIPT_API_KEY_KEEP = "__keep_voscript_key__";
const VOSCRIPT_API_KEY_CLEAR = "__clear_voscript_key__";
const SETTINGS_INPUT_CLASS = "min-w-60 max-w-full";
const SETTINGS_NUMBER_INPUT_CLASS = "w-24 max-w-full";

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message.trim()
        ? error.message
        : fallback;
}

function nullableText(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function clampInteger(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, Math.floor(value)));
}

function SaveStatus({
    error,
    isZh,
    saveState,
}: {
    error: string | null;
    isZh: boolean;
    saveState: SectionSaveState;
}) {
    const label =
        saveState === "saving"
            ? isZh
                ? "保存中"
                : "Saving"
            : saveState === "saved"
              ? isZh
                  ? "已保存"
                  : "Saved"
              : saveState === "error"
                ? (error ?? (isZh ? "保存失败" : "Save failed"))
                : "";

    return (
        <Badge
            variant="settingsSaveStatus"
            data-sot-part="settings-save-status"
            data-sot-state={saveState}
        >
            {saveState === "idle" ? null : (
                <span
                    aria-hidden="true"
                    data-sot-part="settings-save-status-indicator"
                />
            )}
            {label}
        </Badge>
    );
}

function SectionShell({
    busy,
    children,
    loadError,
    loading,
    onRetry,
    scrollRef,
    section,
    subtitle,
    title,
    voscriptAvailability,
}: {
    busy: boolean;
    children: React.ReactNode;
    loadError: string | null;
    loading: boolean;
    onRetry: () => void;
    scrollRef?: Ref<HTMLDivElement>;
    section: string;
    subtitle?: string;
    title: string;
    voscriptAvailability?: "ready" | "unavailable";
}) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";

    if (loading) {
        return (
            <SettingsSectionSkeleton
                fieldsPerCard={2}
                scrollRef={scrollRef}
                section={section}
                surface="settings-section"
            />
        );
    }

    if (loadError) {
        return (
            <div
                ref={scrollRef}
                aria-busy={busy}
                data-sot-layout="section"
                data-sot-panel="settings-scroll-body"
                data-sot-section={section}
                data-sot-state="error"
                data-sot-surface="settings-section"
            >
                <Alert
                    data-sot-banner="settings-section-load-error"
                    data-sot-panel="settings-section-load-error"
                    data-sot-section={section}
                    data-sot-tone="err"
                    density="settingsBanner"
                    layout="settingsBannerAction"
                    variant="settingsLoadError"
                >
                    <span data-sot-banner-icon>
                        <AlertCircle aria-hidden="true" />
                    </span>
                    <span data-sot-banner-body>
                        <AlertTitle
                            density="settingsBanner"
                            data-sot-banner-title
                        >
                            {isZh ? "加载失败" : "Load failed"}
                        </AlertTitle>
                        <AlertDescription
                            density="settingsBanner"
                            data-sot-banner-sub
                        >
                            {loadError}
                        </AlertDescription>
                    </span>
                    <Button
                        type="button"
                        variant="settingsSectionRetry"
                        size="settingsSectionRetry"
                        onClick={onRetry}
                        data-sot-control="settings-section-load-retry"
                        data-sot-section={section}
                    >
                        <RotateCw data-icon="inline-start" aria-hidden="true" />
                        {isZh ? "重试" : "Retry"}
                    </Button>
                </Alert>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            aria-busy={busy}
            data-sot-layout="section"
            data-sot-panel="settings-scroll-body"
            data-sot-section={section}
            data-sot-state={busy ? "busy" : "ready"}
            data-sot-surface="settings-section"
            data-sot-availability={voscriptAvailability}
        >
            <h3 data-sot-title>{title}</h3>
            {subtitle ? (
                <FieldDescription className="max-w-2xl">
                    {subtitle}
                </FieldDescription>
            ) : null}
            {children}
        </div>
    );
}

function SettingsGroup({
    children,
    subtitle,
    title,
}: {
    children: React.ReactNode;
    subtitle?: string;
    title: string;
}) {
    return (
        <section data-sot-section-group>
            <header data-sot-section-head>
                <h4>{title}</h4>
                {subtitle ? <p>{subtitle}</p> : null}
            </header>
            {children}
        </section>
    );
}

function SettingsRow({
    children,
    description,
    fieldMessage,
    fieldState,
    label,
    sotField,
}: {
    children?: React.ReactNode;
    description?: string;
    fieldMessage?: string;
    fieldState?: "invalid";
    label: string;
    sotField?: string;
}) {
    return (
        <Field
            data-invalid={fieldState === "invalid" ? "true" : undefined}
            data-sot-field={sotField}
            data-sot-state={fieldState ?? "ready"}
            orientation="horizontal"
            variant="settingsRow"
        >
            <FieldContent variant="settingsContent">
                <FieldTitle>{label}</FieldTitle>
                {description ? (
                    <FieldDescription>{description}</FieldDescription>
                ) : null}
                {fieldMessage ? (
                    <FieldError
                        data-sot-field={sotField}
                        data-sot-part="settings-field-message"
                        data-sot-state="invalid"
                    >
                        {fieldMessage}
                    </FieldError>
                ) : null}
            </FieldContent>
            {children ? (
                <FieldControl variant="settingsControl">
                    {children}
                </FieldControl>
            ) : null}
        </Field>
    );
}

function SelectControl<Value extends string | number>({
    control,
    disabled,
    id,
    label,
    onChange,
    options,
    value,
}: {
    control?: string;
    disabled?: boolean;
    id: string;
    label: string;
    onChange: (value: string) => void;
    options: Option<Value>[];
    value: Value;
}) {
    return (
        <Select
            aria-label={label}
            data-sot-control={control}
            data-sot-state={disabled ? "disabled" : "ready"}
            disabled={disabled}
            id={id}
            onValueChange={onChange}
            options={options.map((option) => ({
                label: option.label,
                value: String(option.value),
            }))}
            value={String(value)}
        />
    );
}

function SegmentControl<Value extends string>({
    control,
    disabled,
    label,
    onChange,
    options,
    value,
}: {
    control: string;
    disabled?: boolean;
    label: string;
    onChange: (value: Value) => void;
    options: Option<Value>[];
    value: Value;
}) {
    return (
        <ToggleGroup
            aria-disabled={disabled ? "true" : "false"}
            aria-label={label}
            data-sot-control={control}
            data-sot-panel="settings-segment-control"
            disabled={disabled}
            layout="settingsSegment"
            size="settingsSegmentOption"
            spacing="settingsSegmentSpacing"
            type="single"
            value={value}
            variant="settingsSegmentOption"
            onValueChange={(nextValue) => {
                if (typeof nextValue === "string" && nextValue) {
                    onChange(nextValue as Value);
                }
            }}
        >
            {options.map((option) => {
                const active = option.value === value;

                return (
                    <ToggleGroupItem
                        key={option.value}
                        data-sot-control={control}
                        data-sot-display-value={option.sotValue ?? option.value}
                        data-sot-state={active ? "selected" : "idle"}
                        data-sot-value={option.value}
                        disabled={disabled}
                        value={option.value}
                    >
                        {option.label}
                    </ToggleGroupItem>
                );
            })}
        </ToggleGroup>
    );
}

function SaveActions({
    disabled,
    error,
    isZh,
    onSave,
    saveId,
    saveState,
    section,
    children,
}: {
    children?: React.ReactNode;
    disabled: boolean;
    error: string | null;
    isZh: boolean;
    onSave: () => void;
    saveId?: string;
    saveState: SectionSaveState;
    section: string;
}) {
    return (
        <div
            data-sot-panel="settings-save-actions"
            data-sot-save-id={saveId ?? section}
            data-sot-section={section}
            data-sot-state={saveState}
        >
            <SaveStatus error={error} isZh={isZh} saveState={saveState} />
            {children}
            <Button
                type="button"
                variant="settingsSave"
                size="settingsSave"
                disabled={disabled}
                aria-busy={saveState === "saving"}
                data-sot-action="save"
                data-sot-control="settings-save"
                data-sot-section={section}
                data-sot-state={saveState}
                onClick={onSave}
            >
                {saveState === "saving" ? (
                    <LoaderCircle
                        data-icon="inline-start"
                        aria-hidden="true"
                        className="animate-spin"
                    />
                ) : null}
                {saveState === "saving"
                    ? isZh
                        ? "保存中"
                        : "Saving"
                    : saveState === "saved"
                      ? isZh
                          ? "已保存"
                          : "Saved"
                      : isZh
                        ? "保存"
                        : "Save"}
            </Button>
        </div>
    );
}

function useResettingSaveState() {
    const [saveState, setSaveState] = useState<SectionSaveState>("idle");
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (saveState !== "saved") return;
        const timeout = window.setTimeout(() => setSaveState("idle"), 2200);
        return () => window.clearTimeout(timeout);
    }, [saveState]);

    return { saveError, saveState, setSaveError, setSaveState };
}

function DisplaySettingsPanel({
    scrollRef,
}: {
    scrollRef?: Ref<HTMLDivElement>;
}) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const {
        settings,
        hasLoaded,
        isLoading,
        isSaving,
        loadError,
        ensureDisplaySettingsLoaded,
        updateDisplaySettings,
    } = useDisplaySettingsStore();
    const [draft, setDraft] = useState<DisplaySettings>(settings);
    const busy = isLoading || isSaving;

    useSettingsSectionBusy("appearance", busy);

    useEffect(() => {
        if (hasLoaded) setDraft(settings);
    }, [hasLoaded, settings]);

    const persistDisplaySetting = <Key extends keyof DisplaySettings>(
        key: Key,
        value: DisplaySettings[Key],
    ) => {
        setDraft((current) => ({
            ...current,
            [key]: value,
        }));

        if (draft[key] === value && settings[key] === value) {
            return;
        }

        void updateDisplaySettings({
            [key]: value,
        } as Pick<DisplaySettings, Key>).catch(() => {});
    };

    const themeOptions: Option<ThemeMode>[] = [
        {
            label: isZh ? "自动" : "Auto",
            value: "system",
            sotValue: "auto",
        },
        { label: isZh ? "浅色" : "Light", value: "light" },
        { label: isZh ? "深色" : "Dark", value: "dark" },
    ];
    const languageOptions: Option<UiLanguage>[] = [
        { label: "简体中文", value: "zh-CN" },
        { label: "English", value: "en" },
    ];
    const dateTimeOptions: Option<DisplaySettings["dateTimeFormat"]>[] = [
        {
            label: isZh ? "2 小时前" : "2 hours ago",
            value: "relative",
            sotValue: "rel",
        },
        {
            label: "14:00",
            value: "absolute",
            sotValue: "abs",
        },
    ];
    const densityOptions: Option<DisplayDensity>[] = [
        { label: isZh ? "宽松" : "Comfy", value: "comfy" },
        { label: isZh ? "紧凑" : "Compact", value: "compact" },
    ];
    const sortOptions: Option<RecordingListSortOrder>[] = [
        { label: isZh ? "最新在前" : "Newest first", value: "newest" },
        { label: isZh ? "最早在前" : "Oldest first", value: "oldest" },
        { label: isZh ? "按名称" : "By name", value: "name" },
    ];

    return (
        <SectionShell
            busy={busy}
            loadError={loadError && !hasLoaded ? loadError : null}
            loading={isLoading && !hasLoaded}
            onRetry={() => void ensureDisplaySettingsLoaded().catch(() => {})}
            scrollRef={scrollRef}
            section="appearance"
            title={isZh ? "显示设置" : "Display Settings"}
        >
            <SettingsGroup
                title={isZh ? "主题与外观" : "Theme and Appearance"}
                subtitle={
                    isZh
                        ? "跟随系统，或选择固定主题。"
                        : "Follow the system or choose a fixed theme."
                }
            >
                <SettingsRow
                    label={isZh ? "主题" : "Theme"}
                    description={
                        isZh
                            ? "深色 / 浅色 / 跟随系统"
                            : "Dark / light / system"
                    }
                >
                    <SegmentControl
                        control="theme"
                        label={isZh ? "主题" : "Theme"}
                        options={themeOptions}
                        value={draft.theme}
                        disabled={busy}
                        onChange={(value) =>
                            persistDisplaySetting("theme", value)
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={isZh ? "界面语言" : "Interface language"}
                    description={
                        isZh
                            ? "应用界面显示语言"
                            : "Application interface language"
                    }
                >
                    <SelectControl
                        id="display-ui-language"
                        label={isZh ? "界面语言" : "Interface language"}
                        options={languageOptions}
                        value={draft.uiLanguage}
                        disabled={busy}
                        onChange={(value) =>
                            persistDisplaySetting(
                                "uiLanguage",
                                value as UiLanguage,
                            )
                        }
                    />
                </SettingsRow>
            </SettingsGroup>
            <SettingsGroup
                title={isZh ? "列表与日期" : "List and Date"}
                subtitle={
                    isZh
                        ? "录音列表的密度、时间显示和排序。"
                        : "Recording list density, time display, and ordering."
                }
            >
                <SettingsRow
                    label={isZh ? "信息密度" : "Information density"}
                    description={
                        isZh
                            ? "列表与面板采用紧凑间距"
                            : "Controls list spacing and information density"
                    }
                >
                    <SegmentControl
                        control="density"
                        label={isZh ? "信息密度" : "Information density"}
                        options={densityOptions}
                        value={draft.displayDensity}
                        disabled={busy}
                        onChange={(value) =>
                            persistDisplaySetting("displayDensity", value)
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={isZh ? "时间显示" : "Time display"}
                    description={
                        isZh
                            ? "列表中录音时间的呈现方式"
                            : "How recording times appear in the list"
                    }
                >
                    <SegmentControl
                        control="time-style"
                        label={isZh ? "时间显示" : "Time display"}
                        options={dateTimeOptions}
                        value={
                            draft.dateTimeFormat === "iso"
                                ? "absolute"
                                : draft.dateTimeFormat
                        }
                        disabled={busy}
                        onChange={(value) =>
                            persistDisplaySetting("dateTimeFormat", value)
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={isZh ? "列表排序" : "List order"}
                    description={
                        isZh
                            ? "最新录音的默认呈现位置"
                            : "Default position for newest recordings"
                    }
                >
                    <SelectControl
                        id="display-recording-list-sort-order"
                        label={isZh ? "列表排序" : "List order"}
                        options={sortOptions}
                        value={draft.recordingListSortOrder}
                        disabled={busy}
                        onChange={(value) =>
                            persistDisplaySetting(
                                "recordingListSortOrder",
                                value as RecordingListSortOrder,
                            )
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={isZh ? "每页录音数" : "Recordings per page"}
                    description={
                        isZh ? "列表分页大小" : "Recording list pagination size"
                    }
                >
                    <Input
                        className={SETTINGS_NUMBER_INPUT_CLASS}
                        id="display-items-per-page"
                        type="number"
                        min={ITEMS_PER_PAGE_MIN}
                        max={ITEMS_PER_PAGE_MAX}
                        value={draft.itemsPerPage}
                        disabled={busy}
                        onChange={(event) => {
                            const nextItemsPerPage = clampInteger(
                                Number(event.target.value),
                                ITEMS_PER_PAGE_MIN,
                                ITEMS_PER_PAGE_MAX,
                            );
                            persistDisplaySetting(
                                "itemsPerPage",
                                nextItemsPerPage,
                            );
                        }}
                    />
                </SettingsRow>
            </SettingsGroup>
        </SectionShell>
    );
}

function TitleGenerationSettingsPanel({
    scrollRef,
}: {
    scrollRef?: Ref<HTMLDivElement>;
}) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const {
        settings,
        hasLoaded,
        isLoading,
        isSaving,
        loadError,
        ensureTitleGenerationSettingsLoaded,
        updateTitleGenerationSettings,
    } = useTitleGenerationSettingsStore();
    const [draft, setDraft] = useState<TitleGenerationSettings>(settings);
    const [apiKeyDraft, setApiKeyDraft] = useState("");
    const [apiKeyMode, setApiKeyMode] = useState(TITLE_API_KEY_KEEP);
    const { saveError, saveState, setSaveError, setSaveState } =
        useResettingSaveState();
    const busy = isLoading || isSaving || saveState === "saving";

    useSettingsSectionBusy("title-generation", busy);

    useEffect(() => {
        if (!hasLoaded) return;
        setDraft(settings);
        setApiKeyDraft("");
        setApiKeyMode(TITLE_API_KEY_KEEP);
    }, [hasLoaded, settings]);

    const save = async () => {
        const updates: TitleGenerationSettingsUpdate = {
            autoGenerateTitle: draft.autoGenerateTitle,
            titleGenerationBaseUrl: nullableText(
                draft.titleGenerationBaseUrl ?? "",
            ),
            titleGenerationModel: nullableText(
                draft.titleGenerationModel ?? "",
            ),
            titleGenerationPrompt: nullableText(
                draft.titleGenerationPrompt ?? "",
            ),
        };

        if (apiKeyMode === TITLE_API_KEY_CLEAR) {
            updates.titleGenerationApiKey = null;
        } else if (apiKeyDraft.trim()) {
            updates.titleGenerationApiKey = apiKeyDraft.trim();
        }

        setSaveState("saving");
        setSaveError(null);
        try {
            await updateTitleGenerationSettings(updates);
            setApiKeyDraft("");
            setApiKeyMode(TITLE_API_KEY_KEEP);
            setSaveState("saved");
        } catch (error) {
            setSaveError(
                getErrorMessage(
                    error,
                    "Failed to update title generation settings",
                ),
            );
            setSaveState("error");
        }
    };

    return (
        <SectionShell
            busy={busy}
            loadError={loadError && !hasLoaded ? loadError : null}
            loading={isLoading && !hasLoaded}
            onRetry={() =>
                void ensureTitleGenerationSettingsLoaded().catch(() => {})
            }
            scrollRef={scrollRef}
            section="title-generation"
            title={isZh ? "AI 重命名服务" : "AI Rename Service"}
        >
            <SettingsGroup
                title={isZh ? "标题生成服务" : "Title Generation Service"}
                subtitle={
                    isZh
                        ? "这里单独配置本地 AI 重命名服务。它读取已经生成好的逐字稿，不参与上游录音抓取，也不影响 VoScript 的转录队列。"
                        : "Configure the local AI rename service. It reads completed transcripts and does not affect upstream import or VoScript transcription queues."
                }
            >
                <SettingsRow
                    label={
                        isZh
                            ? "基于逐字稿自动重命名"
                            : "Automatically rename from transcripts"
                    }
                    description={
                        isZh
                            ? "本地逐字稿生成后自动调用 AI rename 服务生成文件名"
                            : "Call the AI rename service after a local transcript is ready."
                    }
                >
                    <Switch
                        id="title-generation-enabled"
                        checked={draft.autoGenerateTitle}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                            setDraft((current) => ({
                                ...current,
                                autoGenerateTitle: checked,
                            }))
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={isZh ? "重命名服务地址" : "Rename service URL"}
                    description={
                        isZh
                            ? "只用于文件名生成的 OpenAI 兼容接口"
                            : "OpenAI-compatible endpoint used only for filename generation."
                    }
                >
                    <Input
                        className={SETTINGS_INPUT_CLASS}
                        id="title-generation-base-url"
                        value={draft.titleGenerationBaseUrl ?? ""}
                        disabled={busy}
                        placeholder="https://api.openai.com/v1"
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                titleGenerationBaseUrl: event.target.value,
                            }))
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={isZh ? "重命名模型" : "Rename model"}
                    description={
                        isZh
                            ? "OpenAI 兼容的模型 ID"
                            : "OpenAI-compatible model ID"
                    }
                >
                    <Input
                        className={SETTINGS_INPUT_CLASS}
                        id="title-generation-model"
                        value={draft.titleGenerationModel ?? ""}
                        disabled={busy}
                        placeholder="gpt-4.1-mini"
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                titleGenerationModel: event.target.value,
                            }))
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={
                        isZh ? "重命名服务 API Key" : "Rename service API key"
                    }
                    description={
                        draft.titleGenerationApiKeySet
                            ? isZh
                                ? "当前账号已存储一把仅用于 AI 重命名的 key。输入新 key 可替换。"
                                : "A key for AI rename is stored. Enter a new key to replace it."
                            : isZh
                              ? "输入一把仅用于 AI 重命名的 key。"
                              : "Enter a key used only for AI rename."
                    }
                >
                    {draft.titleGenerationApiKeySet ? (
                        <span data-sot-key-status>
                            {isZh ? "已存储" : "Stored"}
                        </span>
                    ) : null}
                    <Input
                        className={SETTINGS_INPUT_CLASS}
                        id="title-generation-api-key"
                        type="password"
                        value={apiKeyDraft}
                        disabled={busy}
                        placeholder={
                            draft.titleGenerationApiKeySet
                                ? isZh
                                    ? "已存储。输入新 key 可替换。"
                                    : "Stored. Enter a new key to replace it."
                                : ""
                        }
                        onChange={(event) => setApiKeyDraft(event.target.value)}
                    />
                </SettingsRow>
                <SaveActions
                    disabled={busy}
                    error={saveError}
                    isZh={isZh}
                    onSave={() => void save()}
                    saveId="title-generation"
                    saveState={saveState}
                    section="title-generation"
                />
            </SettingsGroup>
        </SectionShell>
    );
}

function applyVoScriptSpeakerDraft(
    draft: VoScriptSettings,
    updates: Partial<VoScriptSettings>,
) {
    return { ...draft, ...updates };
}

function VoScriptSpeakerRows({
    busy,
    draft,
    isZh,
    maxSpeakersInvalid,
    maxSpeakersMessage,
    minSpeakersInvalid,
    minSpeakersMessage,
    setDraft,
}: {
    busy: boolean;
    draft: VoScriptSettings;
    isZh: boolean;
    maxSpeakersInvalid: boolean;
    maxSpeakersMessage?: string;
    minSpeakersInvalid: boolean;
    minSpeakersMessage?: string;
    setDraft: React.Dispatch<React.SetStateAction<VoScriptSettings>>;
}) {
    return (
        <>
            <SettingsRow
                fieldMessage={minSpeakersMessage}
                fieldState={minSpeakersInvalid ? "invalid" : undefined}
                label={isZh ? "最少说话人数" : "Minimum speakers"}
                sotField="min-speakers"
                description={isZh ? "0 为自动" : "0 means automatic"}
            >
                <Input
                    className={SETTINGS_NUMBER_INPUT_CLASS}
                    id="voscript-min-speakers"
                    type="number"
                    min={0}
                    aria-invalid={minSpeakersInvalid}
                    value={draft.privateTranscriptionMinSpeakers}
                    disabled={busy}
                    onChange={(event) =>
                        setDraft((current) =>
                            applyVoScriptSpeakerDraft(current, {
                                privateTranscriptionMinSpeakers: Number(
                                    event.target.value,
                                ),
                            }),
                        )
                    }
                />
            </SettingsRow>
            <SettingsRow
                fieldMessage={maxSpeakersMessage}
                fieldState={maxSpeakersInvalid ? "invalid" : undefined}
                label={isZh ? "最多说话人数" : "Maximum speakers"}
                sotField="max-speakers"
                description={
                    isZh
                        ? "0 为自动 · 必须 ≥ 最少说话人数"
                        : "0 means automatic; must be >= minimum speakers"
                }
            >
                <Input
                    className={SETTINGS_NUMBER_INPUT_CLASS}
                    id="voscript-max-speakers"
                    type="number"
                    min={0}
                    aria-invalid={maxSpeakersInvalid}
                    value={draft.privateTranscriptionMaxSpeakers}
                    disabled={busy}
                    onChange={(event) =>
                        setDraft((current) =>
                            applyVoScriptSpeakerDraft(current, {
                                privateTranscriptionMaxSpeakers: Number(
                                    event.target.value,
                                ),
                            }),
                        )
                    }
                />
            </SettingsRow>
        </>
    );
}

function VoScriptSettingsPanel({
    scrollRef,
}: {
    scrollRef?: Ref<HTMLDivElement>;
}) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const {
        settings,
        hasLoaded,
        isLoading,
        isSaving,
        loadError,
        ensureVoScriptSettingsLoaded,
        updateVoScriptSettings,
    } = useVoScriptSettingsStore();
    const [draft, setDraft] = useState<VoScriptSettings>(settings);
    const [apiKeyDraft, setApiKeyDraft] = useState("");
    const [apiKeyMode, setApiKeyMode] = useState(VOSCRIPT_API_KEY_KEEP);
    const [connectionTestState, setConnectionTestState] =
        useState<VoScriptConnectionTestState>("idle");
    const [connectionTestMessage, setConnectionTestMessage] = useState<
        string | null
    >(null);
    const connectionSave = useResettingSaveState();
    const paramsSave = useResettingSaveState();
    const isTestingConnection = connectionTestState === "testing";
    function isVoScriptNoRepeatNgramInvalid() {
        return (
            Number.isInteger(draft.privateTranscriptionNoRepeatNgramSize) &&
            draft.privateTranscriptionNoRepeatNgramSize > 0 &&
            draft.privateTranscriptionNoRepeatNgramSize < 3
        );
    }
    const noRepeatNgramInvalid = isVoScriptNoRepeatNgramInvalid();
    const noRepeatNgramMessage = "只支持 0 或 ≥ 3";
    const speakerBoundsMessage = "不能为负数";
    const speakerRangeMessage = "最多说话人数必须 ≥ 最少说话人数";
    const minSpeakersNegative = draft.privateTranscriptionMinSpeakers < 0;
    const maxSpeakersNegative = draft.privateTranscriptionMaxSpeakers < 0;
    const speakerRangeInvalid =
        draft.privateTranscriptionMaxSpeakers > 0 &&
        draft.privateTranscriptionMaxSpeakers <
            draft.privateTranscriptionMinSpeakers;
    const minSpeakersInvalid = minSpeakersNegative;
    const maxSpeakersInvalid = maxSpeakersNegative || speakerRangeInvalid;
    const minSpeakersMessage = minSpeakersInvalid
        ? speakerBoundsMessage
        : undefined;
    const maxSpeakersMessage = maxSpeakersNegative
        ? speakerBoundsMessage
        : speakerRangeInvalid
          ? speakerRangeMessage
          : undefined;
    const resolvedSpeakerBoundsMessage =
        minSpeakersMessage ?? maxSpeakersMessage;
    const busy =
        isLoading ||
        isSaving ||
        connectionSave.saveState === "saving" ||
        paramsSave.saveState === "saving" ||
        isTestingConnection;

    useSettingsSectionBusy("voscript", busy);

    useEffect(() => {
        if (!hasLoaded) return;
        setDraft(settings);
        setApiKeyDraft("");
        setApiKeyMode(VOSCRIPT_API_KEY_KEEP);
        setConnectionTestState("idle");
        setConnectionTestMessage(null);
    }, [hasLoaded, settings]);

    const connectionDraftSignature = `${draft.privateTranscriptionBaseUrl ?? ""}\u0000${apiKeyDraft}\u0000${apiKeyMode}`;

    // biome-ignore lint/correctness/useExhaustiveDependencies: This intentionally resets test UI when the connection draft signature changes.
    useEffect(() => {
        if (connectionTestState === "idle") return;
        setConnectionTestState("idle");
        setConnectionTestMessage(null);
    }, [connectionDraftSignature]);

    const save = async (saveLane: typeof connectionSave) => {
        if (resolvedSpeakerBoundsMessage) {
            paramsSave.setSaveError(resolvedSpeakerBoundsMessage);
            paramsSave.setSaveState("error");
            return;
        }

        if (noRepeatNgramInvalid) {
            paramsSave.setSaveError(noRepeatNgramMessage);
            paramsSave.setSaveState("error");
            return;
        }

        const updates: VoScriptSettingsUpdate = {
            privateTranscriptionBaseUrl: nullableText(
                draft.privateTranscriptionBaseUrl ?? "",
            ),
            privateTranscriptionMinSpeakers: clampInteger(
                draft.privateTranscriptionMinSpeakers,
                0,
                99,
            ),
            privateTranscriptionMaxSpeakers: clampInteger(
                draft.privateTranscriptionMaxSpeakers,
                0,
                99,
            ),
            privateTranscriptionDenoiseModel:
                draft.privateTranscriptionDenoiseModel,
            privateTranscriptionSnrThreshold:
                draft.privateTranscriptionSnrThreshold,
            privateTranscriptionNoRepeatNgramSize: clampInteger(
                draft.privateTranscriptionNoRepeatNgramSize,
                0,
                20,
            ),
            privateTranscriptionMaxInflightJobs: clampInteger(
                draft.privateTranscriptionMaxInflightJobs,
                0,
                20,
            ),
        };

        if (apiKeyMode === VOSCRIPT_API_KEY_CLEAR) {
            updates.privateTranscriptionApiKey = null;
        } else if (apiKeyDraft.trim()) {
            updates.privateTranscriptionApiKey = apiKeyDraft.trim();
        }

        saveLane.setSaveState("saving");
        saveLane.setSaveError(null);
        try {
            await updateVoScriptSettings(updates);
            setApiKeyDraft("");
            setApiKeyMode(VOSCRIPT_API_KEY_KEEP);
            saveLane.setSaveState("saved");
        } catch (error) {
            saveLane.setSaveError(
                getErrorMessage(error, "Failed to update VoScript settings"),
            );
            saveLane.setSaveState("error");
        }
    };

    const testConnection = async () => {
        const baseUrl = nullableText(draft.privateTranscriptionBaseUrl ?? "");
        const apiKey =
            apiKeyMode === VOSCRIPT_API_KEY_CLEAR
                ? null
                : nullableText(apiKeyDraft);

        setConnectionTestState("testing");
        setConnectionTestMessage(null);

        try {
            const result = await testVoScriptConnection({
                privateTranscriptionBaseUrl: baseUrl,
                privateTranscriptionApiKey: apiKey,
            });
            const voiceprintLabel =
                result.voiceprintCount > 0
                    ? isZh
                        ? ` · ${result.voiceprintCount} 个声纹`
                        : ` · ${result.voiceprintCount} voiceprints`
                    : "";
            setConnectionTestState(
                result.available && result.success
                    ? "test-success"
                    : "test-error",
            );
            setConnectionTestMessage(
                result.available && result.success
                    ? isZh
                        ? `连接正常${voiceprintLabel}`
                        : `Connection ready${voiceprintLabel}`
                    : isZh
                      ? "VoScript 当前不可用"
                      : "VoScript is unavailable",
            );
        } catch (error) {
            setConnectionTestState("test-error");
            setConnectionTestMessage(
                getErrorMessage(
                    error,
                    isZh ? "VoScript 当前不可用" : "VoScript is unavailable",
                ),
            );
        }
    };

    const hasConnectionBaseUrl = Boolean(
        nullableText(draft.privateTranscriptionBaseUrl ?? ""),
    );
    const savedKeyMatchesBaseUrl =
        draft.privateTranscriptionApiKeySet &&
        nullableText(draft.privateTranscriptionBaseUrl ?? "") ===
            nullableText(settings.privateTranscriptionBaseUrl ?? "");
    const hasConnectionApiKey =
        apiKeyMode !== VOSCRIPT_API_KEY_CLEAR &&
        (apiKeyDraft.trim().length > 0 || savedKeyMatchesBaseUrl);
    const showUnavailableBanner =
        !hasConnectionBaseUrl ||
        !hasConnectionApiKey ||
        connectionTestState === "test-error";
    const denoiseOptions: Option<VoScriptDenoiseModel>[] = [
        { label: "不降噪", value: "none" },
        { label: "DeepFilterNet", value: "deepfilternet" },
        { label: "noisereduce", value: "noisereduce" },
    ];

    return (
        <SectionShell
            busy={busy}
            loadError={loadError && !hasLoaded ? loadError : null}
            loading={isLoading && !hasLoaded}
            onRetry={() => void ensureVoScriptSettingsLoaded().catch(() => {})}
            scrollRef={scrollRef}
            section="voscript"
            title={isZh ? "VoScript 服务" : "VoScript Service"}
            voscriptAvailability={
                showUnavailableBanner ? "unavailable" : "ready"
            }
        >
            {showUnavailableBanner ? (
                <Alert
                    data-sot-banner="voscript-unavailable"
                    data-sot-panel="voscript-unavailable-banner"
                    data-sot-state={
                        connectionTestState === "test-error"
                            ? "test-error"
                            : "missing-connection"
                    }
                    data-sot-tone="warn"
                    density="settingsBanner"
                    layout="settingsBanner"
                    variant="settingsVoScriptWarning"
                >
                    <span
                        data-sot-banner-icon
                        aria-hidden="true"
                    >
                        <AlertCircle aria-hidden="true" />
                    </span>
                    <div data-sot-banner-body>
                        <AlertTitle
                            density="settingsBanner"
                            data-sot-banner-title
                        >
                            {isZh
                                ? "VoScript 当前不可用"
                                : "VoScript is unavailable"}
                        </AlertTitle>
                        <AlertDescription
                            density="settingsBanner"
                            data-sot-banner-hint
                        >
                            {connectionTestState === "test-error" &&
                            connectionTestMessage
                                ? connectionTestMessage
                                : isZh
                                  ? "服务地址或 API key 缺失，列表中将无法触发新转写。填好下面字段并保存后会自动重试。"
                                  : "The service URL or API key is missing. New transcription jobs cannot start until you fill these fields and save."}
                        </AlertDescription>
                    </div>
                </Alert>
            ) : null}
            <SettingsGroup
                title={isZh ? "服务连接" : "Service Connection"}
                subtitle={
                    isZh
                        ? "BetterAINote 会把录音提交到这里，并自动跟进处理进度。"
                        : "BetterAINote submits recordings here and follows processing progress automatically."
                }
            >
                <SettingsRow
                    label={isZh ? "VoScript 服务地址" : "VoScript service URL"}
                    description={
                        isZh
                            ? "私有部署的 VoScript 实例 URL"
                            : "Privately deployed VoScript instance URL"
                    }
                >
                    <Input
                        className={SETTINGS_INPUT_CLASS}
                        id="voscript-base-url"
                        value={draft.privateTranscriptionBaseUrl ?? ""}
                        disabled={busy}
                        placeholder="https://voscript.example.com"
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                privateTranscriptionBaseUrl: event.target.value,
                            }))
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={isZh ? "VoScript API Key" : "VoScript API key"}
                    description={
                        draft.privateTranscriptionApiKeySet
                            ? isZh
                                ? "当前账号已保存一把 VoScript key。输入新 key 可替换。"
                                : "A VoScript key is stored. Enter a new key to replace it."
                            : isZh
                              ? "输入私有 VoScript 服务的 API key。"
                              : "Enter the API key for the private VoScript service."
                    }
                >
                    {draft.privateTranscriptionApiKeySet ? (
                        <span data-sot-key-status>
                            {isZh ? "已存储" : "Stored"}
                        </span>
                    ) : null}
                    <Input
                        className={SETTINGS_INPUT_CLASS}
                        id="voscript-api-key"
                        type="password"
                        value={apiKeyDraft}
                        disabled={busy || apiKeyMode === VOSCRIPT_API_KEY_CLEAR}
                        placeholder={
                            draft.privateTranscriptionApiKeySet
                                ? isZh
                                    ? "已存储。输入新 key 可替换。"
                                    : "Stored. Enter a new key to replace it."
                                : ""
                        }
                        onChange={(event) => setApiKeyDraft(event.target.value)}
                    />
                </SettingsRow>
                {draft.privateTranscriptionApiKeySet ? (
                    <SettingsRow
                        label={isZh ? "密钥操作" : "Key action"}
                        description={
                            isZh
                                ? "需要移除已保存密钥时选择清除。"
                                : "Choose clear only when removing the saved key."
                        }
                    >
                        <SelectControl
                            id="voscript-api-key-mode"
                            label={isZh ? "密钥操作" : "Key action"}
                            value={apiKeyMode}
                            disabled={busy}
                            options={[
                                {
                                    label: isZh
                                        ? "保留或替换"
                                        : "Keep or replace",
                                    value: VOSCRIPT_API_KEY_KEEP,
                                },
                                {
                                    label: isZh
                                        ? "清除已保存密钥"
                                        : "Clear saved key",
                                    value: VOSCRIPT_API_KEY_CLEAR,
                                },
                            ]}
                            onChange={setApiKeyMode}
                        />
                    </SettingsRow>
                ) : null}
                <SaveActions
                    disabled={busy}
                    error={connectionSave.saveError}
                    isZh={isZh}
                    onSave={() => void save(connectionSave)}
                    saveId="voscript-connection"
                    saveState={connectionSave.saveState}
                    section="voscript"
                >
                    <Button
                        type="button"
                        variant="settingsTestAction"
                        size="settingsTestAction"
                        aria-busy={isTestingConnection}
                        data-sot-action="test"
                        data-sot-control="voscript-test"
                        data-sot-section="voscript"
                        data-sot-state={connectionTestState}
                        disabled={busy}
                        onClick={() => void testConnection()}
                    >
                        {isTestingConnection ? (
                            <LoaderCircle
                                data-icon="inline-start"
                                aria-hidden="true"
                                className="animate-spin"
                            />
                        ) : null}
                        {isTestingConnection
                            ? isZh
                                ? "正在测试…"
                                : "Testing..."
                            : connectionTestState === "test-success"
                              ? isZh
                                  ? "连接正常"
                                  : "Ready"
                              : isZh
                                ? "测试连接"
                                : "Test connection"}
                    </Button>
                </SaveActions>
            </SettingsGroup>
            <SettingsGroup
                title={
                    isZh ? "转录运行参数" : "Transcription Runtime Parameters"
                }
                subtitle={
                    isZh
                        ? "这些参数会随每个转录任务一起发送给 VoScript。0 通常表示交给服务自行判断。"
                        : "These parameters are sent with each VoScript job. 0 usually lets the service decide."
                }
            >
                <VoScriptSpeakerRows
                    busy={busy}
                    draft={draft}
                    isZh={isZh}
                    maxSpeakersInvalid={maxSpeakersInvalid}
                    maxSpeakersMessage={maxSpeakersMessage}
                    minSpeakersInvalid={minSpeakersInvalid}
                    minSpeakersMessage={minSpeakersMessage}
                    setDraft={setDraft}
                />
                <SettingsRow
                    label={isZh ? "降噪模型" : "Denoise model"}
                    description={
                        isZh
                            ? "提交前对音频应用的降噪策略"
                            : "Denoise strategy applied before submission"
                    }
                >
                    <SelectControl
                        id="voscript-denoise-model"
                        label={isZh ? "降噪模型" : "Denoise model"}
                        options={denoiseOptions}
                        value={draft.privateTranscriptionDenoiseModel}
                        disabled={busy}
                        onChange={(value) =>
                            setDraft((current) => ({
                                ...current,
                                privateTranscriptionDenoiseModel:
                                    value as VoScriptDenoiseModel,
                            }))
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={isZh ? "SNR 阈值" : "SNR threshold"}
                    description={
                        isZh
                            ? "留空使用服务默认"
                            : "Leave blank to use the service default"
                    }
                >
                    <Input
                        className={SETTINGS_NUMBER_INPUT_CLASS}
                        id="voscript-snr-threshold"
                        type="number"
                        value={draft.privateTranscriptionSnrThreshold ?? ""}
                        disabled={busy}
                        placeholder={isZh ? "例如 10" : "e.g. 10"}
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                privateTranscriptionSnrThreshold:
                                    event.target.value === ""
                                        ? null
                                        : Number(event.target.value),
                            }))
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    fieldMessage={
                        noRepeatNgramInvalid ? noRepeatNgramMessage : undefined
                    }
                    fieldState={noRepeatNgramInvalid ? "invalid" : undefined}
                    label={isZh ? "重复抑制 n-gram" : "No-repeat n-gram"}
                    sotField="no-repeat-ngram"
                    description={
                        isZh
                            ? "0 表示关闭；只有 3 及以上的值才会发送给服务"
                            : "0 disables suppression; only values 3 and above are sent to the service."
                    }
                >
                    <Input
                        className={SETTINGS_NUMBER_INPUT_CLASS}
                        id="voscript-no-repeat-ngram"
                        type="number"
                        min={0}
                        aria-invalid={noRepeatNgramInvalid}
                        value={draft.privateTranscriptionNoRepeatNgramSize}
                        disabled={busy}
                        placeholder={isZh ? "0 或 ≥ 3" : "0 or >= 3"}
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                privateTranscriptionNoRepeatNgramSize: Number(
                                    event.target.value,
                                ),
                            }))
                        }
                    />
                </SettingsRow>
                <SettingsRow
                    label={
                        isZh ? "本地调度活跃任务上限" : "Local active job limit"
                    }
                    description={
                        isZh
                            ? "只控制 BetterAINote 同时处理多少个 VoScript 任务，不会改动 VoScript 服务器本身。0 为不限制"
                            : "Only controls how many VoScript jobs BetterAINote handles concurrently. 0 means unlimited."
                    }
                >
                    <Input
                        className={SETTINGS_NUMBER_INPUT_CLASS}
                        id="voscript-max-inflight-jobs"
                        type="number"
                        min={0}
                        value={draft.privateTranscriptionMaxInflightJobs}
                        disabled={busy}
                        placeholder={isZh ? "默认 1" : "Default 1"}
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                privateTranscriptionMaxInflightJobs: Number(
                                    event.target.value,
                                ),
                            }))
                        }
                    />
                </SettingsRow>
                <SaveActions
                    disabled={busy}
                    error={paramsSave.saveError}
                    isZh={isZh}
                    onSave={() => void save(paramsSave)}
                    saveId="voscript-params"
                    saveState={paramsSave.saveState}
                    section="voscript"
                />
            </SettingsGroup>
            <SpeakerProfilesPanel />
        </SectionShell>
    );
}

function TranscriptionSettingsPanel({
    scrollRef,
}: {
    scrollRef?: Ref<HTMLDivElement>;
}) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const transcriptionStore = useTranscriptionSettingsStore();
    const [draft, setDraft] = useState<TranscriptionSettings>(
        transcriptionStore.settings,
    );
    const loading =
        transcriptionStore.isLoading && !transcriptionStore.hasLoaded;
    const loadError =
        !transcriptionStore.hasLoaded && transcriptionStore.loadError
            ? transcriptionStore.loadError
            : null;
    const busy = transcriptionStore.isLoading || transcriptionStore.isSaving;

    useSettingsSectionBusy("transcription", busy);

    useEffect(() => {
        if (transcriptionStore.hasLoaded) {
            setDraft(transcriptionStore.settings);
        }
    }, [transcriptionStore.hasLoaded, transcriptionStore.settings]);

    return (
        <SectionShell
            busy={busy}
            loadError={loadError}
            loading={loading}
            onRetry={() => {
                void transcriptionStore
                    .ensureTranscriptionSettingsLoaded()
                    .catch(() => {});
            }}
            scrollRef={scrollRef}
            section="transcription"
            title={isZh ? "转录设置" : "Transcription Settings"}
        >
            <SettingsGroup
                title={isZh ? "公共转录行为" : "Shared Transcription Behavior"}
                subtitle={
                    isZh
                        ? "只控制 BetterAINote 的公共转录策略。具体上游录音平台请去「数据源」，具体私有服务请去「VoScript 服务」或「AI 重命名服务」。"
                        : "Only controls BetterAINote shared transcription policy. Upstream recording platforms live under Data Sources; private services live under VoScript Service or AI Rename Service."
                }
            >
                <SettingsRow
                    label={
                        isZh
                            ? "自动转录新录音"
                            : "Auto-transcribe new recordings"
                    }
                    description={
                        isZh
                            ? "录音从数据源同步下来后自动进入本地转录队列"
                            : "After recordings sync from data sources, automatically add them to the local transcription queue."
                    }
                >
                    <Switch
                        id="transcription-auto-transcribe"
                        checked={draft.autoTranscribe}
                        disabled={busy}
                        onCheckedChange={(checked) => {
                            setDraft((current) => ({
                                ...current,
                                autoTranscribe: checked,
                            }));
                            void transcriptionStore
                                .updateTranscriptionSettings({
                                    autoTranscribe: checked,
                                })
                                .catch(() => {});
                        }}
                    />
                </SettingsRow>
                <SettingsRow
                    label={
                        isZh ? "默认转录语言" : "Default transcription language"
                    }
                    description={
                        isZh
                            ? "指定 BetterAINote 期望传给转录服务的语言偏好，自动检测会省略 language 字段"
                            : "Language preference passed to transcription services. Auto detect omits the language field."
                    }
                >
                    <SelectControl
                        id="transcription-language"
                        label={
                            isZh
                                ? "默认转录语言"
                                : "Default transcription language"
                        }
                        value={draft.defaultTranscriptionLanguage ?? ""}
                        disabled={busy}
                        options={[
                            {
                                label: isZh ? "自动检测" : "Auto detect",
                                value: "",
                            },
                            { label: isZh ? "中文" : "Chinese", value: "zh" },
                            { label: isZh ? "英语" : "English", value: "en" },
                            { label: isZh ? "日语" : "Japanese", value: "ja" },
                            { label: isZh ? "韩语" : "Korean", value: "ko" },
                            { label: isZh ? "法语" : "French", value: "fr" },
                            { label: isZh ? "德语" : "German", value: "de" },
                            {
                                label: isZh ? "西班牙语" : "Spanish",
                                value: "es",
                            },
                            {
                                label: isZh ? "葡萄牙语" : "Portuguese",
                                value: "pt",
                            },
                            {
                                label: isZh ? "意大利语" : "Italian",
                                value: "it",
                            },
                            { label: isZh ? "俄语" : "Russian", value: "ru" },
                        ]}
                        onChange={(value) => {
                            const defaultTranscriptionLanguage =
                                nullableText(value);
                            setDraft((current) => ({
                                ...current,
                                defaultTranscriptionLanguage,
                            }));
                            void transcriptionStore
                                .updateTranscriptionSettings({
                                    defaultTranscriptionLanguage:
                                        nullableText(value),
                                })
                                .catch(() => {});
                        }}
                    />
                </SettingsRow>
            </SettingsGroup>
        </SectionShell>
    );
}

function SyncSettingsRows({
    busy,
    draft,
    isZh,
    onAutoSyncEnabledChange,
    onSyncIntervalBlur,
    onSyncIntervalChange,
}: {
    busy: boolean;
    draft: SyncSettings;
    isZh: boolean;
    onAutoSyncEnabledChange: (checked: boolean) => void;
    onSyncIntervalBlur: (value: number) => void;
    onSyncIntervalChange: (value: number) => void;
}) {
    return (
        <>
            <SettingsRow
                label={isZh ? "启用后台同步" : "Enable background sync"}
                description={
                    isZh
                        ? "系统会按设定间隔自动检查各数据源是否有新录音或更新"
                        : "The system checks enabled data sources for new or updated recordings on the configured interval."
                }
            >
                <Switch
                    data-sot-control="sync-auto-enabled"
                    data-sot-state={
                        draft.autoSyncEnabled ? "checked" : "unchecked"
                    }
                    id="sync-auto-enabled"
                    checked={draft.autoSyncEnabled}
                    disabled={busy}
                    onCheckedChange={onAutoSyncEnabledChange}
                />
            </SettingsRow>
            <SettingsRow
                label={isZh ? "自动检查间隔" : "Automatic check interval"}
                description={
                    isZh
                        ? `单位为秒，最低 ${MIN_SYNC_INTERVAL_SECONDS} 秒。手动同步不会受这个间隔限制。`
                        : `Seconds. Minimum ${MIN_SYNC_INTERVAL_SECONDS}. Manual sync is not limited by this interval.`
                }
            >
                <Input
                    className={SETTINGS_NUMBER_INPUT_CLASS}
                    data-sot-control="sync-interval-seconds"
                    data-sot-state={busy ? "disabled" : "ready"}
                    id="sync-interval-seconds"
                    type="number"
                    min={MIN_SYNC_INTERVAL_SECONDS}
                    value={draft.syncIntervalSeconds}
                    disabled={busy}
                    onBlur={(event) =>
                        onSyncIntervalBlur(Number(event.currentTarget.value))
                    }
                    onChange={(event) =>
                        onSyncIntervalChange(Number(event.target.value))
                    }
                />
                <span>{isZh ? "秒" : "sec"}</span>
            </SettingsRow>
        </>
    );
}

function PlaybackSettingsRows({
    busy,
    draft,
    isZh,
    onAutoPlayNextChange,
    onDefaultPlaybackSpeedChange,
    onDefaultVolumeChange,
}: {
    busy: boolean;
    draft: PlaybackSettings;
    isZh: boolean;
    onAutoPlayNextChange: (checked: boolean) => void;
    onDefaultPlaybackSpeedChange: (value: string) => void;
    onDefaultVolumeChange: (value: number) => void;
}) {
    const speedOptions: Option<PlaybackSpeed>[] = PLAYBACK_SPEED_OPTIONS.map(
        (speed) => ({
            label: `${speed}x`,
            value: speed,
        }),
    );

    return (
        <>
            <SettingsRow
                label={isZh ? "默认播放速度" : "Default playback speed"}
                description={
                    isZh
                        ? "新录音默认使用的播放速度"
                        : "Default speed used for newly opened recordings"
                }
            >
                <SelectControl
                    control="playback-speed"
                    id="playback-speed"
                    label={isZh ? "默认速度" : "Default speed"}
                    options={speedOptions}
                    value={draft.defaultPlaybackSpeed}
                    disabled={busy}
                    onChange={onDefaultPlaybackSpeedChange}
                />
            </SettingsRow>
            <SettingsRow
                label={isZh ? "默认音量" : "Default volume"}
                description={
                    isZh ? "音频播放默认音量" : "Default audio playback volume"
                }
            >
                <Slider
                    className={SETTINGS_INPUT_CLASS}
                    data-sot-control="playback-volume"
                    data-sot-state={busy ? "disabled" : "ready"}
                    id="playback-volume"
                    min={0}
                    max={100}
                    value={[draft.defaultVolume]}
                    disabled={busy}
                    onValueChange={(values) =>
                        onDefaultVolumeChange(values[0] ?? 0)
                    }
                />
                <span>{draft.defaultVolume}%</span>
            </SettingsRow>
            <SettingsRow
                label={isZh ? "自动播放下一条录音" : "Auto-play next recording"}
                description={
                    isZh
                        ? "当前录音结束后自动播放下一条"
                        : "Play the next recording after the current one ends."
                }
            >
                <Switch
                    data-sot-control="playback-auto-next"
                    data-sot-state={
                        draft.autoPlayNext ? "checked" : "unchecked"
                    }
                    id="playback-auto-next"
                    checked={draft.autoPlayNext}
                    disabled={busy}
                    onCheckedChange={onAutoPlayNextChange}
                />
            </SettingsRow>
            <SettingsRow
                label={isZh ? "键盘快捷键" : "Keyboard shortcuts"}
                description={
                    isZh
                        ? "播放器在聚焦时支持以下按键"
                        : "Supported while the player is focused"
                }
            >
                <div data-sot-shortcuts>
                    <div>
                        <kbd>Space</kbd>
                        <span>{isZh ? "播放 / 暂停" : "Play / pause"}</span>
                    </div>
                    <div>
                        <kbd>←</kbd>
                        <span>{isZh ? "后退 5 秒" : "Back 5 seconds"}</span>
                    </div>
                    <div>
                        <kbd>→</kbd>
                        <span>{isZh ? "前进 5 秒" : "Forward 5 seconds"}</span>
                    </div>
                    <div>
                        <kbd>↑</kbd>
                        <span>{isZh ? "提高音量" : "Volume up"}</span>
                    </div>
                    <div>
                        <kbd>↓</kbd>
                        <span>{isZh ? "降低音量" : "Volume down"}</span>
                    </div>
                </div>
            </SettingsRow>
        </>
    );
}

function MiscSettingsPanel({ scrollRef }: { scrollRef?: Ref<HTMLDivElement> }) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const syncStore = useSyncSettingsStore();
    const playbackStore = usePlaybackSettingsStore();
    const [syncDraft, setSyncDraft] = useState<SyncSettings>(
        syncStore.settings,
    );
    const [playbackDraft, setPlaybackDraft] = useState<PlaybackSettings>(
        playbackStore.settings,
    );
    const loading =
        (syncStore.isLoading && !syncStore.hasLoaded) ||
        (playbackStore.isLoading && !playbackStore.hasLoaded);
    const loadError =
        !syncStore.hasLoaded && syncStore.loadError
            ? syncStore.loadError
            : !playbackStore.hasLoaded && playbackStore.loadError
              ? playbackStore.loadError
              : null;
    const busy =
        syncStore.isLoading ||
        syncStore.isSaving ||
        playbackStore.isLoading ||
        playbackStore.isSaving;

    useSettingsSectionBusy("misc", busy);

    useEffect(() => {
        if (syncStore.hasLoaded) setSyncDraft(syncStore.settings);
    }, [syncStore.hasLoaded, syncStore.settings]);

    useEffect(() => {
        if (playbackStore.hasLoaded) setPlaybackDraft(playbackStore.settings);
    }, [playbackStore.hasLoaded, playbackStore.settings]);

    const handleAutoSyncEnabledChange = (checked: boolean) => {
        setSyncDraft((current) => ({
            ...current,
            autoSyncEnabled: checked,
        }));
        void syncStore
            .updateSyncSettings({
                autoSyncEnabled: checked,
            })
            .catch(() => {});
    };

    const handleSyncIntervalChange = (value: number) => {
        setSyncDraft((current) => ({
            ...current,
            syncIntervalSeconds: value,
        }));
    };

    const onSyncIntervalBlur = (value: number) => {
        const normalizedInterval = Number.isFinite(value)
            ? Math.max(MIN_SYNC_INTERVAL_SECONDS, Math.floor(value))
            : MIN_SYNC_INTERVAL_SECONDS;

        setSyncDraft((current) => ({
            ...current,
            syncIntervalSeconds: normalizedInterval,
        }));

        if (syncStore.settings.syncIntervalSeconds === normalizedInterval) {
            return;
        }

        void syncStore
            .updateSyncSettings({
                syncIntervalSeconds: normalizedInterval,
            })
            .catch(() => {});
    };

    const handleDefaultPlaybackSpeedChange = (value: string) => {
        const defaultPlaybackSpeed = Number(value) as PlaybackSpeed;
        setPlaybackDraft((current) => ({
            ...current,
            defaultPlaybackSpeed,
        }));
        void playbackStore
            .updatePlaybackSettings({
                defaultPlaybackSpeed: defaultPlaybackSpeed,
            })
            .catch(() => {});
    };

    const handleDefaultVolumeChange = (value: number) => {
        const defaultVolume = clampInteger(value, 0, 100);
        setPlaybackDraft((current) => ({
            ...current,
            defaultVolume,
        }));
        void playbackStore
            .updatePlaybackSettings({
                defaultVolume: defaultVolume,
            })
            .catch(() => {});
    };

    const handleAutoPlayNextChange = (checked: boolean) => {
        setPlaybackDraft((current) => ({
            ...current,
            autoPlayNext: checked,
        }));
        void playbackStore
            .updatePlaybackSettings({
                autoPlayNext: checked,
            })
            .catch(() => {});
    };

    return (
        <SectionShell
            busy={busy}
            loadError={loadError}
            loading={loading}
            onRetry={() => {
                void syncStore.ensureSyncSettingsLoaded().catch(() => {});
                void playbackStore
                    .ensurePlaybackSettingsLoaded()
                    .catch(() => {});
            }}
            scrollRef={scrollRef}
            section="misc"
            title={isZh ? "杂项" : "Misc"}
            subtitle={
                isZh
                    ? "同步、播放和其它非 provider 设置统一收敛在这里，避免继续新增平行设置页。"
                    : "Sync, playback, and other non-provider settings are collected here."
            }
        >
            <SettingsGroup
                title={isZh ? "同步设置" : "Sync Settings"}
                subtitle={
                    isZh
                        ? "控制后台同步检查，不直接绑定某一个数据源。"
                        : "Control background sync checks without binding to one data source."
                }
            >
                <SyncSettingsRows
                    busy={busy}
                    draft={syncDraft}
                    isZh={isZh}
                    onAutoSyncEnabledChange={handleAutoSyncEnabledChange}
                    onSyncIntervalBlur={onSyncIntervalBlur}
                    onSyncIntervalChange={handleSyncIntervalChange}
                />
            </SettingsGroup>
            <SettingsGroup
                title={isZh ? "播放设置" : "Playback Settings"}
                subtitle={
                    isZh
                        ? "控制录音播放默认行为和常用快捷键。"
                        : "Control default recording playback and common shortcuts."
                }
            >
                <PlaybackSettingsRows
                    busy={busy}
                    draft={playbackDraft}
                    isZh={isZh}
                    onAutoPlayNextChange={handleAutoPlayNextChange}
                    onDefaultPlaybackSpeedChange={
                        handleDefaultPlaybackSpeedChange
                    }
                    onDefaultVolumeChange={handleDefaultVolumeChange}
                />
            </SettingsGroup>
        </SectionShell>
    );
}

export function SettingsContent({
    activeSection,
    scrollRef,
}: SettingsContentProps) {
    switch (activeSection) {
        case "transcription":
            return <TranscriptionSettingsPanel scrollRef={scrollRef} />;
        case "title-generation":
            return <TitleGenerationSettingsPanel scrollRef={scrollRef} />;
        case "voscript":
            return <VoScriptSettingsPanel scrollRef={scrollRef} />;
        case "data-sources":
            return <DataSourcesSettingsPanel scrollRef={scrollRef} />;
        case "appearance":
            return <DisplaySettingsPanel scrollRef={scrollRef} />;
        case "misc":
            return <MiscSettingsPanel scrollRef={scrollRef} />;
        default:
            return null;
    }
}
