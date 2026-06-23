import type * as React from "react";

import { cn } from "@/lib/utils";

type AlertVariant =
    | "default"
    | "destructive"
    | "destructiveSoft"
    | "destructiveSoftNeutral"
    | "statusError"
    | "librarySearchError"
    | "playerNoAudio"
    | "recordingTagDeleteConfirm"
    | "recordingTagError"
    | "sourceReportError"
    | "settingsBanner"
    | "settingsBannerError"
    | "settingsLoadError"
    | "settingsVoScriptWarning"
    | "speakerReviewError"
    | "aiRenamePreviewError"
    | "aiRenamePreviewUnavailable";
type AlertDensity =
    | "default"
    | "compact"
    | "comfortable"
    | "librarySearchError"
    | "playerNoAudio"
    | "recordingTagDeleteConfirm"
    | "recordingTagError"
    | "sourceReportError"
    | "settingsBanner"
    | "speakerReviewError"
    | "aiRenamePreview";
type AlertLayout =
    | "default"
    | "inline"
    | "librarySearchError"
    | "playerNoAudio"
    | "recordingTagInline"
    | "sourceReportError"
    | "settingsBanner"
    | "settingsBannerAction"
    | "speakerReviewError"
    | "aiRenamePreview";
type AlertTitleDensity =
    | "default"
    | "librarySearchError"
    | "playerNoAudio"
    | "settingsBanner"
    | "speakerReviewError";
type AlertDescriptionDensity =
    | "default"
    | "compact"
    | "comfortable"
    | "playerNoAudio"
    | "recordingTagDeleteConfirm"
    | "recordingTagError"
    | "settingsBanner"
    | "speakerReviewError"
    | "aiRenamePreview";

const settingsBannerIconSlotClassName =
    "[&_[data-sot-banner-icon]]:inline-flex [&_[data-sot-banner-icon]]:size-6 [&_[data-sot-banner-icon]]:flex-none [&_[data-sot-banner-icon]]:items-center [&_[data-sot-banner-icon]]:justify-center [&_[data-sot-banner-icon]]:rounded-md [&_[data-sot-banner-icon]]:border [&_[data-sot-banner-icon]]:border-[var(--settings-banner-icon-border)] [&_[data-sot-banner-icon]]:bg-[var(--settings-banner-icon-bg)] [&_[data-sot-banner-icon]]:text-[var(--settings-banner-icon-color)] [&_[data-sot-banner-icon]_svg]:size-3.5";

const settingsBannerBaseVariantClassName =
    "[--settings-banner-icon-bg:var(--bg-elevated)] [--settings-banner-icon-border:var(--line-hairline)] [--settings-banner-icon-color:var(--fg-tertiary)] bg-card text-[var(--fg-primary)] [border-color:var(--line-hairline)] *:data-[slot=alert-description]:text-[var(--fg-tertiary)]";

