"use client";

import { Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import type { SettingFieldDefinition } from "@/components/settings/setting-field-control";
import { SettingFieldControl } from "@/components/settings/setting-field-control";
import { SettingsSectionSkeleton } from "@/components/settings/settings-skeletons";
import { Button } from "@/components/ui/button";
import { useVoScriptSettingsStore } from "@/features/settings/voscript-settings-store";
import type {
    VoScriptDenoiseModel,
    VoScriptSettingsUpdate,
} from "@/services/voscript-settings";
import { SpeakerProfilesPanel } from "./speaker-profiles-panel";

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
        <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                {isZh ? "VoScript 服务" : "VoScript Service"}
            </h2>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="space-y-1">
                    <h3 className="text-base font-semibold">
                        {isZh ? "服务连接" : "Service connection"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {isZh
                            ? "这里配置 BetterAINote 与 VoScript 的连接方式。录音平台在数据源里管理；通用语言偏好在转录设置里管理。"
                            : "Configure how BetterAINote connects to VoScript. Recording platforms are managed in Data Sources; shared language preference is managed in Transcription."}
                    </p>
                </div>

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

                <h3 className="pt-2 text-sm font-semibold text-muted-foreground">
                    {isZh ? "转录参数" : "Transcription options"}
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
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
                </div>

                <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                >
                    {isZh ? "保存 VoScript 配置" : "Save VoScript"}
                </Button>
            </div>

            <SpeakerProfilesPanel />
        </div>
    );
}
