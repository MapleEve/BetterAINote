"use client";

import {
    CheckCircle2,
    Cpu,
    Info,
    KeyRound,
    SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { SettingFieldDefinition } from "@/features/settings/components/setting-field-control";
import { SettingFieldControl } from "@/features/settings/components/setting-field-control";
import { SettingsSectionSkeleton } from "@/features/settings/components/settings-skeletons";
import { useVoScriptSettingsStore } from "@/features/settings/voscript-settings-store";
import { cn } from "@/lib/utils";
import type {
    VoScriptDenoiseModel,
    VoScriptSettingsUpdate,
} from "@/services/voscript-settings";
import { SpeakerProfilesPanel } from "./speaker-profiles-panel";

function VoScriptStatusBanner({
    description,
    isReady,
    title,
}: {
    description: string;
    isReady: boolean;
    title: string;
}) {
    const Icon = isReady ? CheckCircle2 : Info;

    return (
        <div
            className={cn(
                "grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3 rounded-xl border px-4 py-3 text-sm",
                isReady
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-200",
            )}
            data-voscript-service-state={isReady ? "configured" : "empty"}
        >
            <span className="flex size-7 items-center justify-center rounded-lg border border-current/20 bg-background/35">
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
                <span className="block font-semibold text-foreground">
                    {title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                    {description}
                </span>
            </span>
        </div>
    );
}

export function VoScriptSection() {
    const {
        settings: {
            privateTranscriptionBaseUrl,
            privateTranscriptionApiKeySet,
            privateTranscriptionMinSpeakers,
            privateTranscriptionMaxSpeakers,
            privateTranscriptionDenoiseModel,
            privateTranscriptionSnrThreshold,
            privateTranscriptionNoRepeatNgramSize,
            privateTranscriptionMaxInflightJobs,
        },
        hasLoaded,
        isLoading,
        isSaving,
        updateVoScriptSettings,
    } = useVoScriptSettingsStore();
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const [privateTranscriptionBaseUrlInput, setPrivateTranscriptionBaseUrl] =
        useState("");
    const [privateTranscriptionApiKey, setPrivateTranscriptionApiKey] =
        useState("");
    const [
        privateTranscriptionMinSpeakersInput,
        setPrivateTranscriptionMinSpeakers,
    ] = useState("0");
    const [
        privateTranscriptionMaxSpeakersInput,
        setPrivateTranscriptionMaxSpeakers,
    ] = useState("0");
    const [
        privateTranscriptionDenoiseModelInput,
        setPrivateTranscriptionDenoiseModel,
    ] = useState<VoScriptDenoiseModel>("none");
    const [
        privateTranscriptionSnrThresholdInput,
        setPrivateTranscriptionSnrThreshold,
    ] = useState("");
    const [
        privateTranscriptionNoRepeatNgramSizeInput,
        setPrivateTranscriptionNoRepeatNgramSize,
    ] = useState("0");
    const [
        privateTranscriptionMaxInflightJobsInput,
        setPrivateTranscriptionMaxInflightJobs,
    ] = useState("1");

    useEffect(() => {
        setPrivateTranscriptionBaseUrl(privateTranscriptionBaseUrl ?? "");
    }, [privateTranscriptionBaseUrl]);

    useEffect(() => {
        setPrivateTranscriptionMinSpeakers(
            String(privateTranscriptionMinSpeakers),
        );
    }, [privateTranscriptionMinSpeakers]);

    useEffect(() => {
        setPrivateTranscriptionMaxSpeakers(
            String(privateTranscriptionMaxSpeakers),
        );
    }, [privateTranscriptionMaxSpeakers]);

    useEffect(() => {
        setPrivateTranscriptionDenoiseModel(privateTranscriptionDenoiseModel);
    }, [privateTranscriptionDenoiseModel]);

    useEffect(() => {
        setPrivateTranscriptionSnrThreshold(
            privateTranscriptionSnrThreshold === null
                ? ""
                : String(privateTranscriptionSnrThreshold),
        );
    }, [privateTranscriptionSnrThreshold]);

    useEffect(() => {
        setPrivateTranscriptionNoRepeatNgramSize(
            String(privateTranscriptionNoRepeatNgramSize),
        );
    }, [privateTranscriptionNoRepeatNgramSize]);

    useEffect(() => {
        setPrivateTranscriptionMaxInflightJobs(
            String(privateTranscriptionMaxInflightJobs),
        );
    }, [privateTranscriptionMaxInflightJobs]);

    const handleSave = async () => {
        const normalizedBaseUrl = privateTranscriptionBaseUrlInput.trim();
        const minSpeakers = Number.parseInt(
            privateTranscriptionMinSpeakersInput || "0",
            10,
        );
        const maxSpeakers = Number.parseInt(
            privateTranscriptionMaxSpeakersInput || "0",
            10,
        );
        const maxInflightJobs = Number.parseInt(
            privateTranscriptionMaxInflightJobsInput || "1",
            10,
        );
        const noRepeatNgramSize = Number.parseInt(
            privateTranscriptionNoRepeatNgramSizeInput || "0",
            10,
        );
        const normalizedSnrThreshold =
            privateTranscriptionSnrThresholdInput.trim();

        if (
            !Number.isInteger(minSpeakers) ||
            minSpeakers < 0 ||
            !Number.isInteger(maxSpeakers) ||
            maxSpeakers < 0
        ) {
            toast.error(
                isZh
                    ? "最少/最多说话人数必须是非负整数"
                    : "Min and max speakers must be non-negative integers",
            );
            return;
        }

        if (minSpeakers > 0 && maxSpeakers > 0 && maxSpeakers < minSpeakers) {
            toast.error(
                isZh
                    ? "最大说话人数必须大于等于最少说话人数，或填 0 代表自动"
                    : "Max speakers must be greater than or equal to min speakers, or 0 for auto",
            );
            return;
        }

        if (!Number.isInteger(maxInflightJobs) || maxInflightJobs < 0) {
            toast.error(
                isZh
                    ? "本地调度活跃任务上限必须是非负整数"
                    : "Local scheduler inflight job limit must be a non-negative integer",
            );
            return;
        }

        if (
            !Number.isInteger(noRepeatNgramSize) ||
            noRepeatNgramSize < 0 ||
            (noRepeatNgramSize > 0 && noRepeatNgramSize < 3)
        ) {
            toast.error(
                isZh
                    ? "重复抑制长度必须为 0，或大于等于 3 的整数"
                    : "Repeat suppression must be 0 or an integer greater than or equal to 3",
            );
            return;
        }

        if (
            normalizedSnrThreshold &&
            !Number.isFinite(Number(normalizedSnrThreshold))
        ) {
            toast.error(
                isZh
                    ? "SNR 阈值必须是数字，留空则使用服务默认值"
                    : "SNR threshold must be a number, or leave blank to use the service default",
            );
            return;
        }

        try {
            const updates: VoScriptSettingsUpdate = {
                privateTranscriptionBaseUrl: normalizedBaseUrl || null,
                privateTranscriptionMinSpeakers: minSpeakers,
                privateTranscriptionMaxSpeakers: maxSpeakers,
                privateTranscriptionDenoiseModel:
                    privateTranscriptionDenoiseModelInput,
                privateTranscriptionSnrThreshold: normalizedSnrThreshold
                    ? Number(normalizedSnrThreshold)
                    : null,
                privateTranscriptionNoRepeatNgramSize: noRepeatNgramSize,
                privateTranscriptionMaxInflightJobs: maxInflightJobs,
            };
            const trimmedPrivateApiKey = privateTranscriptionApiKey.trim();
            if (trimmedPrivateApiKey) {
                updates.privateTranscriptionApiKey = trimmedPrivateApiKey;
            }

            await updateVoScriptSettings(updates);
            setPrivateTranscriptionBaseUrl(normalizedBaseUrl);
            if (trimmedPrivateApiKey) {
                setPrivateTranscriptionApiKey("");
            }
            toast.success(
                normalizedBaseUrl
                    ? isZh
                        ? "VoScript 服务配置已保存"
                        : "VoScript settings saved"
                    : isZh
                      ? "VoScript 服务地址已清空"
                      : "VoScript URL cleared",
            );
        } catch {
            toast.error(
                isZh ? "保存 VoScript 配置失败" : "Failed to save VoScript",
            );
        }
    };

    if (isLoading && !hasLoaded) {
        return <SettingsSectionSkeleton cards={2} fieldsPerCard={3} />;
    }

    const serviceConfigured = Boolean(privateTranscriptionBaseUrlInput.trim());

    const serviceConnectionFields: SettingFieldDefinition[] = [
        {
            id: "base-url",
            kind: "text",
            label: isZh ? "VoScript 服务地址" : "VoScript service URL",
            value: privateTranscriptionBaseUrlInput,
            placeholder: "https://voscript.example.com",
            description: isZh
                ? "BetterAINote 会把录音提交到这里，并自动跟进处理进度。"
                : "BetterAINote submits recordings here and follows processing progress automatically.",
        },
        {
            id: "api-key",
            kind: "text",
            label: isZh ? "VoScript API Key" : "VoScript API key",
            value: privateTranscriptionApiKey,
            sensitive: true,
            placeholder: privateTranscriptionApiKeySet
                ? isZh
                    ? "已存储。输入新 key 可替换。"
                    : "Stored. Enter a new key to replace it."
                : "vt_...",
            description: privateTranscriptionApiKeySet
                ? isZh
                    ? "当前账号已保存一把 VoScript key。"
                    : "A VoScript key is already stored for this account."
                : isZh
                  ? "如果 VoScript 开启了鉴权，就在这里保存。"
                  : "Save the key here if VoScript authentication is enabled.",
        },
    ];
    const transcriptionOptionFields: SettingFieldDefinition[] = [
        {
            id: "min-speakers",
            kind: "text",
            inputType: "number",
            label: isZh
                ? "最少说话人数（0 为自动）"
                : "Minimum speakers (0 = auto)",
            value: privateTranscriptionMinSpeakersInput,
        },
        {
            id: "max-speakers",
            kind: "text",
            inputType: "number",
            label: isZh
                ? "最多说话人数（0 为自动）"
                : "Maximum speakers (0 = auto)",
            value: privateTranscriptionMaxSpeakersInput,
        },
        {
            id: "denoise-model",
            kind: "select",
            label: isZh ? "降噪模型" : "Denoise model",
            value: privateTranscriptionDenoiseModelInput,
            options: [
                { value: "none", label: isZh ? "不降噪" : "None" },
                { value: "deepfilternet", label: "DeepFilterNet" },
                { value: "noisereduce", label: "noisereduce" },
            ],
        },
        {
            id: "snr-threshold",
            kind: "text",
            inputType: "number",
            label: isZh
                ? "SNR 阈值（留空使用服务默认）"
                : "SNR threshold (blank = service default)",
            value: privateTranscriptionSnrThresholdInput,
            placeholder: isZh ? "例如 10" : "e.g. 10",
        },
        {
            id: "no-repeat-ngram-size",
            kind: "text",
            inputType: "number",
            label: isZh
                ? "重复抑制 n-gram（0 为关闭）"
                : "No-repeat n-gram size (0 = off)",
            value: privateTranscriptionNoRepeatNgramSizeInput,
            placeholder: isZh ? "0 或 >= 3" : "0 or >= 3",
            description: isZh
                ? "用于减少重复片段。0 表示关闭；只有 3 及以上的值才会发送给服务。"
                : "Helps reduce repeated phrases. 0 turns it off; only values of 3 or higher are sent to the service.",
        },
        {
            id: "max-inflight-jobs",
            kind: "text",
            inputType: "number",
            label: isZh
                ? "本地调度活跃任务上限（0 为不限制）"
                : "Local scheduler inflight job limit (0 = unlimited)",
            value: privateTranscriptionMaxInflightJobsInput,
            placeholder: isZh ? "默认 1" : "Default 1",
            description: isZh
                ? "只控制 BetterAINote 同时处理多少个 VoScript 任务，不会改动 VoScript 服务器本身。"
                : "This only caps how many VoScript tasks BetterAINote processes at once. It does not change the VoScript server itself.",
        },
    ];

    const handleConnectionFieldChange = (
        field: SettingFieldDefinition,
        value: string | boolean,
    ) => {
        const nextValue = String(value);

        if (field.id === "base-url") {
            setPrivateTranscriptionBaseUrl(nextValue);
            return;
        }

        if (field.id === "api-key") {
            setPrivateTranscriptionApiKey(nextValue);
        }
    };

    const handleOptionFieldChange = (
        field: SettingFieldDefinition,
        value: string | boolean,
    ) => {
        const nextValue = String(value);

        switch (field.id) {
            case "min-speakers":
                setPrivateTranscriptionMinSpeakers(nextValue);
                return;
            case "max-speakers":
                setPrivateTranscriptionMaxSpeakers(nextValue);
                return;
            case "denoise-model":
                setPrivateTranscriptionDenoiseModel(
                    nextValue as VoScriptDenoiseModel,
                );
                return;
            case "snr-threshold":
                setPrivateTranscriptionSnrThreshold(nextValue);
                return;
            case "no-repeat-ngram-size":
                setPrivateTranscriptionNoRepeatNgramSize(nextValue);
                return;
            case "max-inflight-jobs":
                setPrivateTranscriptionMaxInflightJobs(nextValue);
        }
    };

    return (
        <div
            className="flex min-h-0 flex-col gap-5"
            data-settings-section="voscript"
        >
            <div className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Cpu className="size-5" />
                    {isZh ? "VoScript 服务" : "VoScript Service"}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {isZh
                        ? "配置私有转写服务、任务参数和说话人资料；录音平台仍在数据源里管理。"
                        : "Configure the private transcription service, job options, and speaker records. Recording platforms stay in Data Sources."}
                </p>
            </div>

            <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <Card className="gap-5 border-border/75 py-5">
                    <CardHeader className="gap-2 px-5">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <KeyRound className="size-4" />
                            {isZh ? "服务连接" : "Service connection"}
                        </CardTitle>
                        <CardDescription>
                            {isZh
                                ? "BetterAINote 会把录音提交到这里，并使用当前账号保存的鉴权信息。"
                                : "BetterAINote submits recordings here and uses the credentials saved for the current account."}
                        </CardDescription>
                        <CardAction>
                            <span
                                className={cn(
                                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                                    serviceConfigured
                                        ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                                        : "border-border/70 bg-muted/35 text-muted-foreground",
                                )}
                            >
                                {serviceConfigured
                                    ? isZh
                                        ? "已配置"
                                        : "Configured"
                                    : isZh
                                      ? "待配置"
                                      : "Not configured"}
                            </span>
                        </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 px-5">
                        <VoScriptStatusBanner
                            isReady={serviceConfigured}
                            title={
                                serviceConfigured
                                    ? isZh
                                        ? "服务地址已保存"
                                        : "Service URL ready"
                                    : isZh
                                      ? "尚未连接 VoScript"
                                      : "VoScript not connected"
                            }
                            description={
                                serviceConfigured
                                    ? privateTranscriptionApiKeySet
                                        ? isZh
                                            ? "服务地址和 API Key 均已在当前账号配置。"
                                            : "A service URL and API key are configured for the current account."
                                        : isZh
                                          ? "服务地址已配置；如果服务启用鉴权，请补充 API Key。"
                                          : "The service URL is configured. Add an API key if the service requires authentication."
                                    : isZh
                                      ? "保存服务地址后，声纹库和私有转写任务会使用该连接。"
                                      : "Save a service URL so voiceprints and private transcription jobs can use it."
                            }
                        />

                        {serviceConnectionFields.map((field) => (
                            <SettingFieldControl
                                key={field.id}
                                field={field}
                                fieldId={`private-transcription-${field.id}`}
                                onValueChange={handleConnectionFieldChange}
                                disabled={isSaving}
                                variant="settings"
                            />
                        ))}
                    </CardContent>
                </Card>

                <Card className="gap-5 border-border/75 py-5">
                    <CardHeader className="gap-2 px-5">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <SlidersHorizontal className="size-4" />
                            {isZh ? "转录参数" : "Transcription options"}
                        </CardTitle>
                        <CardDescription>
                            {isZh
                                ? "这些值只影响 BetterAINote 发起的新 VoScript 任务。"
                                : "These values only affect new VoScript jobs started by BetterAINote."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 px-5 md:grid-cols-2">
                        {transcriptionOptionFields.map((field) => (
                            <SettingFieldControl
                                key={field.id}
                                field={field}
                                fieldId={`private-transcription-${field.id}`}
                                onValueChange={handleOptionFieldChange}
                                disabled={isSaving}
                                variant="settings"
                            />
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="sticky bottom-0 z-10 flex justify-end border-border/70 border-t bg-background/85 py-3 backdrop-blur">
                <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    aria-busy={isSaving}
                >
                    {isSaving
                        ? isZh
                            ? "保存中..."
                            : "Saving..."
                        : isZh
                          ? "保存 VoScript 配置"
                          : "Save VoScript"}
                </Button>
            </div>

            <SpeakerProfilesPanel />
        </div>
    );
}
