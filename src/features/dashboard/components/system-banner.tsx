"use client";

import { BellOff, Database, Download, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { hasBrowserWindow } from "@/lib/platform/runtime";
import { cn } from "@/lib/utils";

type SystemBannerState =
    | "offline"
    | "permission-denied"
    | "db-locked"
    | "update-available"
    | "import-progress"
    | "export-progress";

interface SystemBannerEventDetail {
    actionLabel?: string;
    message?: string;
    state: SystemBannerState | null;
    title?: string;
}

interface SystemBannerProps {
    className?: string;
}

const STATE_TONE: Record<SystemBannerState, string> = {
    offline:
        "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100",
    "permission-denied":
        "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100",
    "db-locked":
        "border-destructive/30 bg-destructive/10 text-destructive dark:text-red-100",
    "update-available":
        "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-100",
    "import-progress":
        "border-primary/30 bg-primary/10 text-primary dark:text-sky-100",
    "export-progress":
        "border-primary/30 bg-primary/10 text-primary dark:text-sky-100",
};

function getDefaultCopy(state: SystemBannerState, isZh: boolean) {
    switch (state) {
        case "offline":
            return {
                title: isZh ? "当前离线" : "Offline",
                message: isZh
                    ? "本地内容仍可查看，联网后会继续同步。"
                    : "Local content remains available. Sync resumes when the network returns.",
            };
        case "permission-denied":
            return {
                title: isZh ? "系统通知已关闭" : "Notifications blocked",
                message: isZh
                    ? "需要系统通知时，请在浏览器权限中重新开启。"
                    : "Enable browser permission again when system notifications are needed.",
            };
        case "db-locked":
            return {
                title: isZh ? "本地数据库被占用" : "Local database locked",
                message: isZh
                    ? "当前写入暂不可用，请稍后重试或关闭其他本地任务。"
                    : "Writes are temporarily unavailable. Try again after local tasks finish.",
            };
        case "update-available":
            return {
                title: isZh ? "有可用更新" : "Update available",
                message: isZh
                    ? "刷新后可使用最新界面与功能。"
                    : "Refresh to use the latest interface and features.",
            };
        case "import-progress":
            return {
                title: isZh ? "正在导入" : "Import in progress",
                message: isZh
                    ? "录音和来源内容正在写入本地。"
                    : "Recordings and source content are being saved locally.",
            };
        case "export-progress":
            return {
                title: isZh ? "正在导出" : "Export in progress",
                message: isZh
                    ? "导出文件准备中，请保持当前页面打开。"
                    : "Export files are being prepared. Keep this page open.",
            };
    }
}

function getIcon(state: SystemBannerState) {
    switch (state) {
        case "offline":
            return WifiOff;
        case "permission-denied":
            return BellOff;
        case "db-locked":
            return Database;
        case "update-available":
            return RefreshCw;
        case "import-progress":
        case "export-progress":
            return Download;
    }
}

export function SystemBanner({ className }: SystemBannerProps) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const [eventDetail, setEventDetail] =
        useState<SystemBannerEventDetail | null>(null);
    const [online, setOnline] = useState(() =>
        hasBrowserWindow() ? navigator.onLine : true,
    );

    useEffect(() => {
        if (!hasBrowserWindow()) {
            return;
        }

        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        const handleSystemBanner = (event: Event) => {
            const detail = (event as CustomEvent<SystemBannerEventDetail>)
                .detail;
            setEventDetail(detail?.state ? detail : null);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        window.addEventListener(
            "betterainote:system-banner",
            handleSystemBanner,
        );

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener(
                "betterainote:system-banner",
                handleSystemBanner,
            );
        };
    }, []);

    const state = online ? eventDetail?.state : "offline";
    if (!state) {
        return null;
    }

    const defaultCopy = getDefaultCopy(state, isZh);
    const Icon = getIcon(state);

    return (
        <section
            aria-live="polite"
            className={cn(
                "flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2 text-sm shadow-xs",
                STATE_TONE[state],
                className,
            )}
            data-system-banner=""
            data-system-banner-state={state}
        >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-muted/35 shadow-xs">
                <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">
                    {eventDetail?.title ?? defaultCopy.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                    {eventDetail?.message ?? defaultCopy.message}
                </span>
            </span>
            {state === "update-available" ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 rounded-xl"
                    onClick={() => window.location.reload()}
                >
                    {eventDetail?.actionLabel ?? (isZh ? "刷新" : "Refresh")}
                </Button>
            ) : null}
        </section>
    );
}
