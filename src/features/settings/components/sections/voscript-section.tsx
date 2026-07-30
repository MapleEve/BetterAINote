"use client";

import { AlertCircle, CheckCircle2, RotateCw, XCircle } from "lucide-react";
import { type Ref, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldContent,
    FieldControl,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SpeakerProfilesPanel } from "@/features/settings/components/sections/speaker-profiles-panel";
import { useSettingsSectionBusy } from "@/features/settings/components/settings-busy-context";
import { SettingsSectionSkeleton } from "@/features/settings/components/settings-skeletons";
import { useVoScriptSettingsStore } from "@/features/settings/voscript-settings-store";
import type {
    VoScriptDenoiseModel,
    VoScriptSettings,
    VoScriptSettingsUpdate,
} from "@/services/voscript-settings";
import { testVoScriptConnection } from "@/services/voscript-settings";

type VoScriptConnectionTestState =
    | "idle"
    | "testing"
    | "test-success"
    | "test-error";
type VoScriptSettingsSaveLane = "connection" | "params";
type SectionSaveState = "idle" | "saving" | "saved" | "error";

interface Option<Value extends string | number = string> {
    label: string;
    value: Value;
}

const VOSCRIPT_API_KEY_KEEP = "__keep_voscript_key__";
const VOSCRIPT_API_KEY_CLEAR = "__clear_voscript_key__";

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

