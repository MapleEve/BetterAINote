"use client";

import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SettingsSectionSkeleton } from "@/features/settings/components/settings-skeletons";
import { useTranscriptionSettingsStore } from "@/features/settings/transcription-settings-store";

export function TranscriptionSection() {
    const { language } = useLanguage();
    const {
        settings: { autoTranscribe, defaultTranscriptionLanguage },
        hasLoaded,
        isLoading,
        isSaving,
        updateTranscriptionSettings,
    } = useTranscriptionSettingsStore();
    const isZh = language === "zh-CN";

    const languageOptions = [
        { label: isZh ? "自动检测" : "Auto-detect", value: null },
        { label: isZh ? "英语" : "English", value: "en" },
        { label: isZh ? "西班牙语" : "Spanish", value: "es" },
        { label: isZh ? "法语" : "French", value: "fr" },
        { label: isZh ? "德语" : "German", value: "de" },
        { label: isZh ? "意大利语" : "Italian", value: "it" },
        { label: isZh ? "葡萄牙语" : "Portuguese", value: "pt" },
        { label: isZh ? "中文" : "Chinese", value: "zh" },
        { label: isZh ? "日语" : "Japanese", value: "ja" },
        { label: isZh ? "韩语" : "Korean", value: "ko" },
        { label: isZh ? "俄语" : "Russian", value: "ru" },
    ];

    const handleAutoTranscribeChange = async (checked: boolean) => {
        try {
            await updateTranscriptionSettings({ autoTranscribe: checked });
        } catch {
            toast.error(
                isZh
                    ? "保存设置失败，已回滚。"
                    : "Failed to save settings. Changes reverted.",
            );
        }
    };

    const handleTranscriptionSettingChange = async (updates: {
        defaultTranscriptionLanguage?: string | null;
    }) => {
        try {
            await updateTranscriptionSettings(updates);
        } catch {
            toast.error(
                isZh
                    ? "保存设置失败，已回滚。"
                    : "Failed to save settings. Changes reverted.",
            );
        }
    };

    if (isLoading && !hasLoaded) {
        return <SettingsSectionSkeleton cards={1} fieldsPerCard={2} />;
    }

    const saveState = isSaving ? "saving" : "ready";

    return (
        <section
            className="flex flex-col gap-5"
            data-settings-section="transcription"
            data-transcription-auto-enabled={autoTranscribe ? "true" : "false"}
            data-transcription-language={defaultTranscriptionLanguage ?? "auto"}
            data-transcription-save-state={saveState}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <FileText className="size-5" />
                        {isZh ? "转录设置" : "Transcription Settings"}
                    </h2>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        {isZh
                            ? "统一控制本地转录队列的默认行为。上游录音平台在 Data Sources，私有转录服务在 VoScript。"
                            : "Controls default behavior for the local transcription queue. Recording platforms live in Data Sources, and private transcription lives in VoScript."}
                    </p>
                </div>
                <span
                    className="glass-control inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.72rem] font-medium text-muted-foreground"
                    data-testid="transcription-save-state"
                    data-state={saveState}
                >
                    {isSaving ? (
                        <Loader2 className="size-3 animate-spin" />
                    ) : null}
                    {isSaving
                        ? isZh
                            ? "保存中"
                            : "Saving"
                        : isZh
                          ? "已同步"
                          : "Synced"}
                </span>
            </div>

            <div
                className="glass-surface flex flex-col gap-5 rounded-[1.1rem] p-5"
                data-testid="transcription-settings-card"
            >
                <div className="space-y-1">
                    <h3 className="text-base font-semibold">
                        {isZh
                            ? "公共转录行为"
                            : "Common transcription behavior"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {isZh
                            ? "这里只控制 BetterAINote 的公共转录策略，不混入录音来源或 AI 重命名配置。"
                            : "These settings only control BetterAINote's shared transcription behavior, without mixing source or AI rename configuration."}
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                        <Label htmlFor="auto-transcribe" className="text-base">
                            {isZh
                                ? "自动转录新录音"
                                : "Auto-transcribe new recordings"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {isZh
                                ? "录音从数据源同步下来后自动进入本地转录队列。"
                                : "Automatically send newly synced recordings into the local transcription queue."}
                        </p>
                    </div>
                    <Switch
                        id="auto-transcribe"
                        checked={autoTranscribe}
                        onCheckedChange={handleAutoTranscribeChange}
                        disabled={isSaving}
                        data-testid="transcription-auto-toggle"
                    />
                </div>

                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/35 p-4">
                    <Label htmlFor="transcription-language">
                        {isZh
                            ? "默认转录语言"
                            : "Default transcription language"}
                    </Label>
                    <Select
                        value={defaultTranscriptionLanguage || "auto"}
                        onValueChange={(value) => {
                            const lang = value === "auto" ? null : value;
                            void handleTranscriptionSettingChange({
                                defaultTranscriptionLanguage: lang,
                            });
                        }}
                        disabled={isSaving}
                    >
                        <SelectTrigger
                            id="transcription-language"
                            className="w-full"
                            data-testid="transcription-language"
                        >
                            <SelectValue>
                                {languageOptions.find(
                                    (opt) =>
                                        opt.value ===
                                        defaultTranscriptionLanguage,
                                )?.label || (isZh ? "自动检测" : "Auto-detect")}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {languageOptions.map((option) => (
                                <SelectItem
                                    key={option.value || "auto"}
                                    value={option.value || "auto"}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {isZh
                            ? "指定 BetterAINote 期望传给转录服务的语言偏好。Auto-detect 会省略 language 字段。"
                            : "Set the preferred language BetterAINote passes to transcription services. Auto-detect omits the language field."}
                    </p>
                </div>
            </div>
        </section>
    );
}
