"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTitleGenerationSettingsStore } from "@/features/settings/title-generation-settings-store";

export function TitleGenerationSection() {
    const {
        settings: {
            autoGenerateTitle,
            titleGenerationBaseUrl,
            titleGenerationModel,
            titleGenerationApiKeySet,
        },
        hasLoaded,
        isLoading,
        isSaving,
        updateTitleGenerationSettings,
    } = useTitleGenerationSettingsStore();
    const { language } = useLanguage();
    const [titleGenerationBaseUrlInput, setTitleGenerationBaseUrlInput] =
        useState("");
    const [titleGenerationModelInput, setTitleGenerationModelInput] =
        useState("");
    const [titleGenerationApiKey, setTitleGenerationApiKey] = useState("");
    const isZh = language === "zh-CN";

    useEffect(() => {
        setTitleGenerationBaseUrlInput(titleGenerationBaseUrl ?? "");
    }, [titleGenerationBaseUrl]);

    useEffect(() => {
        setTitleGenerationModelInput(titleGenerationModel ?? "");
    }, [titleGenerationModel]);

    const handleAutoGenerateTitleChange = async (checked: boolean) => {
        try {
            await updateTitleGenerationSettings({
                autoGenerateTitle: checked,
            });
        } catch {
            toast.error(
                isZh
                    ? "保存设置失败，已回滚。"
                    : "Failed to save settings. Changes reverted.",
            );
        }
    };

    const handleTitleGenerationConfigSave = async () => {
        const baseUrl = titleGenerationBaseUrlInput.trim();
        const model = titleGenerationModelInput.trim();
        const apiKey = titleGenerationApiKey.trim();

        if (!model) {
            toast.error(
                isZh
                    ? "必须填写重命名模型"
                    : "Rename service model is required",
            );
            return;
        }

        if (!titleGenerationApiKeySet && !apiKey) {
            toast.error(
                isZh
                    ? "必须填写重命名服务 API Key"
                    : "Rename service API key is required",
            );
            return;
        }

        try {
            await updateTitleGenerationSettings({
                titleGenerationBaseUrl: baseUrl || null,
                titleGenerationModel: model,
                ...(apiKey ? { titleGenerationApiKey: apiKey } : {}),
            });
            if (apiKey) {
                setTitleGenerationApiKey("");
            }
            toast.success(
                isZh ? "AI 重命名设置已保存" : "AI rename settings saved",
            );
        } catch {
            toast.error(
                isZh
                    ? "保存 AI 重命名设置失败"
                    : "Failed to save AI rename settings",
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
                <Sparkles className="w-5 h-5" />
                {isZh ? "AI 重命名服务" : "AI Rename Service"}
            </h2>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="space-y-1">
                    <h3 className="text-base font-semibold">
                        {isZh ? "标题生成服务" : "Title generation service"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {isZh
                            ? "这里单独配置本地 AI 重命名服务。它读取已经生成好的逐字稿，不参与上游录音抓取，也不影响 VoScript 的转录队列。"
                            : "Configure the local AI rename service here. It reads completed transcripts only, and does not participate in source sync or the VoScript transcription queue."}
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5 flex-1">
                        <Label
                            htmlFor="auto-generate-title"
                            className="text-base"
                        >
                            {isZh
                                ? "基于逐字稿自动重命名"
                                : "Auto-rename from transcript"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {isZh
                                ? "本地逐字稿生成后自动调用 AI rename 服务生成文件名。"
                                : "Automatically call the AI rename service after a local transcript is ready."}
                        </p>
                    </div>
                    <Switch
                        id="auto-generate-title"
                        checked={autoGenerateTitle}
                        onCheckedChange={(checked) =>
                            void handleAutoGenerateTitleChange(checked)
                        }
                        disabled={isSaving}
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="title-generation-base-url">
                            {isZh ? "重命名服务地址" : "Rename service URL"}
                        </Label>
                        <Input
                            id="title-generation-base-url"
                            value={titleGenerationBaseUrlInput}
                            onChange={(event) =>
                                setTitleGenerationBaseUrlInput(
                                    event.target.value,
                                )
                            }
                            placeholder="https://api.openai.com/v1"
                            disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "只用于文件名生成的 OpenAI 兼容接口。"
                                : "OpenAI-compatible endpoint used only for filename generation."}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="title-generation-model">
                            {isZh ? "重命名模型" : "Rename model"}
                        </Label>
                        <Input
                            id="title-generation-model"
                            value={titleGenerationModelInput}
                            onChange={(event) =>
                                setTitleGenerationModelInput(event.target.value)
                            }
                            placeholder="gpt-4.1-mini"
                            disabled={isSaving}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="title-generation-api-key">
                        {isZh ? "重命名服务 API Key" : "Rename service API key"}
                    </Label>
                    <Input
                        id="title-generation-api-key"
                        type="password"
                        value={titleGenerationApiKey}
                        onChange={(event) =>
                            setTitleGenerationApiKey(event.target.value)
                        }
                        placeholder={
                            titleGenerationApiKeySet
                                ? isZh
                                    ? "已存储。输入新 key 可替换。"
                                    : "Stored. Enter a new key to replace it."
                                : "sk-..."
                        }
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">
                        {titleGenerationApiKeySet
                            ? isZh
                                ? "当前账号已存储一把仅用于 AI 重命名的 key。"
                                : "An API key used only for AI rename is already stored for this account."
                            : isZh
                              ? "保存一把仅用于文件名生成的 API key。"
                              : "Save the API key used only for filename generation."}
                    </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                        {isZh
                            ? "上游录音平台连接在 Data Sources，私有转录服务在 VoScript。本页只负责 transcript -> title 这条链。"
                            : "Recording-platform connections live in Data Sources, and private transcription lives in VoScript. This page only owns the transcript-to-title chain."}
                    </p>
                    <Button
                        type="button"
                        onClick={() => void handleTitleGenerationConfigSave()}
                        disabled={isSaving}
                    >
                        {isZh ? "保存 AI 重命名配置" : "Save AI rename"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