function getFieldDescribedBy(
    id: string,
    hasError = false,
    additionalId?: string,
) {
    return [
        `${id}-description`,
        hasError ? `${id}-error` : undefined,
        additionalId,
    ]
        .filter((value): value is string => Boolean(value))
        .join(" ");
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
            <Field
                data-invalid={minSpeakersInvalid ? "true" : undefined}
                orientation="responsive"
                className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
            >
                <FieldContent className="min-w-0 gap-1">
                    <FieldLabel htmlFor="voscript-min-speakers">
                        {isZh ? "最少说话人数" : "Minimum speakers"}
                    </FieldLabel>
                    <FieldDescription id="voscript-min-speakers-description">
                        {isZh ? "0 为自动" : "0 means automatic"}
                    </FieldDescription>
                    {minSpeakersMessage ? (
                        <FieldError id="voscript-min-speakers-error">
                            {minSpeakersMessage}
                        </FieldError>
                    ) : null}
                </FieldContent>
                <FieldControl className="min-w-0 flex-wrap justify-end">
                    <Input
                        className="w-24 max-w-full"
                        id="voscript-min-speakers"
                        type="number"
                        min={0}
                        aria-describedby={getFieldDescribedBy(
                            "voscript-min-speakers",
                            minSpeakersInvalid,
                        )}
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
                </FieldControl>
            </Field>
            <Field
                data-invalid={maxSpeakersInvalid ? "true" : undefined}
                orientation="responsive"
                className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
            >
                <FieldContent className="min-w-0 gap-1">
                    <FieldLabel htmlFor="voscript-max-speakers">
                        {isZh ? "最多说话人数" : "Maximum speakers"}
                    </FieldLabel>
                    <FieldDescription id="voscript-max-speakers-description">
                        {isZh
                            ? "0 为自动 · 必须 ≥ 最少说话人数"
                            : "0 means automatic; must be >= minimum speakers"}
                    </FieldDescription>
                    {maxSpeakersMessage ? (
                        <FieldError id="voscript-max-speakers-error">
                            {maxSpeakersMessage}
                        </FieldError>
                    ) : null}
                </FieldContent>
                <FieldControl className="min-w-0 flex-wrap justify-end">
                    <Input
                        className="w-24 max-w-full"
                        id="voscript-max-speakers"
                        type="number"
                        min={0}
                        aria-describedby={getFieldDescribedBy(
                            "voscript-max-speakers",
                            maxSpeakersInvalid,
                        )}
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
                </FieldControl>
            </Field>
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

    if (isLoading && !hasLoaded) {
        return (
            <SettingsSectionSkeleton fieldsPerCard={2} scrollRef={scrollRef} />
        );
    }

    if (loadError && !hasLoaded) {
        return (
            <section
                ref={scrollRef}
                aria-label={isZh ? "VoScript 服务" : "VoScript Service"}
                aria-busy={busy}
                className="min-h-0 overflow-y-auto px-[26px] py-[22px] [overscroll-behavior:contain]"
            >
                <Alert
                    variant="destructiveSoft"
                    density="comfortable"
                    aria-live="assertive"
                >
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>{isZh ? "加载失败" : "Load failed"}</AlertTitle>
                    <AlertDescription>
                        <span>{loadError}</span>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="mt-3"
                            disabled={busy}
                            aria-busy={busy}
                            onClick={() =>
                                void ensureVoScriptSettingsLoaded().catch(
                                    () => {},
                                )
                            }
                        >
                            <RotateCw
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {isZh ? "重试" : "Retry"}
                        </Button>
                    </AlertDescription>
                </Alert>
            </section>
        );
    }

    const connectionSaveTarget = isZh ? "服务连接" : "service connection";
    const connectionSaveButtonLabel =
        connectionSave.saveState === "saving"
            ? isZh
                ? `${connectionSaveTarget}保存中`
                : `Saving ${connectionSaveTarget}`
            : connectionSave.saveState === "saved"
              ? isZh
                  ? `${connectionSaveTarget}已保存`
                  : `${connectionSaveTarget} saved`
              : isZh
                ? `保存${connectionSaveTarget}`
                : `Save ${connectionSaveTarget}`;
    const paramsSaveTarget = isZh
        ? "转录运行参数"
        : "transcription runtime parameters";
    const paramsSaveButtonLabel =
        paramsSave.saveState === "saving"
            ? isZh
                ? `${paramsSaveTarget}保存中`
                : `Saving ${paramsSaveTarget}`
            : paramsSave.saveState === "saved"
              ? isZh
                  ? `${paramsSaveTarget}已保存`
                  : `${paramsSaveTarget} saved`
              : isZh
                ? `保存${paramsSaveTarget}`
                : `Save ${paramsSaveTarget}`;

    return (
        <section
            ref={scrollRef}
            aria-label={isZh ? "VoScript 服务" : "VoScript Service"}
            aria-busy={busy}
            className="min-h-0 overflow-y-auto px-[26px] py-[22px] [overscroll-behavior:contain]"
        >
            <h3 className="mb-[18px] text-lg font-semibold text-foreground">
                {isZh ? "VoScript 服务" : "VoScript Service"}
            </h3>
            {showUnavailableBanner ? (
                <Alert
                    id="voscript-connection-status"
                    variant={
                        connectionTestState === "test-error"
                            ? "destructiveSoft"
                            : "default"
                    }
                    density="comfortable"
                    role={
                        connectionTestState === "test-error"
                            ? "alert"
                            : "status"
                    }
                    aria-live={
                        connectionTestState === "test-error"
                            ? "assertive"
                            : "polite"
                    }
                    className="mb-4"
                >
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>
                        {isZh
                            ? "VoScript 当前不可用"
                            : "VoScript is unavailable"}
                    </AlertTitle>
                    <AlertDescription>
                        {connectionTestState === "test-error" &&
                        connectionTestMessage
                            ? connectionTestMessage
                            : isZh
                              ? "服务地址或 API key 缺失，列表中将无法触发新转写。填好下面字段并保存后会自动重试。"
                              : "The service URL or API key is missing. New transcription jobs cannot start until you fill these fields and save."}
                    </AlertDescription>
                </Alert>
            ) : null}
            <section
                aria-labelledby="voscript-service-connection-heading"
                className="mb-[22px]"
            >
                <Card className="gap-0 py-0">
                    <CardHeader className="gap-1.5 border-b py-4">
                        <CardTitle>
                            <h4 id="voscript-service-connection-heading">
                                {isZh ? "服务连接" : "Service Connection"}
                            </h4>
                        </CardTitle>
                        <CardDescription>
                            {isZh
                                ? "BetterAINote 会把录音提交到这里，并自动跟进处理进度。"
                                : "BetterAINote submits recordings here and follows processing progress automatically."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup className="gap-0">
                            <Field
                                orientation="responsive"
                                className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
                            >
                                <FieldContent className="min-w-0 gap-1">
                                    <FieldLabel htmlFor="voscript-base-url">
                                        {isZh
                                            ? "VoScript 服务地址"
                                            : "VoScript service URL"}
                                    </FieldLabel>
                                    <FieldDescription id="voscript-base-url-description">
                                        {isZh
                                            ? "私有部署的 VoScript 实例 URL"
                                            : "Privately deployed VoScript instance URL"}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl className="min-w-0 flex-wrap justify-end">
                                    <Input
                                        className="min-w-60 max-w-full"
                                        id="voscript-base-url"
                                        aria-describedby={getFieldDescribedBy(
                                            "voscript-base-url",
                                            false,
                                            showUnavailableBanner
                                                ? "voscript-connection-status"
                                                : undefined,
                                        )}
                                        value={
                                            draft.privateTranscriptionBaseUrl ??
                                            ""
                                        }
                                        disabled={busy}
                                        placeholder="https://voscript.example.com"
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                privateTranscriptionBaseUrl:
                                                    event.target.value,
                                            }))
                                        }
                                    />
                                </FieldControl>
                            </Field>
                            <Field
                                orientation="responsive"
                                className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
                            >
                                <FieldContent className="min-w-0 gap-1">
                                    <FieldLabel htmlFor="voscript-api-key">
                                        {isZh
                                            ? "VoScript API Key"
                                            : "VoScript API key"}
                                    </FieldLabel>
                                    <FieldDescription id="voscript-api-key-description">
                                        {draft.privateTranscriptionApiKeySet
                                            ? isZh
                                                ? "当前账号已保存一把 VoScript key。输入新 key 可替换。"
                                                : "A VoScript key is stored. Enter a new key to replace it."
                                            : isZh
                                              ? "输入私有 VoScript 服务的 API key。"
                                              : "Enter the API key for the private VoScript service."}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl className="min-w-0 flex-wrap justify-end">
                                    {draft.privateTranscriptionApiKeySet ? (
                                        <Badge
                                            id="voscript-api-key-status"
                                            variant="secondary"
                                            role="status"
                                            aria-live="polite"
                                        >
                                            <CheckCircle2
                                                aria-hidden="true"
                                                data-icon="inline-start"
                                            />
                                            {isZh ? "已存储" : "Stored"}
                                        </Badge>
                                    ) : null}
                                    <Input
                                        className="min-w-60 max-w-full"
                                        id="voscript-api-key"
                                        aria-describedby={getFieldDescribedBy(
                                            "voscript-api-key",
                                            false,
                                            draft.privateTranscriptionApiKeySet
                                                ? "voscript-api-key-status"
                                                : undefined,
                                        )}
                                        type="password"
                                        value={apiKeyDraft}
                                        disabled={
                                            busy ||
                                            apiKeyMode ===
                                                VOSCRIPT_API_KEY_CLEAR
                                        }
                                        placeholder={
                                            draft.privateTranscriptionApiKeySet
                                                ? isZh
                                                    ? "已存储。输入新 key 可替换。"
                                                    : "Stored. Enter a new key to replace it."
                                                : ""
                                        }
                                        onChange={(event) =>
                                            setApiKeyDraft(event.target.value)
                                        }
                                    />
                                </FieldControl>
                            </Field>
                            {draft.privateTranscriptionApiKeySet ? (
                                <Field
                                    orientation="responsive"
                                    className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
                                >
                                    <FieldContent className="min-w-0 gap-1">
                                        <FieldLabel htmlFor="voscript-api-key-mode">
                                            {isZh ? "密钥操作" : "Key action"}
                                        </FieldLabel>
                                        <FieldDescription id="voscript-api-key-mode-description">
                                            {isZh
                                                ? "需要移除已保存密钥时选择清除。"
                                                : "Choose clear only when removing the saved key."}
                                        </FieldDescription>
                                    </FieldContent>
                                    <FieldControl className="min-w-0 flex-wrap justify-end">
                                        <Select
                                            aria-label={
                                                isZh ? "密钥操作" : "Key action"
                                            }
                                            aria-describedby={getFieldDescribedBy(
                                                "voscript-api-key-mode",
                                            )}
                                            disabled={busy}
                                            id="voscript-api-key-mode"
                                            onValueChange={setApiKeyMode}
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
                                            value={apiKeyMode}
                                        />
                                    </FieldControl>
                                </Field>
                            ) : null}
                        </FieldGroup>
                    </CardContent>
                    <CardFooter
                        role="group"
                        aria-label={
                            isZh
                                ? `${connectionSaveTarget}操作`
                                : `${connectionSaveTarget} actions`
                        }
                        className="flex-row-reverse gap-2 border-t py-4"
                    >
                        <Badge
                            id="voscript-connection-save-status"
                            variant={
                                connectionSave.saveState === "error"
                                    ? "destructive"
                                    : connectionSave.saveState === "idle"
                                      ? "secondary"
                                      : "default"
                            }
                            className="gap-1.5"
                            hidden={connectionSave.saveState === "idle"}
                            role={
                                connectionSave.saveState === "idle"
                                    ? undefined
                                    : connectionSave.saveState === "error"
                                      ? "alert"
                                      : "status"
                            }
                            aria-live={
                                connectionSave.saveState === "idle"
                                    ? undefined
                                    : connectionSave.saveState === "error"
                                      ? "assertive"
                                      : "polite"
                            }
                            aria-atomic={
                                connectionSave.saveState === "idle"
                                    ? undefined
                                    : "true"
                            }
                        >
                            {connectionSave.saveState === "saving" ? (
                                <Spinner size="2xs" aria-hidden="true" />
                            ) : connectionSave.saveState === "saved" ? (
                                <CheckCircle2 aria-hidden="true" />
                            ) : connectionSave.saveState === "error" ? (
                                <XCircle aria-hidden="true" />
                            ) : null}
                            {connectionSave.saveState === "error"
                                ? (connectionSave.saveError ??
                                  (isZh ? "保存失败" : "Save failed"))
                                : connectionSave.saveState === "idle"
                                  ? ""
                                  : connectionSaveButtonLabel}
                        </Badge>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-busy={isTestingConnection}
                            aria-describedby={
                                showUnavailableBanner
                                    ? "voscript-connection-status"
                                    : undefined
                            }
                            aria-label={
                                isTestingConnection
                                    ? isZh
                                        ? "正在测试 VoScript 连接"
                                        : "Testing VoScript connection"
                                    : connectionTestState === "test-success"
                                      ? isZh
                                          ? "VoScript 连接正常"
                                          : "VoScript connection ready"
                                      : isZh
                                        ? "测试 VoScript 连接"
                                        : "Test VoScript connection"
                            }
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
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            disabled={busy}
                            aria-busy={connectionSave.saveState === "saving"}
                            aria-describedby={
                                connectionSave.saveState === "idle"
                                    ? undefined
                                    : "voscript-connection-save-status"
                            }
                            aria-label={connectionSaveButtonLabel}
                            onClick={() => void saveConnectionSettings()}
                        >
                            {connectionSave.saveState === "saving" ? (
                                <Spinner
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {connectionSave.saveState === "saving"
                                ? isZh
                                    ? "保存中"
                                    : "Saving"
                                : connectionSave.saveState === "saved"
                                  ? isZh
                                      ? "已保存"
                                      : "Saved"
                                  : isZh
                                    ? "保存"
                                    : "Save"}
                        </Button>
                    </CardFooter>
                </Card>
            </section>
            <section
                aria-labelledby="voscript-runtime-parameters-heading"
                className="mb-[22px]"
            >
                <Card className="gap-0 py-0">
                    <CardHeader className="gap-1.5 border-b py-4">
                        <CardTitle>
                            <h4 id="voscript-runtime-parameters-heading">
                                {isZh
                                    ? "转录运行参数"
                                    : "Transcription Runtime Parameters"}
                            </h4>
                        </CardTitle>
                        <CardDescription>
                            {isZh
                                ? "这些参数会随每个转录任务一起发送给 VoScript。0 通常表示交给服务自行判断。"
                                : "These parameters are sent with each VoScript job. 0 usually lets the service decide."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup className="gap-0">
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
                            <Field
                                orientation="responsive"
                                className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
                            >
                                <FieldContent className="min-w-0 gap-1">
                                    <FieldLabel htmlFor="voscript-denoise-model">
                                        {isZh ? "降噪模型" : "Denoise model"}
                                    </FieldLabel>
                                    <FieldDescription id="voscript-denoise-model-description">
                                        {isZh
                                            ? "提交前对音频应用的降噪策略"
                                            : "Denoise strategy applied before submission"}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl className="min-w-0 flex-wrap justify-end">
                                    <Select
                                        aria-label={
                                            isZh ? "降噪模型" : "Denoise model"
                                        }
                                        aria-describedby={getFieldDescribedBy(
                                            "voscript-denoise-model",
                                        )}
                                        id="voscript-denoise-model"
                                        options={denoiseOptions}
                                        value={
                                            draft.privateTranscriptionDenoiseModel
                                        }
                                        disabled={busy}
                                        onValueChange={(value) =>
                                            setDraft((current) => ({
                                                ...current,
                                                privateTranscriptionDenoiseModel:
                                                    value as VoScriptDenoiseModel,
                                            }))
                                        }
                                    />
                                </FieldControl>
                            </Field>
                            <Field
                                orientation="responsive"
                                className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
                            >
                                <FieldContent className="min-w-0 gap-1">
                                    <FieldLabel htmlFor="voscript-snr-threshold">
                                        {isZh ? "SNR 阈值" : "SNR threshold"}
                                    </FieldLabel>
                                    <FieldDescription id="voscript-snr-threshold-description">
                                        {isZh
                                            ? "留空使用服务默认"
                                            : "Leave blank to use the service default"}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl className="min-w-0 flex-wrap justify-end">
                                    <Input
                                        className="w-24 max-w-full"
                                        id="voscript-snr-threshold"
                                        aria-describedby={getFieldDescribedBy(
                                            "voscript-snr-threshold",
                                        )}
                                        type="number"
                                        value={
                                            draft.privateTranscriptionSnrThreshold ??
                                            ""
                                        }
                                        disabled={busy}
                                        placeholder={
                                            isZh ? "例如 10" : "e.g. 10"
                                        }
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                privateTranscriptionSnrThreshold:
                                                    event.target.value === ""
                                                        ? null
                                                        : Number(
                                                              event.target
                                                                  .value,
                                                          ),
                                            }))
                                        }
                                    />
                                </FieldControl>
                            </Field>
                            <Field
                                data-invalid={
                                    noRepeatNgramInvalid ? "true" : undefined
                                }
                                orientation="responsive"
                                className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
                            >
                                <FieldContent className="min-w-0 gap-1">
                                    <FieldLabel htmlFor="voscript-no-repeat-ngram">
                                        {isZh
                                            ? "重复抑制 n-gram"
                                            : "No-repeat n-gram"}
                                    </FieldLabel>
                                    <FieldDescription id="voscript-no-repeat-ngram-description">
                                        {isZh
                                            ? "0 表示关闭；只有 3 及以上的值才会发送给服务"
                                            : "0 disables suppression; only values 3 and above are sent to the service."}
                                    </FieldDescription>
                                    {noRepeatNgramInvalid ? (
                                        <FieldError id="voscript-no-repeat-ngram-error">
                                            {noRepeatNgramMessage}
                                        </FieldError>
                                    ) : null}
                                </FieldContent>
                                <FieldControl className="min-w-0 flex-wrap justify-end">
                                    <Input
                                        className="w-24 max-w-full"
                                        id="voscript-no-repeat-ngram"
                                        type="number"
                                        min={0}
                                        aria-describedby={getFieldDescribedBy(
                                            "voscript-no-repeat-ngram",
                                            noRepeatNgramInvalid,
                                        )}
                                        aria-invalid={noRepeatNgramInvalid}
                                        value={
                                            draft.privateTranscriptionNoRepeatNgramSize
                                        }
                                        disabled={busy}
                                        placeholder={
                                            isZh ? "0 或 ≥ 3" : "0 or >= 3"
                                        }
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                privateTranscriptionNoRepeatNgramSize:
                                                    Number(event.target.value),
                                            }))
                                        }
                                    />
                                </FieldControl>
                            </Field>
                            <Field
                                orientation="responsive"
                                className="border-b border-border py-3 last:border-b-0 @md/field-group:gap-4"
                            >
                                <FieldContent className="min-w-0 gap-1">
                                    <FieldLabel htmlFor="voscript-max-inflight-jobs">
                                        {isZh
                                            ? "本地调度活跃任务上限"
                                            : "Local active job limit"}
                                    </FieldLabel>
                                    <FieldDescription id="voscript-max-inflight-jobs-description">
                                        {isZh
                                            ? "只控制 BetterAINote 同时处理多少个 VoScript 任务，不会改动 VoScript 服务器本身。0 为不限制"
                                            : "Only controls how many VoScript jobs BetterAINote handles concurrently. 0 means unlimited."}
                                    </FieldDescription>
                                </FieldContent>
                                <FieldControl className="min-w-0 flex-wrap justify-end">
                                    <Input
                                        className="w-24 max-w-full"
                                        id="voscript-max-inflight-jobs"
                                        aria-describedby={getFieldDescribedBy(
                                            "voscript-max-inflight-jobs",
                                        )}
                                        type="number"
                                        min={0}
                                        value={
                                            draft.privateTranscriptionMaxInflightJobs
                                        }
                                        disabled={busy}
                                        placeholder={
                                            isZh ? "默认 1" : "Default 1"
                                        }
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                privateTranscriptionMaxInflightJobs:
                                                    Number(event.target.value),
                                            }))
                                        }
                                    />
                                </FieldControl>
                            </Field>
                        </FieldGroup>
                    </CardContent>
                    <CardFooter
                        role="group"
                        aria-label={
                            isZh
                                ? `${paramsSaveTarget}操作`
                                : `${paramsSaveTarget} actions`
                        }
                        className="flex-row-reverse gap-2 border-t py-4"
                    >
                        <Badge
                            id="voscript-params-save-status"
                            variant={
                                paramsSave.saveState === "error"
                                    ? "destructive"
                                    : paramsSave.saveState === "idle"
                                      ? "secondary"
                                      : "default"
                            }
                            className="gap-1.5"
                            hidden={paramsSave.saveState === "idle"}
                            role={
                                paramsSave.saveState === "idle"
                                    ? undefined
                                    : paramsSave.saveState === "error"
                                      ? "alert"
                                      : "status"
                            }
                            aria-live={
                                paramsSave.saveState === "idle"
                                    ? undefined
                                    : paramsSave.saveState === "error"
                                      ? "assertive"
                                      : "polite"
                            }
                            aria-atomic={
                                paramsSave.saveState === "idle"
                                    ? undefined
                                    : "true"
                            }
                        >
                            {paramsSave.saveState === "saving" ? (
                                <Spinner size="2xs" aria-hidden="true" />
                            ) : paramsSave.saveState === "saved" ? (
                                <CheckCircle2 aria-hidden="true" />
                            ) : paramsSave.saveState === "error" ? (
                                <XCircle aria-hidden="true" />
                            ) : null}
                            {paramsSave.saveState === "error"
                                ? (paramsSave.saveError ??
                                  (isZh ? "保存失败" : "Save failed"))
                                : paramsSave.saveState === "idle"
                                  ? ""
                                  : paramsSaveButtonLabel}
                        </Badge>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            disabled={busy}
                            aria-busy={paramsSave.saveState === "saving"}
                            aria-describedby={
                                paramsSave.saveState === "idle"
                                    ? undefined
                                    : "voscript-params-save-status"
                            }
                            aria-label={paramsSaveButtonLabel}
                            onClick={() => void saveRuntimeParams()}
                        >
                            {paramsSave.saveState === "saving" ? (
                                <Spinner
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {paramsSave.saveState === "saving"
                                ? isZh
                                    ? "保存中"
                                    : "Saving"
                                : paramsSave.saveState === "saved"
                                  ? isZh
                                      ? "已保存"
                                      : "Saved"
                                  : isZh
                                    ? "保存"
                                    : "Save"}
                        </Button>
                    </CardFooter>
                </Card>
            </section>
            <SpeakerProfilesPanel />
        </section>
    );
}
