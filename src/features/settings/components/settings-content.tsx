"use client";

import { AlertCircle, CheckCircle2, RotateCw, XCircle } from "lucide-react";
import {
    type ComponentProps,
    type Ref,
    useEffect,
    useRef,
    useState,
} from "react";
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
import { SpeakerProfilesPanel } from "@/features/settings/components/sections/speaker-profiles-panel";
import { useSettingsSectionBusy } from "@/features/settings/components/settings-busy-context";
import { SettingsSectionSkeleton } from "@/features/settings/components/settings-skeletons";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import { usePlaybackSettingsStore } from "@/features/settings/playback-settings-store";
import { useSyncSettingsStore } from "@/features/settings/sync-settings-store";
import { useTitleGenerationSettingsStore } from "@/features/settings/title-generation-settings-store";
import { useTranscriptionSettingsStore } from "@/features/settings/transcription-settings-store";
import { useVoScriptSettingsStore } from "@/features/settings/voscript-settings-store";
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
import type {
    VoScriptDenoiseModel,
    VoScriptSettings,
    VoScriptSettingsUpdate,
} from "@/services/voscript-settings";
import { testVoScriptConnection } from "@/services/voscript-settings";
import type { SettingsSection } from "@/types/settings";
import { DataSourcesSection } from "./sections/data-sources-section";

interface SettingsContentProps {
    activeSection: SettingsSection;
    scrollRef?: Ref<HTMLDivElement>;
}

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;
type VoScriptConnectionTestState =
    | "idle"
    | "testing"
    | "test-success"
    | "test-error";
