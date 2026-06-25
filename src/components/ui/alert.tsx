import type * as React from "react";

import { cn } from "@/lib/utils";

type AlertVariant =
    | "default"
    | "destructive"
    | "destructiveSoft"
    | "destructiveSoftNeutral"
    | "statusError"
    | "recordingTagDeleteConfirm"
    | "recordingTagError"
    | "sourceReportError"
    | "speakerReviewError";
type AlertDensity =
    | "default"
    | "compact"
    | "comfortable"
    | "recordingTagDeleteConfirm"
    | "recordingTagError"
    | "sourceReportError"
    | "speakerReviewError";
type AlertLayout =
    | "default"
    | "inline"
    | "recordingTagInline"
    | "sourceReportError"
    | "speakerReviewError";
type AlertTitleDensity = "default" | "speakerReviewError";
type AlertDescriptionDensity =
    | "default"
    | "compact"
    | "comfortable"
    | "recordingTagDeleteConfirm"
    | "recordingTagError"
    | "speakerReviewError";

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
    recordingTagDeleteConfirm:
        "border-[var(--alert-destructive-soft-strong-border)] bg-[var(--alert-destructive-soft-strong-bg)] text-[var(--fg-primary)] *:data-[slot=alert-description]:text-[var(--fg-primary)] [&>svg]:text-current",
    recordingTagError:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--signal-danger)] *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
    sourceReportError:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--signal-danger)] *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
    speakerReviewError:
        "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--signal-danger)] *:data-[slot=alert-description]:text-[var(--signal-danger)] [&>svg]:text-current",
};

const alertDensityClassNames: Record<AlertDensity, string> = {
    default:
        "rounded-lg px-4 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
    compact:
        "rounded-[var(--radius-sm)] px-[10px] py-[8px] text-[12px] leading-[1.4] font-medium has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-[8px] [&>svg]:size-[14px] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
    comfortable:
        "rounded-[var(--radius-md)] px-[12px] py-[10px] text-[13px] has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-[8px] [&>svg]:size-[14px] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
    recordingTagDeleteConfirm:
        "rounded-[var(--radius-md)] px-[12px] py-[10px] text-[13px] has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-[8px] [&>svg]:size-[14px] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
    recordingTagError:
        "rounded-[var(--radius-sm)] px-[10px] py-[8px] text-[12px] leading-[1.4] font-medium has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-[8px] [&>svg]:size-[14px] [&>svg]:[stroke-linecap:butt] [&>svg]:[stroke-linejoin:miter]",
    sourceReportError: "rounded-lg px-4 py-8 text-sm",
    speakerReviewError:
        "rounded-[var(--radius-md)] px-[12px] py-[10px] text-[13px] leading-normal",
};

const alertLayoutClassNames: Record<AlertLayout, string> = {
    default:
        "grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 [&>svg]:text-current",
    inline: "flex w-full items-center gap-[8px] [&>svg]:text-current",
    recordingTagInline:
        "flex w-full items-center gap-[8px] [&>svg]:text-current",
    sourceReportError:
        "flex w-full flex-col items-center gap-2 text-center [&>svg]:text-current",
    speakerReviewError: "grid w-full gap-2 [&_[data-slot=button]]:w-fit",
};

const alertTitleDensityClassNames: Record<AlertTitleDensity, string> = {
    default: "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
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
    recordingTagDeleteConfirm:
        "block text-[13px] leading-normal text-current [&_strong]:font-bold",
    recordingTagError:
        "flex items-center gap-2 text-[12px] leading-[1.4] font-medium text-current [&_p]:leading-[1.4]",
    speakerReviewError:
        "flex items-center gap-2 text-[12px] leading-normal text-current [&_p]:leading-normal",
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
            className={cn(
                alertDescriptionDensityClassNames[density],
                className,
            )}
            {...props}
        />
    );
}

export { Alert, AlertTitle, AlertDescription };
