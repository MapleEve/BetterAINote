"use client";

import { FileText } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { SettingsSectionSkeleton } from "@/components/settings/settings-skeletons";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {isZh ? "转录设置" : "Transcription Settings"}
            </h2>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="space-y-1">
                    <h3 className="text-base font-semibold">
                        {isZh
                            ? "公共转录行为"
                            : "Common transcription behavior"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {isZh
                            ? "这里只控制 BetterAINote 的公共转录策略。具体上游录音平台请去 Data Sources，具体私有服务请去 VoScript 或 AI Rename。"
                            : "These settings only control BetterAINote's shared transcription behavior. Configure recording platforms in Data Sources, and configure local services in VoScript or AI Rename."}
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5 flex-1">
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
                    />
                </div>

                <div className="space-y-2">
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
        </div>
    );
}
