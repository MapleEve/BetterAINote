"use client";

import { SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { PlaybackSection } from "./playback-section";
import { SyncSection } from "./sync-section";

export function MiscSection() {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <SlidersHorizontal />
                    {isZh ? "杂项" : "Misc"}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {isZh
                        ? "同步、播放和其它非 provider 设置统一收敛在这里，避免继续新增平行设置页。"
                        : "Sync, playback, and other non-provider settings are grouped here instead of becoming separate top-level pages."}
                </p>
            </div>

            <div className="flex flex-col gap-4">
                <SyncSection embedded />
                <PlaybackSection embedded />
            </div>
        </div>
    );
}
