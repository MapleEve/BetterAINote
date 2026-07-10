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
import { Spinner } from "@/components/ui/spinner";
import { SpeakerProfilesPanel } from "@/features/settings/components/sections/speaker-profiles-panel";
import { useSettingsSectionBusy } from "@/features/settings/components/settings-busy-context";
import { SettingsSectionSkeleton } from "@/features/settings/components/settings-skeletons";
import { useVoScriptSettingsStore } from "@/features/settings/voscript-settings-store";
import { cn } from "@/lib/utils";
import type {
    VoScriptDenoiseModel,
    VoScriptSettings,
    VoScriptSettingsUpdate,
} from "@/services/voscript-settings";
import { testVoScriptConnection } from "@/services/voscript-settings";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;
type VoScriptConnectionTestState =
    | "idle"
    | "testing"
    | "test-success"
    | "test-error";
type VoScriptSettingsSaveLane = "connection" | "params";
type SectionSaveState = "idle" | "saving" | "saved" | "error";

interface Option<Value extends string | number = string> {
    label: string;
    sotValue?: string;
    value: Value;
}

const SETTINGS_BANNER_BASE_CLASS = "mb-4";

const SETTINGS_BANNER_TITLE_CLASS = "";

const SETTINGS_BANNER_DESCRIPTION_CLASS = "";

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

export function VoScriptSection({
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
