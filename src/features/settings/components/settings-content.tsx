"use client";

import { AlertCircle, CheckCircle2, RotateCw, XCircle } from "lucide-react";
import { type ComponentProps, type Ref, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Field,
    FieldContent,
    FieldControl,
    FieldDescription,
    FieldError,
    FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettingsSectionBusy } from "@/features/settings/components/settings-busy-context";
import { SettingsSectionSkeleton } from "@/features/settings/components/settings-skeletons";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import { usePlaybackSettingsStore } from "@/features/settings/playback-settings-store";
import { useSyncSettingsStore } from "@/features/settings/sync-settings-store";
import { useTitleGenerationSettingsStore } from "@/features/settings/title-generation-settings-store";
import { useTranscriptionSettingsStore } from "@/features/settings/transcription-settings-store";
import type { UiLanguage } from "@/lib/i18n";
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
import type { SettingsSection } from "@/types/settings";
import { DataSourcesSection } from "./sections/data-sources-section";
import { VoScriptSection } from "./sections/voscript-section";

interface SettingsContentProps {
    activeSection: SettingsSection;
    scrollRef?: Ref<HTMLDivElement>;
}

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

const SETTINGS_BANNER_BASE_CLASS = "mb-4";

const SETTINGS_BANNER_TITLE_CLASS = "";

const SETTINGS_BANNER_DESCRIPTION_CLASS = "";

const SETTINGS_SHORTCUTS_GRID_CLASS =
    "grid grid-cols-[1fr_auto] gap-x-3.5 gap-y-2";

const SETTINGS_SHORTCUT_ROW_CLASS =
    "flex items-center gap-2 border-b border-dashed border-border py-1.5 text-sm font-medium text-foreground";

const SETTINGS_SHORTCUT_KEY_CLASS =
    "rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground";

const SETTINGS_SEGMENT_GROUP_CLASS = "flex-wrap";

const SETTINGS_FIELD_ROW_CLASS =
    "border-b border-border py-3 last:border-b-0 @md/field-group:gap-4";

const SETTINGS_FIELD_CONTENT_CLASS = "min-w-0 gap-1";

const SETTINGS_FIELD_CONTROL_CLASS =
    "flex min-w-0 flex-wrap items-center justify-end gap-2 @md/field-group:justify-end";

const SETTINGS_SCROLL_BODY_CLASS =
    "min-h-0 overflow-y-auto px-[26px] py-[22px] [overscroll-behavior:contain]";

const SETTINGS_SECTION_TITLE_CLASS =
    "mb-[18px] text-lg font-semibold text-foreground";

const SETTINGS_SECTION_GROUP_CLASS = "relative mb-[22px]";

const SETTINGS_SECTION_HEAD_CLASS = "mb-1.5";

const SETTINGS_SECTION_HEAD_TITLE_CLASS =
    "m-0 text-sm font-semibold text-foreground";

const SETTINGS_SECTION_HEAD_DESCRIPTION_CLASS =
    "mt-1 mb-0 max-w-[64ch] text-sm leading-relaxed text-muted-foreground";

const SETTINGS_SAVE_ACTIONS_CLASS =
    "mt-[18px] ml-auto flex flex-row-reverse items-center gap-2";

type SectionSaveState = "idle" | "saving" | "saved" | "error";

interface Option<Value extends string | number = string> {
    label: string;
    value: Value;
}

const ITEMS_PER_PAGE_MIN = 10;
const ITEMS_PER_PAGE_MAX = 200;
const TITLE_API_KEY_KEEP = "__keep_title_generation_key__";
const TITLE_API_KEY_CLEAR = "__clear_title_generation_key__";
const SETTINGS_INPUT_CLASS = "min-w-60 max-w-full";
const SETTINGS_NUMBER_INPUT_CLASS = "w-24 max-w-full";

function getErrorMessage(error: unknown, defaultMessage: string) {
    return error instanceof Error && error.message.trim()
        ? error.message
        : defaultMessage;
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
    statusId,
}: {
    error: string | null;
    isZh: boolean;
    saveState: SectionSaveState;
    statusId: string;
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
    const statusVariant: BadgeVariant =
        saveState === "error"
            ? "destructive"
            : saveState === "saved" || saveState === "saving"
              ? "default"
              : "secondary";
    const isIdle = saveState === "idle";
    const statusClassName = cn("gap-1.5", isIdle && "hidden");
    const statusRole = isIdle
        ? undefined
        : saveState === "error"
          ? "alert"
          : "status";
    const statusLive = isIdle
        ? undefined
        : saveState === "error"
          ? "assertive"
          : "polite";

    return (
        <Badge
            id={statusId}
            variant={statusVariant}
            className={statusClassName}
            role={statusRole}
            aria-live={statusLive}
            aria-atomic={isIdle ? undefined : "true"}
        >
            {saveState === "saving" ? (
                <Spinner size="2xs" aria-hidden="true" />
            ) : saveState === "saved" ? (
                <CheckCircle2 aria-hidden="true" />
            ) : saveState === "error" ? (
                <XCircle aria-hidden="true" />
            ) : null}
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
    subtitle,
    title,
}: {
    busy: boolean;
    children: React.ReactNode;
    loadError: string | null;
    loading: boolean;
    onRetry: () => void;
    scrollRef?: Ref<HTMLDivElement>;
    subtitle?: string;
    title: string;
}) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";

    if (loading) {
        return (
            <SettingsSectionSkeleton fieldsPerCard={2} scrollRef={scrollRef} />
        );
    }

    if (loadError) {
        return (
            <div
                ref={scrollRef}
                aria-busy={busy}
                className={SETTINGS_SCROLL_BODY_CLASS}
            >
                <Alert
                    variant="destructiveSoft"
                    density="comfortable"
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
                            onClick={onRetry}
                        >
                            <RotateCw
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {isZh ? "重试" : "Retry"}
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            aria-busy={busy}
            className={SETTINGS_SCROLL_BODY_CLASS}
        >
            <h3 className={SETTINGS_SECTION_TITLE_CLASS}>{title}</h3>
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
        <section className={SETTINGS_SECTION_GROUP_CLASS}>
            <header className={SETTINGS_SECTION_HEAD_CLASS}>
                <h4 className={SETTINGS_SECTION_HEAD_TITLE_CLASS}>{title}</h4>
                {subtitle ? (
                    <p className={SETTINGS_SECTION_HEAD_DESCRIPTION_CLASS}>
                        {subtitle}
                    </p>
                ) : null}
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
}: {
    children?: React.ReactNode;
    description?: string;
    fieldMessage?: string;
    fieldState?: "invalid";
    label: string;
}) {
    return (
        <Field
            data-invalid={fieldState === "invalid" ? "true" : undefined}
            orientation="horizontal"
            className={SETTINGS_FIELD_ROW_CLASS}
        >
            <FieldContent className={SETTINGS_FIELD_CONTENT_CLASS}>
                <FieldTitle>{label}</FieldTitle>
                {description ? (
                    <FieldDescription>{description}</FieldDescription>
                ) : null}
                {fieldMessage ? <FieldError>{fieldMessage}</FieldError> : null}
            </FieldContent>
            {children ? (
                <FieldControl className={SETTINGS_FIELD_CONTROL_CLASS}>
                    {children}
                </FieldControl>
            ) : null}
        </Field>
    );
}

