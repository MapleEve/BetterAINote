"use client";

import { Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

    const voscriptCapabilities = [
        isZh ? "异步任务队列" : "Async jobs",
        isZh ? "历史任务列表" : "History listing",
        isZh ? "逐词时间戳" : "Word timestamps",
        isZh ? "逐字稿导出" : "Transcript export",
        isZh ? "声纹库管理" : "Voiceprint management",
        isZh ? "重建 cohort" : "Rebuild cohort",
        isZh ? "片段说话人改绑" : "Segment speaker correction",
    ];

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
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

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
                            ? "这里配置 BetterAINote 与 VoScript 的对接方式。上游录音平台请去 Data Sources；共享 language 偏好仍放在 Transcription，因为切到别的转录后端时也要沿用。"
                            : "Configure how BetterAINote talks to VoScript here. Recording platforms belong in Data Sources. The shared language preference stays in Transcription because other transcription backends reuse it too."}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {voscriptCapabilities.map((capability) => (
                        <span
                            key={capability}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-muted-foreground"
                        >
                            {capability}
                        </span>
                    ))}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="private-transcription-base-url">
                        {isZh ? "VoScript 服务地址" : "VoScript service URL"}
                    </Label>
                    <Input
                        id="private-transcription-base-url"
                        value={privateTranscriptionBaseUrlInput}
                        onChange={(event) =>
                            setPrivateTranscriptionBaseUrl(event.target.value)
                        }
                        placeholder="https://voscript.example.com"
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">
                        {isZh
                            ? "BetterAINote 会把录音提交到这里，并自动跟进处理进度。"
                            : "BetterAINote submits recordings here and follows processing progress automatically."}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="private-transcription-api-key">
                        {isZh ? "VoScript API Key" : "VoScript API key"}
                    </Label>
                    <Input
                        id="private-transcription-api-key"
                        type="password"
                        value={privateTranscriptionApiKey}
                        onChange={(event) =>
                            setPrivateTranscriptionApiKey(event.target.value)
                        }
                        placeholder={
                            privateTranscriptionApiKeySet
                                ? isZh
                                    ? "已存储。输入新 key 可替换。"
                                    : "Stored. Enter a new key to replace it."
                                : "vt_..."
                        }
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">
                        {privateTranscriptionApiKeySet
                            ? isZh
                                ? "当前账号已保存一把 VoScript key。"
                                : "A VoScript key is already stored for this account."
                            : isZh
                              ? "如果 VoScript 开启了鉴权，就在这里保存。"
                              : "Save the key here if VoScript authentication is enabled."}
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="private-transcription-min-speakers">
                            {isZh
                                ? "最少说话人数（0 为自动）"
                                : "Minimum speakers (0 = auto)"}
                        </Label>
                        <Input
                            id="private-transcription-min-speakers"
                            type="number"
                            min="0"
                            step="1"
                            value={privateTranscriptionMinSpeakersInput}
                            onChange={(event) =>
                                setPrivateTranscriptionMinSpeakers(
                                    event.target.value,
                                )
                            }
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="private-transcription-max-speakers">
                            {isZh
                                ? "最多说话人数（0 为自动）"
                                : "Maximum speakers (0 = auto)"}
                        </Label>
                        <Input
                            id="private-transcription-max-speakers"
                            type="number"
                            min="0"
                            step="1"
                            value={privateTranscriptionMaxSpeakersInput}
                            onChange={(event) =>
                                setPrivateTranscriptionMaxSpeakers(
                                    event.target.value,
                                )
                            }
                            disabled={isSaving}
                        />
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="private-transcription-denoise-model">
                            {isZh ? "降噪模型" : "Denoise model"}
                        </Label>
                        <Select
                            value={privateTranscriptionDenoiseModelInput}
                            onValueChange={(value) =>
                                setPrivateTranscriptionDenoiseModel(
                                    value as VoScriptDenoiseModel,
                                )
                            }
                            disabled={isSaving}
                        >
                            <SelectTrigger id="private-transcription-denoise-model">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">
                                    {isZh ? "不降噪" : "None"}
                                </SelectItem>
                                <SelectItem value="deepfilternet">
                                    DeepFilterNet
                                </SelectItem>
                                <SelectItem value="noisereduce">
                                    noisereduce
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="private-transcription-snr-threshold">
                            {isZh
                                ? "SNR 阈值（留空使用服务默认）"
                                : "SNR threshold (blank = service default)"}
                        </Label>
                        <Input
                            id="private-transcription-snr-threshold"
                            type="number"
                            step="0.1"
                            value={privateTranscriptionSnrThresholdInput}
                            onChange={(event) =>
                                setPrivateTranscriptionSnrThreshold(
                                    event.target.value,
                                )
                            }
                            placeholder={isZh ? "例如 10" : "e.g. 10"}
                            disabled={isSaving}
                        />
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="private-transcription-no-repeat-ngram-size">
                            {isZh
                                ? "重复抑制 n-gram（0 为关闭）"
                                : "No-repeat n-gram size (0 = off)"}
                        </Label>
                        <Input
                            id="private-transcription-no-repeat-ngram-size"
                            type="number"
                            min="0"
                            step="1"
                            value={privateTranscriptionNoRepeatNgramSizeInput}
                            onChange={(event) =>
                                setPrivateTranscriptionNoRepeatNgramSize(
                                    event.target.value,
                                )
                            }
                            placeholder={isZh ? "0 或 >= 3" : "0 or >= 3"}
                            disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "用于减少重复片段。0 表示关闭；只有 3 及以上的值才会发送给服务。"
                                : "Helps reduce repeated phrases. 0 turns it off; only values of 3 or higher are sent to the service."}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="private-transcription-max-inflight-jobs">
                            {isZh
                                ? "本地调度活跃任务上限（0 为不限制）"
                                : "Local scheduler inflight job limit (0 = unlimited)"}
                        </Label>
                        <Input
                            id="private-transcription-max-inflight-jobs"
                            type="number"
                            min="0"
                            step="1"
                            value={privateTranscriptionMaxInflightJobsInput}
                            onChange={(event) =>
                                setPrivateTranscriptionMaxInflightJobs(
                                    event.target.value,
                                )
                            }
                            placeholder={isZh ? "默认 1" : "Default 1"}
                            disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "只控制 BetterAINote 同时处理多少个 VoScript 任务，不会改动 VoScript 服务器本身。"
                                : "This only caps how many VoScript tasks BetterAINote processes at once. It does not change the VoScript server itself."}
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>
                        {isZh
                            ? "language 参数来源"
                            : "language parameter source"}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        {isZh
                            ? "VoScript 的 language 继续复用 Transcription 页的默认转录语言。原因是它属于 BetterAINote 的共享转录偏好，不应和某个私有后端绑定。"
                            : "VoScript keeps using the default transcription language from the Transcription page. That preference is shared across BetterAINote transcription backends instead of being tied to a single private service."}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>{isZh ? "兼容说明" : "Compatibility note"}</Label>
                    <p className="text-xs text-muted-foreground">
                        {isZh
                            ? "如果你之前把说话人分离配置在通用 Transcription 里，VoScript 页面会兼容读取旧值并显示为固定人数；保存一次这里的配置后，会优先使用专用字段。"
                            : "If diarization was previously configured in the shared Transcription section, this page reads that legacy value as a fixed speaker count. Once you save here, BetterAINote prefers the VoScript-specific fields."}
                    </p>
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