const alertVariantClassNames: Record<AlertVariant, string> = {
    default: "bg-card text-card-foreground",
    destructive:
        "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
    destructiveSoft:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--signal-danger)] *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
    destructiveSoftNeutral:
        "border-[var(--alert-destructive-soft-strong-border)] bg-[var(--alert-destructive-soft-strong-bg)] text-[var(--fg-primary)] *:data-[slot=alert-description]:text-[var(--fg-primary)] [&>svg]:text-current",
    statusError:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--signal-danger)] *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
    librarySearchError:
        "border-0 bg-transparent text-[var(--signal-danger)] shadow-none *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
    playerNoAudio:
        "border-[var(--system-banner-offline-border)] bg-[var(--system-banner-offline-bg)] text-[var(--fg-primary)] *:data-[slot=alert-description]:text-[var(--fg-tertiary)]",
    recordingTagDeleteConfirm:
        "border-[var(--alert-destructive-soft-strong-border)] bg-[var(--alert-destructive-soft-strong-bg)] text-[var(--fg-primary)] *:data-[slot=alert-description]:text-[var(--fg-primary)] [&>svg]:text-current",
    recordingTagError:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--signal-danger)] *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
    sourceReportError:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--signal-danger)] *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
    settingsBanner: `${settingsBannerBaseVariantClassName} data-[sot-tone=ok]:[--settings-banner-icon-color:var(--signal-success)] data-[sot-tone=warn]:[--settings-banner-icon-color:var(--signal-warning)] data-[sot-tone=err]:[--settings-banner-icon-color:var(--signal-danger)] data-[sot-tone=syncing]:[--settings-banner-icon-color:var(--signal-info)] data-[sot-tone=neu]:[--settings-banner-icon-color:var(--fg-tertiary)] data-[sot-state=err]:[--settings-banner-icon-color:var(--signal-danger)] ${settingsBannerIconSlotClassName}`,
    settingsBannerError: `[--settings-banner-icon-bg:var(--alert-destructive-soft-strong-bg)] [--settings-banner-icon-border:var(--alert-destructive-soft-border)] [--settings-banner-icon-color:var(--signal-danger)] border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--fg-primary)] *:data-[slot=alert-description]:text-[var(--fg-primary)] ${settingsBannerIconSlotClassName}`,
    settingsLoadError: `[--settings-banner-icon-bg:var(--alert-destructive-soft-strong-bg)] [--settings-banner-icon-border:var(--alert-destructive-soft-border)] [--settings-banner-icon-color:var(--signal-danger)] border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--fg-primary)] *:data-[slot=alert-description]:text-[var(--fg-primary)] ${settingsBannerIconSlotClassName}`,
    settingsVoScriptWarning: `${settingsBannerBaseVariantClassName} [--settings-banner-icon-color:var(--signal-warning)] data-[sot-state=test-error]:[--settings-banner-icon-color:var(--signal-danger)] ${settingsBannerIconSlotClassName}`,
    speakerReviewError:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--signal-danger)] *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
    aiRenamePreviewError:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--fg-primary)] *:data-[slot=alert-description]:text-[var(--fg-primary)] [&_[data-slot=alert-icon]]:bg-destructive/10 [&_[data-slot=alert-icon]]:text-destructive",
    aiRenamePreviewUnavailable:
        "bg-card text-card-foreground *:data-[slot=alert-description]:text-[var(--fg-primary)] [&_[data-slot=alert-icon]]:bg-muted [&_[data-slot=alert-icon]]:text-muted-foreground",
};

const alertDensityClassNames: Record<AlertDensity, string> = {
    default:
        "rounded-lg px-4 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
    compact:
        "rounded-[var(--radius-sm)] px-[10px] py-[8px] text-[12px] leading-[1.4] font-medium has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-[8px] [&>svg]:size-[14px] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
    comfortable:
        "rounded-[var(--radius-md)] px-[12px] py-[10px] text-[13px] has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-[8px] [&>svg]:size-[14px] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
    librarySearchError:
        "px-4 py-4 text-center text-sm",
    playerNoAudio:
        "mb-3 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-normal",
    recordingTagDeleteConfirm:
        "rounded-[var(--radius-md)] px-[12px] py-[10px] text-[13px] has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-[8px] [&>svg]:size-[14px] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
    recordingTagError:
        "rounded-[var(--radius-sm)] px-[10px] py-[8px] text-[12px] leading-[1.4] font-medium has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-[8px] [&>svg]:size-[14px] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
    sourceReportError: "rounded-lg px-4 py-8 text-sm",
    settingsBanner: "mb-4 rounded-lg px-3.5 py-3 text-sm",
    speakerReviewError:
        "rounded-[var(--radius-md)] px-[12px] py-[10px] text-[13px] leading-normal",
    aiRenamePreview:
        "rounded-lg px-4 py-3 text-sm [&_[data-slot=alert-icon]]:flex [&_[data-slot=alert-icon]]:size-8 [&_[data-slot=alert-icon]]:shrink-0 [&_[data-slot=alert-icon]]:items-center [&_[data-slot=alert-icon]]:justify-center [&_[data-slot=alert-icon]]:rounded-full [&_[data-slot=alert-icon]_svg]:size-[14px]",
};