function SelectControl<Value extends string | number>({
    disabled,
    id,
    label,
    onChange,
    options,
    value,
}: {
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
    disabled,
    label,
    onChange,
    options,
    value,
}: {
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
            disabled={disabled}
            className={SETTINGS_SEGMENT_GROUP_CLASS}
            size="sm"
            spacing={1}
            type="single"
            value={value}
            variant="outline"
            onValueChange={(nextValue) => {
                if (typeof nextValue === "string" && nextValue) {
                    onChange(nextValue as Value);
                }
            }}
        >
            {options.map((option) => {
                return (
                    <ToggleGroupItem
                        key={option.value}
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
    const statusId = `${saveId ?? section}-save-status`;
    const saveButtonLabel =
        saveState === "saving"
            ? isZh
                ? "保存中"
                : "Saving"
            : saveState === "saved"
              ? isZh
                  ? "已保存"
                  : "Saved"
              : isZh
                ? "保存"
                : "Save";

    return (
        <div className={SETTINGS_SAVE_ACTIONS_CLASS}>
            <SaveStatus
                error={error}
                isZh={isZh}
                saveState={saveState}
                statusId={statusId}
            />
            {children}
            <Button
                type="button"
                variant="default"
                size="sm"
                disabled={disabled}
                aria-busy={saveState === "saving"}
                aria-describedby={saveState === "idle" ? undefined : statusId}
                aria-label={saveButtonLabel}
                onClick={onSave}
            >
                {saveState === "saving" ? (
                    <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : null}
                {saveButtonLabel}
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
        },
        {
            label: "14:00",
            value: "absolute",
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
                        aria-label={
                            isZh
                                ? "基于逐字稿自动重命名"
                                : "Automatically rename from transcripts"
                        }
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
                        aria-label={
                            isZh ? "重命名服务地址" : "Rename service URL"
                        }
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
                        aria-label={isZh ? "重命名模型" : "Rename model"}
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
                        <Badge variant="secondary" role="status">
                            <CheckCircle2
                                aria-hidden="true"
                                data-icon="inline-start"
                            />
                            {isZh ? "已存储" : "Stored"}
                        </Badge>
                    ) : null}
                    <Input
                        className={SETTINGS_INPUT_CLASS}
                        id="title-generation-api-key"
                        aria-label={
                            isZh
                                ? "重命名服务 API Key"
                                : "Rename service API key"
                        }
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
                <div className={SETTINGS_SHORTCUTS_GRID_CLASS}>
                    <div className={SETTINGS_SHORTCUT_ROW_CLASS}>
                        <kbd className={SETTINGS_SHORTCUT_KEY_CLASS}>Space</kbd>
                        <span>{isZh ? "播放 / 暂停" : "Play / pause"}</span>
                    </div>
                    <div className={SETTINGS_SHORTCUT_ROW_CLASS}>
                        <kbd className={SETTINGS_SHORTCUT_KEY_CLASS}>←</kbd>
                        <span>{isZh ? "后退 5 秒" : "Back 5 seconds"}</span>
                    </div>
                    <div className={SETTINGS_SHORTCUT_ROW_CLASS}>
                        <kbd className={SETTINGS_SHORTCUT_KEY_CLASS}>→</kbd>
                        <span>{isZh ? "前进 5 秒" : "Forward 5 seconds"}</span>
                    </div>
                    <div className={SETTINGS_SHORTCUT_ROW_CLASS}>
                        <kbd className={SETTINGS_SHORTCUT_KEY_CLASS}>↑</kbd>
                        <span>{isZh ? "提高音量" : "Volume up"}</span>
                    </div>
                    <div className={SETTINGS_SHORTCUT_ROW_CLASS}>
                        <kbd className={SETTINGS_SHORTCUT_KEY_CLASS}>↓</kbd>
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
            return <VoScriptSection scrollRef={scrollRef} />;
        case "data-sources":
            return <DataSourcesSection scrollRef={scrollRef} />;
        case "appearance":
            return <DisplaySettingsPanel scrollRef={scrollRef} />;
        case "misc":
            return <MiscSettingsPanel scrollRef={scrollRef} />;
        default:
            return null;
    }
}
