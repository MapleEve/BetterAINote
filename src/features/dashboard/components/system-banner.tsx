"use client";

import { type SVGProps, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { hasBrowserWindow } from "@/lib/platform/runtime";

type SystemBannerState =
    | "offline"
    | "permission-denied"
    | "db-locked"
    | "update-available"
    | "import-progress"
    | "export-progress";

interface SystemBannerEventDetail {
    actionLabel?: string;
    dismissLabel?: string;
    id?: string;
    indeterminate?: boolean;
    message?: string;
    progress?: number;
    secondaryActionLabel?: string;
    state: SystemBannerState | null;
    title?: string;
}

type VisibleSystemBanner = SystemBannerEventDetail & {
    state: SystemBannerState;
};

interface SystemBannerProps {
    className?: string;
}

interface SystemBannerDefaultActions {
    actionLabel?: string;
    dismissLabel?: string;
    secondaryActionLabel?: string;
}

type SystemBannerActionRole = "primary" | "secondary";

interface SystemBannerItemProps {
    banner: VisibleSystemBanner;
    className?: string;
    isStacked: boolean;
    isZh: boolean;
    onDismiss: (banner: VisibleSystemBanner) => void;
}

function getDefaultCopy(state: SystemBannerState, isZh: boolean) {
    switch (state) {
        case "offline":
            return {
                title: isZh ? "当前无网络连接" : "Offline",
                message: isZh
                    ? "所有已下载的录音与逐字稿可继续阅览 · 来源同步与新转写已暂停。"
                    : "Downloaded recordings and transcripts remain readable. Source sync and new transcription are paused.",
            };
        case "permission-denied":
            return {
                title: isZh
                    ? "未授权访问录音文件夹"
                    : "Recording folder permission denied",
                message: isZh
                    ? "无法读取来源缓存目录 · 前往「系统设置 · 隐私与安全性 · 完全磁盘访问」打开开关。"
                    : "The source cache folder cannot be read. Open System Settings > Privacy & Security > Full Disk Access.",
            };
        case "db-locked":
            return {
                title: isZh
                    ? "本地数据库被另一个 BetterAINote 实例占用"
                    : "Local database is locked by another BetterAINote instance",
                message: isZh
                    ? "同时只允许一个实例写入 · 当前实例已切到只读模式 · 关闭其它窗口后点「重新连接」。"
                    : "Only one instance can write at a time. This instance is read-only until other windows close.",
            };
        case "update-available":
            return {
                title: isZh
                    ? "BetterAINote 有可用更新"
                    : "BetterAINote update available",
                message: isZh
                    ? "重启后将应用最新版本。"
                    : "Restart to apply the latest version.",
            };
        case "import-progress":
            return {
                title: isZh
                    ? "正在导入 BetterAINote 备份包"
                    : "Importing BetterAINote backup",
                message: isZh
                    ? "录音和来源内容正在写入本地。"
                    : "Recordings and source content are being saved locally.",
            };
        case "export-progress":
            return {
                title: isZh ? "正在导出录音" : "Exporting recordings",
                message: isZh
                    ? "导出文件准备中，请保持当前页面打开。"
                    : "Export files are being prepared. Keep this page open.",
            };
    }
}

function getStackedCopy(state: SystemBannerState, isZh: boolean) {
    switch (state) {
        case "offline":
            return {
                title: isZh ? "当前无网络连接" : "Offline",
                message: isZh
                    ? "来源同步已暂停 · 已下载的录音仍可阅览。"
                    : "Source sync is paused. Downloaded recordings remain readable.",
            };
        case "update-available":
            return {
                title: isZh ? "有可用更新" : "Update available",
                message: isZh
                    ? "重启后将应用。"
                    : "It will be applied after restart.",
            };
        default:
            return getDefaultCopy(state, isZh);
    }
}

function getPriority(state: SystemBannerState) {
    switch (state) {
        case "permission-denied":
        case "db-locked":
            return 0;
        case "offline":
            return 1;
        case "import-progress":
        case "export-progress":
            return 2;
        case "update-available":
            return 3;
    }
}

function getBannerA11y(state: SystemBannerState): {
    "aria-live"?: "polite";
    role?: "alert" | "status";
} {
    if (state === "offline") {
        return { "aria-live": "polite" as const, role: "status" as const };
    }
    if (state === "permission-denied" || state === "db-locked") {
        return { role: "alert" as const };
    }
    return {};
}

function normalizeProgress(progress: number | undefined) {
    if (typeof progress !== "number" || Number.isNaN(progress)) return null;
    const clamped = Math.min(100, Math.max(0, progress));
    return Math.round(clamped / 10) * 10;
}

function getDefaultActions(
    state: SystemBannerState,
    isZh: boolean,
): SystemBannerDefaultActions {
    switch (state) {
        case "offline":
            return {
                actionLabel: isZh ? "重试" : "Retry",
                dismissLabel: isZh ? "收起" : "Dismiss",
            };
        case "permission-denied":
            return {
                actionLabel: isZh ? "打开系统设置" : "Open System Settings",
                secondaryActionLabel: isZh ? "稍后" : "Later",
            };
        case "db-locked":
            return {
                actionLabel: isZh ? "重新连接" : "Reconnect",
                secondaryActionLabel: isZh ? "只读继续" : "Continue read-only",
            };
        case "update-available":
            return {
                actionLabel: isZh ? "重启并更新" : "Restart and update",
                secondaryActionLabel: isZh ? "查看更新内容" : "View changes",
                dismissLabel: isZh ? "稍后再说" : "Later",
            };
        case "import-progress":
            return {
                actionLabel: isZh ? "暂停" : "Pause",
                secondaryActionLabel: isZh ? "取消" : "Cancel",
            };
        case "export-progress":
            return {
                actionLabel: isZh ? "在 Finder 中显示" : "Show in Finder",
                secondaryActionLabel: isZh ? "取消" : "Cancel",
            };
    }
}

function SystemBannerIcon({
    isStacked,
    indeterminate,
    state,
}: {
    isStacked: boolean;
    indeterminate: boolean | undefined;
    state: SystemBannerState;
}) {
    if (state === "import-progress" && indeterminate) {
        return (
            // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
            <svg viewBox="0 0 24 24">
                <circle key="lens" cx="11" cy="11" r="8" />
                <path key="handle" d="m21 21-4.35-4.35" />
            </svg>
        );
    }

    switch (state) {
        case "offline":
            if (isStacked) {
                return (
                    // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
                    <svg viewBox="0 0 24 24">
                        <path key="top-wave" d="M2 12s4-7 10-7" />
                        <path key="bottom-wave" d="M22 12s-4 7-10 7" />
                        <path key="slash" d="M2 2l20 20" />
                    </svg>
                );
            }
            return (
                // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
                <svg viewBox="0 0 24 24">
                    <path key="top-wave" d="M2 12s4-7 10-7c2.3 0 4.4.9 6 2.2" />
                    <path
                        key="bottom-wave"
                        d="M22 12s-4 7-10 7c-2.3 0-4.4-.9-6-2.2"
                    />
                    <path key="slash" d="M2 2l20 20" />
                </svg>
            );
        case "permission-denied":
            return (
                // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
                <svg viewBox="0 0 24 24">
                    <rect
                        key="body"
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                    />
                    <path key="shackle" d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <path key="slash" d="M2 2l20 20" />
                </svg>
            );
        case "db-locked":
            return (
                // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
                <svg viewBox="0 0 24 24">
                    <rect
                        key="body"
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                    />
                    <path key="shackle" d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            );
        case "update-available":
            if (isStacked) {
                return (
                    // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
                    <svg viewBox="0 0 24 24">
                        <polyline key="tray" points="21 8 21 21 3 21 3 8" />
                        <rect key="box" x="1" y="3" width="22" height="5" />
                    </svg>
                );
            }
            return (
                // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
                <svg viewBox="0 0 24 24">
                    <polyline key="tray" points="21 8 21 21 3 21 3 8" />
                    <rect key="box" x="1" y="3" width="22" height="5" />
                    <line key="mark" x1="10" y1="12" x2="14" y2="12" />
                </svg>
            );
        case "import-progress":
            return (
                // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
                <svg viewBox="0 0 24 24">
                    <path
                        key="tray"
                        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                    />
                    <polyline key="arrow-head" points="17 8 12 3 7 8" />
                    <line key="arrow-stem" x1="12" y1="3" x2="12" y2="15" />
                </svg>
            );
        case "export-progress":
            return (
                // biome-ignore lint/a11y/noSvgWithoutTitle: SOT icon SVG is hidden by the data-sot icon wrapper.
                <svg viewBox="0 0 24 24">
                    <path
                        key="tray"
                        d="M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9"
                    />
                    <polyline key="arrow-head" points="7 16 12 21 17 16" />
                    <line key="arrow-stem" x1="12" y1="3" x2="12" y2="21" />
                </svg>
            );
    }
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
    return (
        // biome-ignore lint/a11y/noSvgWithoutTitle: SOT close icon is inside a button with aria-label.
        <svg viewBox="0 0 24 24" {...props}>
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

function getRenderedActions(
    banner: VisibleSystemBanner,
    defaultActions: SystemBannerDefaultActions,
    isStacked: boolean,
    isZh: boolean,
) {
    if (banner.indeterminate && banner.state === "import-progress") {
        return {
            primaryLabel:
                banner.actionLabel ??
                banner.secondaryActionLabel ??
                defaultActions.secondaryActionLabel,
            primaryRole: "primary" as const,
            secondaryLabel: undefined,
            dismissLabel: undefined,
        };
    }

    if (isStacked) {
        return {
            primaryLabel:
                banner.state === "update-available"
                    ? (banner.secondaryActionLabel ??
                      banner.actionLabel ??
                      (isZh ? "查看" : "View"))
                    : (banner.actionLabel ?? defaultActions.actionLabel),
            primaryRole:
                banner.state === "update-available" && !banner.actionLabel
                    ? ("secondary" as const)
                    : ("primary" as const),
            secondaryLabel: undefined,
            dismissLabel: undefined,
        };
    }

    return {
        primaryLabel: banner.actionLabel ?? defaultActions.actionLabel,
        primaryRole: "primary" as const,
        secondaryLabel:
            banner.secondaryActionLabel ?? defaultActions.secondaryActionLabel,
        dismissLabel: banner.dismissLabel ?? defaultActions.dismissLabel,
    };
}

function getSystemBannerActionName(
    state: SystemBannerState,
    role: SystemBannerActionRole,
) {
    if (role === "secondary") {
        switch (state) {
            case "permission-denied":
                return "later";
            case "db-locked":
                return "continue-read-only";
            case "update-available":
                return "view-update-changes";
            case "import-progress":
                return "cancel-import";
            case "export-progress":
                return "cancel-export";
            case "offline":
                return "dismiss";
        }
    }

    switch (state) {
        case "offline":
            return "retry";
        case "permission-denied":
            return "open-system-settings";
        case "db-locked":
            return "reconnect";
        case "update-available":
            return "restart-and-update";
        case "import-progress":
            return "pause-import";
        case "export-progress":
            return "show-export";
    }
}

function dispatchSystemBannerAction(
    banner: VisibleSystemBanner,
    role: SystemBannerActionRole,
) {
    if (!hasBrowserWindow()) {
        return;
    }

    window.dispatchEvent(
        new CustomEvent("betterainote:system-banner-action", {
            detail: {
                action: getSystemBannerActionName(banner.state, role),
                id: banner.id ?? banner.state,
                role,
                state: banner.state,
            },
        }),
    );
}

function SystemBannerItem({
    banner,
    className,
    isStacked,
    isZh,
    onDismiss,
}: SystemBannerItemProps) {
    const defaultCopy = isStacked
        ? getStackedCopy(banner.state, isZh)
        : getDefaultCopy(banner.state, isZh);
    const defaultActions = getDefaultActions(banner.state, isZh);
    const progress = normalizeProgress(banner.progress);
    const hasProgress =
        banner.state === "import-progress" ||
        banner.state === "export-progress";
    const { dismissLabel, primaryLabel, primaryRole, secondaryLabel } =
        getRenderedActions(banner, defaultActions, isStacked, isZh);
    const bannerA11y = getBannerA11y(banner.state);
    const primaryActionVariant =
        banner.state === "update-available" && !isStacked
            ? "systemBannerPrimaryAction"
            : "systemBannerAction";
    const handleAction = (role: SystemBannerActionRole) => {
        dispatchSystemBannerAction(banner, role);

        if (role === "primary" && banner.state === "update-available") {
            if (hasBrowserWindow()) {
                window.location.reload();
            }
            return;
        }

        if (role === "secondary") {
            onDismiss(banner);
        }
    };

    return (
        <Alert
            aria-live={bannerA11y["aria-live"]}
            role={bannerA11y.role}
            className={className}
            density="systemBanner"
            layout="systemBanner"
            variant="systemBanner"
            data-sot-panel="system-banner"
            data-kind={banner.state}
            data-layout={isStacked ? "stacked" : "single"}
            data-pct={progress ?? undefined}
        >
            <span data-sot-part="system-banner-icon" aria-hidden="true">
                <SystemBannerIcon
                    isStacked={isStacked}
                    indeterminate={banner.indeterminate}
                    state={banner.state}
                />
            </span>
            <div data-sot-part="system-banner-body">
                <AlertTitle
                    data-sot-part="system-banner-title"
                    density="systemBanner"
                >
                    {banner.title ?? defaultCopy.title}
                </AlertTitle>
                <AlertDescription
                    data-sot-part="system-banner-description"
                    data-sot-format={hasProgress ? "mono" : undefined}
                    density="systemBanner"
                >
                    {banner.message ?? defaultCopy.message}
                </AlertDescription>
                {hasProgress ? (
                    <Progress
                        aria-hidden="true"
                        data-sot-state={
                            banner.indeterminate ? "indeterminate" : "ready"
                        }
                        value={progress ?? 0}
                        variant="systemBanner"
                    />
                ) : null}
            </div>
            <div data-sot-part="system-banner-actions">
                {primaryLabel ? (
                    <Button
                        aria-busy={
                            banner.indeterminate &&
                            banner.state === "import-progress"
                                ? true
                                : undefined
                        }
                        disabled={
                            banner.indeterminate &&
                            banner.state === "import-progress"
                        }
                        onClick={() => handleAction(primaryRole)}
                        size="systemBannerAction"
                        data-sot-control="system-banner-primary-action"
                        variant={primaryActionVariant}
                        type="button"
                    >
                        {primaryLabel}
                    </Button>
                ) : null}
                {secondaryLabel ? (
                    <Button
                        onClick={() => handleAction("secondary")}
                        size="systemBannerAction"
                        data-sot-control="system-banner-secondary-action"
                        variant="systemBannerAction"
                        type="button"
                    >
                        {secondaryLabel}
                    </Button>
                ) : null}
                {dismissLabel ? (
                    <Button
                        aria-label={dismissLabel}
                        onClick={() => onDismiss(banner)}
                        size="systemBannerDismissAction"
                        data-sot-control="system-banner-dismiss-action"
                        variant="systemBannerDismissAction"
                        type="button"
                    >
                        <CloseIcon
                            data-icon="inline-start"
                            aria-hidden="true"
                        />
                    </Button>
                ) : null}
            </div>
        </Alert>
    );
}

export function SystemBanner({ className }: SystemBannerProps) {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const [eventDetails, setEventDetails] = useState<SystemBannerEventDetail[]>(
        [],
    );
    const [online, setOnline] = useState(() =>
        hasBrowserWindow() ? navigator.onLine : true,
    );
    const [offlineDismissed, setOfflineDismissed] = useState(false);

    useEffect(() => {
        if (!hasBrowserWindow()) {
            return;
        }

        const handleOnline = () => {
            setOnline(true);
            setOfflineDismissed(false);
        };
        const handleOffline = () => {
            setOnline(false);
            setOfflineDismissed(false);
        };
        const handleSystemBanner = (event: Event) => {
            const detail = (event as CustomEvent<SystemBannerEventDetail>)
                .detail;
            setEventDetails((current) => {
                if (!detail?.state) {
                    if (detail?.id) {
                        return current.filter((item) => item.id !== detail.id);
                    }
                    return [];
                }

                const key = detail.id ?? detail.state;
                const next = current.filter(
                    (item) => (item.id ?? item.state) !== key,
                );
                next.push({ ...detail, id: key });
                return next;
            });
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

    const visibleBanners = [
        ...(online
            ? []
            : [
                  ...(offlineDismissed
                      ? []
                      : [
                            {
                                id: "offline",
                                state: "offline" as const,
                            },
                        ]),
              ]),
        ...eventDetails.filter((detail): detail is VisibleSystemBanner =>
            Boolean(detail.state),
        ),
    ]
        .filter(
            (banner, index, banners) =>
                banners.findIndex(
                    (item) => (item.id ?? item.state) === banner.id,
                ) === index,
        )
        .sort((a, b) => getPriority(a.state) - getPriority(b.state))
        .slice(0, 2);

    if (visibleBanners.length === 0) {
        return null;
    }

    const dismissBanner = (banner: VisibleSystemBanner) => {
        if (banner.state === "offline") {
            setOfflineDismissed(true);
            return;
        }
        setEventDetails((current) =>
            current.filter(
                (item) =>
                    (item.id ?? item.state) !== (banner.id ?? banner.state),
            ),
        );
    };

    return (
        <>
            {visibleBanners.map((banner) => (
                <SystemBannerItem
                    banner={banner}
                    className={className}
                    isStacked={visibleBanners.length > 1}
                    isZh={isZh}
                    key={banner.id ?? banner.state}
                    onDismiss={dismissBanner}
                />
            ))}
        </>
    );
}