type VoScriptSettingsSaveLane = "connection" | "params";

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
    const statusVariant: BadgeVariant =
        saveState === "error"
            ? "destructive"
            : saveState === "saved" || saveState === "saving"
              ? "default"
              : "secondary";
    const statusClassName = cn("gap-1.5", saveState === "idle" && "hidden");

    return (
        <Badge
            variant={statusVariant}
            className={statusClassName}
            data-sot-part="settings-save-status"
            data-sot-state={saveState}
        >
            {saveState === "saving" ? (
                <Spinner
                    size="2xs"
                    aria-hidden="true"
                    data-sot-part="settings-save-status-indicator"
                />
            ) : saveState === "saved" ? (
                <CheckCircle2
                    aria-hidden="true"
                    data-sot-part="settings-save-status-indicator"
                />
            ) : saveState === "error" ? (
                <XCircle
                    aria-hidden="true"
                    data-sot-part="settings-save-status-indicator"
                />
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
                className={SETTINGS_SCROLL_BODY_CLASS}
            >
                <Alert
                    variant="destructiveSoft"
                    density="comfortable"
                    data-sot-banner="settings-section-load-error"
                    data-sot-panel="settings-section-load-error"
                    data-sot-section={section}
                    data-sot-tone="err"
                    className={SETTINGS_BANNER_BASE_CLASS}
                >
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle
                        className={SETTINGS_BANNER_TITLE_CLASS}
                        data-sot-banner-title
                    >
                        {isZh ? "加载失败" : "Load failed"}
                    </AlertTitle>
                    <AlertDescription
                        className={SETTINGS_BANNER_DESCRIPTION_CLASS}
                        data-sot-banner-sub
                    >
                        <span>{loadError}</span>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="mt-3"
                            onClick={onRetry}
                            data-sot-control="settings-section-load-retry"
                            data-sot-section={section}
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
            data-sot-layout="section"
            data-sot-panel="settings-scroll-body"
            data-sot-section={section}
            data-sot-state={busy ? "busy" : "ready"}
            data-sot-surface="settings-section"
            data-sot-availability={voscriptAvailability}
            className={SETTINGS_SCROLL_BODY_CLASS}
        >
            <h3 className={SETTINGS_SECTION_TITLE_CLASS} data-sot-title>
                {title}
            </h3>
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
        <section
            className={SETTINGS_SECTION_GROUP_CLASS}
            data-sot-section-group
        >
            <header
                className={SETTINGS_SECTION_HEAD_CLASS}
                data-sot-section-head
            >
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
            className={SETTINGS_FIELD_ROW_CLASS}
        >
            <FieldContent className={SETTINGS_FIELD_CONTENT_CLASS}>
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
                <FieldControl className={SETTINGS_FIELD_CONTROL_CLASS}>
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
            className={SETTINGS_SAVE_ACTIONS_CLASS}
            data-sot-panel="settings-save-actions"
            data-sot-save-id={saveId ?? section}
            data-sot-section={section}
            data-sot-state={saveState}
        >
            <SaveStatus error={error} isZh={isZh} saveState={saveState} />
            {children}
            <Button
                type="button"
                variant="default"
                size="sm"
                disabled={disabled}
                aria-busy={saveState === "saving"}
                data-sot-action="save"
                data-sot-control="settings-save"
                data-sot-section={section}
                data-sot-state={saveState}
                onClick={onSave}
            >
                {saveState === "saving" ? (
                    <Spinner data-icon="inline-start" aria-hidden="true" />
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
                        data-sot-control="title-generation-enabled"
                        data-sot-state={
                            draft.autoGenerateTitle ? "checked" : "unchecked"
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
                        data-sot-control="title-generation-base-url"
                        data-sot-state={busy ? "disabled" : "ready"}
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
                        data-sot-control="title-generation-model"
                        data-sot-state={busy ? "disabled" : "ready"}
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
                        <Badge
                            variant="secondary"
                            data-sot-key-status
                            data-sot-state="stored"
                        >
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
                        data-sot-control="title-generation-api-key"
                        data-sot-state={
                            busy
                                ? "disabled"
                                : draft.titleGenerationApiKeySet
                                  ? "stored"
                                  : "ready"
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

function applyVoScriptSpeakerDraft(
    draft: VoScriptSettings,
    updates: Partial<VoScriptSettings>,
) {
    return { ...draft, ...updates };
}

function didVoScriptConnectionSettingsChange(
    previousSettings: VoScriptSettings,
    nextSettings: VoScriptSettings,
) {
    return (
        previousSettings.privateTranscriptionBaseUrl !==
            nextSettings.privateTranscriptionBaseUrl ||
        previousSettings.privateTranscriptionApiKeySet !==
            nextSettings.privateTranscriptionApiKeySet
    );
}

function didVoScriptRuntimeSettingsChange(
    previousSettings: VoScriptSettings,
    nextSettings: VoScriptSettings,
) {
    return (
        previousSettings.privateTranscriptionMinSpeakers !==
            nextSettings.privateTranscriptionMinSpeakers ||
        previousSettings.privateTranscriptionMaxSpeakers !==
            nextSettings.privateTranscriptionMaxSpeakers ||
        previousSettings.privateTranscriptionDenoiseModel !==
            nextSettings.privateTranscriptionDenoiseModel ||
        previousSettings.privateTranscriptionSnrThreshold !==
            nextSettings.privateTranscriptionSnrThreshold ||
        previousSettings.privateTranscriptionNoRepeatNgramSize !==
            nextSettings.privateTranscriptionNoRepeatNgramSize ||
        previousSettings.privateTranscriptionMaxInflightJobs !==
            nextSettings.privateTranscriptionMaxInflightJobs
    );
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
                    data-sot-control="voscript-min-speakers"
                    data-sot-state={
                        minSpeakersInvalid
                            ? "invalid"
                            : busy
                              ? "disabled"
                              : "ready"
                    }
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
                    data-sot-control="voscript-max-speakers"
                    data-sot-state={
                        maxSpeakersInvalid
                            ? "invalid"
                            : busy
                              ? "disabled"
                              : "ready"
                    }
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
    const pendingSaveLaneRef = useRef<VoScriptSettingsSaveLane | null>(null);
    const previousSettingsRef = useRef(settings);
    const hasSyncedLoadedSettingsRef = useRef(false);
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
        const previousSettings = previousSettingsRef.current;
        previousSettingsRef.current = settings;
        const hasSyncedLoadedSettings = hasSyncedLoadedSettingsRef.current;
        hasSyncedLoadedSettingsRef.current = true;
        const connectionSettingsChanged = didVoScriptConnectionSettingsChange(
            previousSettings,
            settings,
        );
        const runtimeSettingsChanged = didVoScriptRuntimeSettingsChange(
            previousSettings,
            settings,
        );
        let saveLane: VoScriptSettingsSaveLane | null = null;
        if (hasSyncedLoadedSettings) {
            saveLane = pendingSaveLaneRef.current;
            if (saveLane === null && connectionSettingsChanged) {
                saveLane = runtimeSettingsChanged ? null : "connection";
            }
            if (saveLane === null && runtimeSettingsChanged) {
                saveLane = connectionSettingsChanged ? null : "params";
            }
        }
        setDraft((currentDraft) => {
            if (saveLane === "connection") {
                return {
                    ...currentDraft,
                    privateTranscriptionBaseUrl:
                        settings.privateTranscriptionBaseUrl,
                    privateTranscriptionApiKeySet:
                        settings.privateTranscriptionApiKeySet,
                };
            }

            if (saveLane === "params") {
                return {
                    ...currentDraft,
                    privateTranscriptionDenoiseModel:
                        settings.privateTranscriptionDenoiseModel,
                    privateTranscriptionMaxInflightJobs:
                        settings.privateTranscriptionMaxInflightJobs,
                    privateTranscriptionMaxSpeakers:
                        settings.privateTranscriptionMaxSpeakers,
                    privateTranscriptionMinSpeakers:
                        settings.privateTranscriptionMinSpeakers,
                    privateTranscriptionNoRepeatNgramSize:
                        settings.privateTranscriptionNoRepeatNgramSize,
                    privateTranscriptionSnrThreshold:
                        settings.privateTranscriptionSnrThreshold,
                };
            }

            return settings;
        });
        if (saveLane === null) {
            setApiKeyDraft("");
            setApiKeyMode(VOSCRIPT_API_KEY_KEEP);
        }
        if (saveLane !== "params") {
            setConnectionTestState("idle");
            setConnectionTestMessage(null);
        }
    }, [hasLoaded, settings]);

    const connectionDraftSignature = `${draft.privateTranscriptionBaseUrl ?? ""}\u0000${apiKeyDraft}\u0000${apiKeyMode}`;

    // biome-ignore lint/correctness/useExhaustiveDependencies: This intentionally resets test UI when the connection draft signature changes.
    useEffect(() => {
        if (connectionTestState === "idle") return;
        setConnectionTestState("idle");
        setConnectionTestMessage(null);
    }, [connectionDraftSignature]);

    const persistVoScriptSettingsLane = async (
        saveLane: typeof connectionSave,
        saveLaneName: VoScriptSettingsSaveLane,
        updates: VoScriptSettingsUpdate,
        onSaved?: () => void,
        onError?: () => void,
    ) => {
        pendingSaveLaneRef.current = saveLaneName;
        saveLane.setSaveState("saving");
        saveLane.setSaveError(null);
        try {
            await updateVoScriptSettings(updates);
            onSaved?.();
            saveLane.setSaveState("saved");
        } catch (error) {
            onError?.();
            saveLane.setSaveError(
                getErrorMessage(error, "Failed to update VoScript settings"),
            );
            saveLane.setSaveState("error");
        } finally {
            pendingSaveLaneRef.current = null;
        }
    };

    const saveConnectionSettings = async () => {
        const draftBeforeSave = { ...draft };
        const updates: VoScriptSettingsUpdate = {
            privateTranscriptionBaseUrl: nullableText(
                draft.privateTranscriptionBaseUrl ?? "",
            ),
        };

        if (apiKeyMode === VOSCRIPT_API_KEY_CLEAR) {
            updates.privateTranscriptionApiKey = null;
        } else if (apiKeyDraft.trim()) {
            updates.privateTranscriptionApiKey = apiKeyDraft.trim();
        }

        await persistVoScriptSettingsLane(
            connectionSave,
            "connection",
            updates,
            () => {
                setApiKeyDraft("");
                setApiKeyMode(VOSCRIPT_API_KEY_KEEP);
            },
            () => setDraft(draftBeforeSave),
        );
    };

    const saveRuntimeParams = async () => {
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

        const draftBeforeSave = { ...draft };
        const updates: VoScriptSettingsUpdate = {
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

        await persistVoScriptSettingsLane(
            paramsSave,
            "params",
            updates,
            undefined,
            () => setDraft(draftBeforeSave),
        );
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
                    variant={
                        connectionTestState === "test-error"
                            ? "destructiveSoft"
                            : "default"
                    }
                    density="comfortable"
                    data-sot-banner="voscript-unavailable"
                    data-sot-panel="voscript-unavailable-banner"
                    data-sot-state={
                        connectionTestState === "test-error"
                            ? "test-error"
                            : "missing-connection"
                    }
                    data-sot-tone="warn"
                    className={SETTINGS_BANNER_BASE_CLASS}
                >
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle
                        className={SETTINGS_BANNER_TITLE_CLASS}
                        data-sot-banner-title
                    >
                        {isZh
                            ? "VoScript 当前不可用"
                            : "VoScript is unavailable"}
                    </AlertTitle>
                    <AlertDescription
                        className={SETTINGS_BANNER_DESCRIPTION_CLASS}
                        data-sot-banner-hint
                    >
                        {connectionTestState === "test-error" &&
                        connectionTestMessage
                            ? connectionTestMessage
                            : isZh
                              ? "服务地址或 API key 缺失，列表中将无法触发新转写。填好下面字段并保存后会自动重试。"
                              : "The service URL or API key is missing. New transcription jobs cannot start until you fill these fields and save."}
                    </AlertDescription>
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
                        data-sot-control="voscript-base-url"
                        data-sot-state={busy ? "disabled" : "ready"}
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
                        <Badge
                            variant="secondary"
                            data-sot-key-status
                            data-sot-state="stored"
                        >
                            <CheckCircle2
                                aria-hidden="true"
                                data-icon="inline-start"
                            />
                            {isZh ? "已存储" : "Stored"}
                        </Badge>
                    ) : null}
                    <Input
                        className={SETTINGS_INPUT_CLASS}
                        id="voscript-api-key"
                        data-sot-control="voscript-api-key"
                        data-sot-state={
                            busy || apiKeyMode === VOSCRIPT_API_KEY_CLEAR
                                ? "disabled"
                                : draft.privateTranscriptionApiKeySet
                                  ? "stored"
                                  : "ready"
                        }
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
                            control="voscript-api-key-mode"
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
                    onSave={() => void saveConnectionSettings()}
                    saveId="voscript-connection"
                    saveState={connectionSave.saveState}
                    section="voscript"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-busy={isTestingConnection}
                        data-sot-action="test"
                        data-sot-control="voscript-test"
                        data-sot-section="voscript"
                        data-sot-state={connectionTestState}
                        disabled={busy}
                        onClick={() => void testConnection()}
                    >
                        {isTestingConnection ? (
                            <Spinner
                                data-icon="inline-start"
                                aria-hidden="true"
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
                        control="voscript-denoise-model"
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
                        data-sot-control="voscript-snr-threshold"
                        data-sot-state={busy ? "disabled" : "ready"}
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
                        data-sot-control="voscript-no-repeat-ngram"
                        data-sot-state={
                            noRepeatNgramInvalid
                                ? "invalid"
                                : busy
                                  ? "disabled"
                                  : "ready"
                        }
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
                        data-sot-control="voscript-max-inflight-jobs"
                        data-sot-state={busy ? "disabled" : "ready"}
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
                    onSave={() => void saveRuntimeParams()}
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
                        data-sot-control="transcription-auto-transcribe"
                        data-sot-state={
                            draft.autoTranscribe ? "checked" : "unchecked"
                        }
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
                        control="transcription-language"
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
                <div
                    className={SETTINGS_SHORTCUTS_GRID_CLASS}
                    data-sot-shortcuts
                >
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
            return <DataSourcesSection scrollRef={scrollRef} />;
        case "appearance":
            return <DisplaySettingsPanel scrollRef={scrollRef} />;
        case "misc":
            return <MiscSettingsPanel scrollRef={scrollRef} />;
        default:
            return null;
    }
}