const alertLayoutClassNames: Record<AlertLayout, string> = {
    default:
        "grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 [&>svg]:text-current",
    inline: "flex w-full items-center gap-[8px] [&>svg]:text-current",
    librarySearchError:
        "flex w-full flex-col items-center gap-2 text-center [&>svg]:text-current",
    playerNoAudio:
        "grid w-full grid-cols-[26px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-px [&_[data-icon=inline-start]]:col-start-1 [&_[data-icon=inline-start]]:row-span-2 [&_[data-icon=inline-start]]:inline-grid [&_[data-icon=inline-start]]:size-[26px] [&_[data-icon=inline-start]]:place-self-center [&_[data-icon=inline-start]]:place-items-center [&_[data-icon=inline-start]]:rounded-[50%] [&_[data-icon=inline-start]]:bg-[var(--system-banner-offline-icon-bg)] [&_[data-icon=inline-start]]:text-[var(--signal-warning)] [&_[data-icon=inline-start]_svg]:size-[14px] [&_[data-player-no-audio-text]]:col-start-2 [&_[data-player-no-audio-text]]:flex [&_[data-player-no-audio-text]]:min-w-0 [&_[data-player-no-audio-text]]:flex-col [&_[data-player-no-audio-text]]:gap-px",
    recordingTagInline: "flex w-full items-center gap-[8px] [&>svg]:text-current",
    sourceReportError:
        "flex w-full flex-col items-center gap-2 text-center [&>svg]:text-current",
    settingsBanner:
        "grid w-full grid-cols-[auto_1fr] items-start gap-3 [&_[data-sot-banner-body]]:min-w-0",
    settingsBannerAction:
        "grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 [&_[data-sot-banner-body]]:min-w-0 [&_[data-slot=button]]:self-start",
    speakerReviewError:
        "grid w-full gap-2 [&_[data-slot=button]]:w-fit",
    aiRenamePreview: "flex w-full items-start gap-3",
};

const alertTitleDensityClassNames: Record<AlertTitleDensity, string> = {
    default:
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
    librarySearchError:
        "min-h-0 text-center text-sm font-medium tracking-normal",
    playerNoAudio:
        "col-start-2 min-h-0 font-sans text-[12.5px] font-semibold leading-normal tracking-normal text-[var(--fg-primary)]",
    settingsBanner: "font-medium leading-none",
    speakerReviewError: "min-h-0 font-medium leading-normal tracking-normal",
};

const alertDescriptionDensityClassNames: Record<
    AlertDescriptionDensity,
    string
> = {
    default:
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
    compact:
        "flex items-center gap-2 text-[12px] leading-[1.4] font-medium text-current [&_p]:leading-[1.4]",
    comfortable:
        "block text-[13px] leading-normal text-current [&_strong]:font-bold",
    playerNoAudio:
        "col-start-2 block font-sans text-[11.5px] font-medium leading-[1.5] text-[var(--fg-tertiary)] [&_p]:leading-[1.5]",
    recordingTagDeleteConfirm:
        "block text-[13px] leading-normal text-current [&_strong]:font-bold",
    recordingTagError:
        "flex items-center gap-2 text-[12px] leading-[1.4] font-medium text-current [&_p]:leading-[1.4]",
    settingsBanner: "mt-1 block text-sm text-muted-foreground",
    speakerReviewError:
        "flex items-center gap-2 text-[12px] leading-normal text-current [&_p]:leading-normal",
    aiRenamePreview:
        "grid min-w-0 gap-1 text-left [&_[data-slot=alert-message]]:m-0 [&_[data-slot=alert-message]]:break-words [&_[data-slot=alert-message]]:text-sm [&_[data-slot=alert-message]]:font-medium [&_[data-slot=alert-message]]:leading-6 [&_[data-slot=alert-message]]:text-foreground [&_[data-slot=alert-hint]]:m-0 [&_[data-slot=alert-hint]]:break-words [&_[data-slot=alert-hint]]:text-sm [&_[data-slot=alert-hint]]:leading-6 [&_[data-slot=alert-hint]]:text-muted-foreground",
};

function Alert({
    className,
    density = "default",
    layout = "default",
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    density?: AlertDensity;
    layout?: AlertLayout;
    variant?: AlertVariant;
}) {
    return (
        <div
            data-slot="alert"
            data-density={density}
            role="alert"
            className={cn(
                "relative border border-border",
                alertLayoutClassNames[layout],
                alertVariantClassNames[variant],
                alertDensityClassNames[density],
                className,
            )}
            {...props}
        />
    );
}

function AlertTitle({
    className,
    density = "default",
    ...props
}: React.ComponentProps<"div"> & {
    density?: AlertTitleDensity;
}) {
    return (
        <div
            data-slot="alert-title"
            data-density={density}
            className={cn(alertTitleDensityClassNames[density], className)}
            {...props}
        />
    );
}

function AlertDescription({
    className,
    density = "default",
    ...props
}: React.ComponentProps<"div"> & {
    density?: AlertDescriptionDensity;
}) {
    return (
        <div
            data-slot="alert-description"
            data-density={density}
            className={cn(alertDescriptionDensityClassNames[density], className)}
            {...props}
        />
    );
}

export { Alert, AlertTitle, AlertDescription };
