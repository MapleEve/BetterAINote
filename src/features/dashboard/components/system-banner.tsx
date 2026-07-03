"use client";

import {
    Download,
    LockKeyhole,
    Package,
    Search,
    ShieldX,
    Upload,
    WifiOff,
    X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
type SystemBannerButtonTone = "action" | "primary" | "dismiss";

interface SystemBannerItemProps {
    banner: VisibleSystemBanner;
    className?: string;
    isStacked: boolean;
    isZh: boolean;
    onDismiss: (banner: VisibleSystemBanner) => void;
}

interface SystemBannerAlertProps {
    a11y: ReturnType<typeof getBannerA11y>;
    banner: VisibleSystemBanner;
    children: ReactNode;
    className?: string;
    isStacked: boolean;
    progress: number | null;
}

type SystemBannerButtonProps = Omit<ButtonProps, "size" | "variant"> & {
    tone?: SystemBannerButtonTone;
};

type SystemBannerAlertVariant = NonNullable<
    Parameters<typeof Alert>[0]["variant"]
>;

interface SystemBannerProgressProps {
    indeterminate: boolean | undefined;
    value: number;
}

const systemBannerAlertVariantByState: Record<
    SystemBannerState,
    SystemBannerAlertVariant
> = {
    "db-locked": "destructiveSoftNeutral",
    "export-progress": "default",
    "import-progress": "default",
    offline: "default",
    "permission-denied": "destructiveSoftNeutral",
    "update-available": "default",
} as const;

const systemBannerAlertClassNames = {
    root: "flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-border bg-card px-3.5 py-2.5 text-[length:var(--text-body-sm)] leading-[var(--lh-body-sm)] text-card-foreground shadow-[var(--shadow-xs)]",
    icon: "inline-grid size-7 flex-none place-items-center rounded-[var(--radius-sm)] bg-muted text-muted-foreground [&_svg]:size-[14px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
    body: "flex min-w-0 flex-1 flex-col gap-0.5",
    title: "block [min-height:auto] overflow-visible [-webkit-line-clamp:unset] [-webkit-box-orient:horizontal] font-semibold tracking-normal text-card-foreground",
    description:
        "block [justify-items:normal] [gap:normal] font-sans text-[12px] leading-[1.45] font-medium text-muted-foreground data-[sot-format=mono]:font-mono",
    actions: "flex flex-none gap-1.5",
} as const;

const systemBannerAlertStateClassNames: Record<SystemBannerState, string> = {
    "db-locked": "",
    "export-progress": "border-primary/30 bg-primary/10",
    "import-progress": "border-primary/30 bg-primary/10",
    offline: "border-border bg-secondary text-secondary-foreground",
    "permission-denied": "",
    "update-available": "border-primary/30 bg-primary/10",
} as const;

const systemBannerIconStateClassNames: Record<SystemBannerState, string> = {
    "db-locked": "bg-destructive/10 text-destructive",
    "export-progress": "bg-primary/10 text-primary",
    "import-progress": "bg-primary/10 text-primary",
    offline: "bg-secondary text-secondary-foreground",
    "permission-denied": "bg-destructive/10 text-destructive",
    "update-available": "bg-primary/10 text-primary",
} as const;

const systemBannerButtonClassNames = {
    action: "cursor-pointer border border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground",
    primaryAction:
        "cursor-pointer border border-border bg-background text-foreground shadow-[var(--shadow-xs)] backdrop-blur-[14px] backdrop-saturate-[140%] hover:bg-muted hover:text-foreground",
    dismissAction:
        "cursor-pointer border border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground",
    actionSize:
        "box-border h-[26px] w-auto gap-[7px] rounded-[7px] px-[10px] py-[7.5px] text-[12px] font-semibold leading-normal has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-4 [&_svg]:stroke-[1.8]",
    dismissSize:
        "box-border h-[26px] w-auto gap-[7px] rounded-[7px] px-[10px] py-[7.5px] text-[12px] font-semibold leading-normal has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-4 [&_svg]:stroke-[1.8]",
} as const;

const systemBannerProgressClassNames = {
    root: "relative h-[6px] min-w-[120px] flex-1 overflow-hidden rounded-[999px] bg-primary/10 data-[sot-state=indeterminate]:bg-primary/10",
    indicator:
        "h-full w-full flex-1 rounded-[inherit] bg-primary transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]",
    indeterminateIndicator:
        "w-[32%] animate-[sbn-sweep_1.4s_linear_infinite] bg-primary/50",
} as const;

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
    indeterminate,
    state,
}: {
    indeterminate: boolean | undefined;
    state: SystemBannerState;
}) {
    if (state === "import-progress" && indeterminate) {
        return <Search aria-hidden="true" />;
    }

    switch (state) {
        case "offline":
            return <WifiOff aria-hidden="true" />;
        case "permission-denied":
            return <ShieldX aria-hidden="true" />;
        case "db-locked":
            return <LockKeyhole aria-hidden="true" />;
        case "update-available":
            return <Package aria-hidden="true" />;
        case "import-progress":
            return <Upload aria-hidden="true" />;
        case "export-progress":
            return <Download aria-hidden="true" />;
    }
}

