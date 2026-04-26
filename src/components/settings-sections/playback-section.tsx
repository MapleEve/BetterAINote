"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import {
    SettingsCardSkeleton,
    SettingsSectionSkeleton,
} from "@/components/settings/settings-skeletons";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { usePlaybackSettingsStore } from "@/features/settings/playback-settings-store";
import {
    type BrowserTimeoutHandle,
    startBrowserTimeout,
    stopBrowserTimeout,
} from "@/lib/platform/browser-shell";
import {
    PLAYBACK_SPEED_OPTIONS,
    type PlaybackSettingsUpdate,
} from "@/services/playback-settings";

const playbackSpeedOptions = PLAYBACK_SPEED_OPTIONS.map((value) => ({
    label: `${value}x`.replace(".0x", "x"),
    value,
}));

interface PlaybackSectionProps {
    embedded?: boolean;
}

export function PlaybackSection({ embedded = false }: PlaybackSectionProps) {
    const { language } = useLanguage();
    const { settings, isLoading, isSaving, updatePlaybackSettings } =
        usePlaybackSettingsStore();
    const [pendingVolume, setPendingVolume] = useState<number | null>(null);
    const saveTimeoutRef = useRef<BrowserTimeoutHandle>(null);
    const isZh = language === "zh-CN";
    const defaultPlaybackSpeed = settings.defaultPlaybackSpeed;
    const defaultVolume = pendingVolume ?? settings.defaultVolume;
    const autoPlayNext = settings.autoPlayNext;

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                stopBrowserTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const showSaveError = () => {
        toast.error(
            isZh
                ? "保存设置失败，已回滚。"
                : "Failed to save settings. Changes reverted.",
        );
    };

    const handlePlaybackSettingChange = async (
        updates: PlaybackSettingsUpdate,
    ) => {
        try {
            await updatePlaybackSettings(updates);
        } catch {
            showSaveError();
        }
    };

    const handleDefaultVolumeChange = (volume: number) => {
        setPendingVolume(volume);

        if (saveTimeoutRef.current) {
            stopBrowserTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = startBrowserTimeout(async () => {
            try {
                await updatePlaybackSettings({ defaultVolume: volume });
            } catch {
                showSaveError();
            } finally {
                saveTimeoutRef.current = null;
                setPendingVolume(null);
            }
        }, 500);
    };

    if (isLoading) {
        if (embedded) {
            return <SettingsCardSkeleton fields={3} />;
        }

        return <SettingsSectionSkeleton cards={1} fieldsPerCard={3} />;
    }

    const content = (
        <Card className="gap-5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Play />
                    {isZh ? "播放设置" : "Playback Settings"}
                </CardTitle>
                <CardDescription>
                    {isZh
                        ? "控制录音播放默认行为和常用快捷键。"
                        : "Controls default recording playback behavior and common shortcuts."}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2 rounded-2xl border bg-muted/20 p-4">
                        <Label htmlFor="playback-speed">
                            {isZh ? "默认播放速度" : "Default playback speed"}
                        </Label>
                        <Select
                            value={defaultPlaybackSpeed.toString()}
                            onValueChange={(value) => {
                                const speed =
                                    PLAYBACK_SPEED_OPTIONS.find(
                                        (option) => option.toString() === value,
                                    ) ?? 1.0;
                                void handlePlaybackSettingChange({
                                    defaultPlaybackSpeed: speed,
                                });
                            }}
                            disabled={isSaving}
                        >
                            <SelectTrigger
                                id="playback-speed"
                                className="w-full"
                            >
                                <SelectValue>
                                    {playbackSpeedOptions.find(
                                        (opt) =>
                                            opt.value === defaultPlaybackSpeed,
                                    )?.label || "1x"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {playbackSpeedOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value.toString()}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "新录音默认使用的播放速度。"
                                : "Default playback speed for new recordings."}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 rounded-2xl border bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="default-volume">
                                {isZh ? "默认音量" : "Default volume"}
                            </Label>
                            <span className="text-sm text-muted-foreground">
                                {defaultVolume}%
                            </span>
                        </div>
                        <Slider
                            id="default-volume"
                            value={[defaultVolume]}
                            onValueChange={(value) => {
                                const volume = value[0] ?? 75;
                                handleDefaultVolumeChange(volume);
                            }}
                            min={0}
                            max={100}
                            step={1}
                        />
                        <p className="text-xs text-muted-foreground">
                            {isZh
                                ? "音频播放默认音量。"
                                : "Default volume level for audio playback."}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/20 px-4 py-3">
                    <div className="flex flex-1 flex-col gap-1">
                        <Label htmlFor="auto-play-next" className="text-base">
                            {isZh
                                ? "自动播放下一条录音"
                                : "Auto-play next recording"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {isZh
                                ? "当前录音结束后自动播放下一条。"
                                : "Automatically play the next recording when the current one ends."}
                        </p>
                    </div>
                    <Switch
                        id="auto-play-next"
                        checked={autoPlayNext}
                        onCheckedChange={(checked) => {
                            void handlePlaybackSettingChange({
                                autoPlayNext: checked,
                            });
                        }}
                        disabled={isSaving}
                    />
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                    <Label className="text-base">
                        {isZh ? "键盘快捷键" : "Keyboard Shortcuts"}
                    </Label>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                        {[
                            ["Space", isZh ? "播放/暂停" : "Play/Pause"],
                            [
                                "Arrow Left",
                                isZh ? "后退 5 秒" : "Seek backward 5s",
                            ],
                            [
                                "Arrow Right",
                                isZh ? "前进 5 秒" : "Seek forward 5s",
                            ],
                            ["Arrow Up", isZh ? "提高音量" : "Increase volume"],
                            [
                                "Arrow Down",
                                isZh ? "降低音量" : "Decrease volume",
                            ],
                        ].map(([key, label]) => (
                            <div
                                key={key}
                                className="flex justify-between gap-4 rounded-xl border bg-muted/20 px-3 py-2"
                            >
                                <span className="text-muted-foreground">
                                    {key}
                                </span>
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (embedded) {
        return content;
    }

    return <div className="flex flex-col gap-6">{content}</div>;
}