function SystemBannerAlert({
    a11y,
    banner,
    children,
    className,
    isStacked,
    progress,
}: SystemBannerAlertProps) {
    return (
        <Alert
            aria-live={a11y["aria-live"]}
            role={a11y.role}
            variant={systemBannerAlertVariantByState[banner.state]}
            className={cn(
                systemBannerAlertClassNames.root,
                systemBannerAlertStateClassNames[banner.state],
                className,
            )}
            data-sot-panel="system-banner"
            data-kind={banner.state}
            data-layout={isStacked ? "stacked" : "single"}
            data-pct={progress ?? undefined}
        >
            {children}
        </Alert>
    );
}

function SystemBannerButton({
    className,
    tone = "action",
    ...props
}: SystemBannerButtonProps) {
    return (
        <Button
            size="sm"
            variant={tone === "primary" ? "outline" : "ghost"}
            className={cn(
                tone === "primary"
                    ? systemBannerButtonClassNames.primaryAction
                    : tone === "dismiss"
                      ? systemBannerButtonClassNames.dismissAction
                      : systemBannerButtonClassNames.action,
                tone === "dismiss"
                    ? systemBannerButtonClassNames.dismissSize
                    : systemBannerButtonClassNames.actionSize,
                className,
            )}
            {...props}
        />
    );
}

function SystemBannerProgress({
    indeterminate,
    value,
}: SystemBannerProgressProps) {
    return (
        <Progress
            aria-hidden="true"
            className={systemBannerProgressClassNames.root}
            data-sot-part="system-banner-progress"
            data-sot-state={indeterminate ? "indeterminate" : "ready"}
            indicatorClassName={cn(
                systemBannerProgressClassNames.indicator,
                indeterminate
                    ? systemBannerProgressClassNames.indeterminateIndicator
                    : null,
            )}
            indicatorProps={{
                "data-sot-part": "system-banner-progress-bar",
            }}
            value={value}
        />
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
    const primaryActionTone =
        banner.state === "update-available" && !isStacked
            ? "primary"
            : "action";
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
        <SystemBannerAlert
            a11y={bannerA11y}
            banner={banner}
            className={className}
            isStacked={isStacked}
            progress={progress}
        >
            <span
                className={cn(
                    systemBannerAlertClassNames.icon,
                    systemBannerIconStateClassNames[banner.state],
                )}
                data-sot-part="system-banner-icon"
                aria-hidden="true"
            >
                <SystemBannerIcon
                    indeterminate={banner.indeterminate}
                    state={banner.state}
                />
            </span>
            <div
                className={systemBannerAlertClassNames.body}
                data-sot-part="system-banner-body"
            >
                <AlertTitle
                    className={systemBannerAlertClassNames.title}
                    data-sot-part="system-banner-title"
                >
                    {banner.title ?? defaultCopy.title}
                </AlertTitle>
                <AlertDescription
                    className={systemBannerAlertClassNames.description}
                    data-sot-part="system-banner-description"
                    data-sot-format={hasProgress ? "mono" : undefined}
                >
                    {banner.message ?? defaultCopy.message}
                </AlertDescription>
                {hasProgress ? (
                    <SystemBannerProgress
                        indeterminate={banner.indeterminate}
                        value={progress ?? 0}
                    />
                ) : null}
            </div>
            <div
                className={systemBannerAlertClassNames.actions}
                data-sot-part="system-banner-actions"
            >
                {primaryLabel ? (
                    <SystemBannerButton
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
                        data-sot-control="system-banner-primary-action"
                        tone={primaryActionTone}
                        type="button"
                    >
                        {primaryLabel}
                    </SystemBannerButton>
                ) : null}
                {secondaryLabel ? (
                    <SystemBannerButton
                        onClick={() => handleAction("secondary")}
                        data-sot-control="system-banner-secondary-action"
                        type="button"
                    >
                        {secondaryLabel}
                    </SystemBannerButton>
                ) : null}
                {dismissLabel ? (
                    <SystemBannerButton
                        aria-label={dismissLabel}
                        onClick={() => onDismiss(banner)}
                        data-sot-control="system-banner-dismiss-action"
                        tone="dismiss"
                        type="button"
                    >
                        <X data-icon="inline-start" aria-hidden="true" />
                    </SystemBannerButton>
                ) : null}
            </div>
        </SystemBannerAlert>
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
