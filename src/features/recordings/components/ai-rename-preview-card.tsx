"use client";

import { Check, RefreshCw, X } from "lucide-react";
import type { SVGProps } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface AiRenamePreviewCardProps {
    title: string;
    bodyLabel?: string;
    closeLabel?: string;
    filename?: string | null;
    hint?: string | null;
    originalFilename?: string | null;
    applyLabel?: string;
    cancelLabel?: string;
    isApplying: boolean;
    isRegenerating: boolean;
    message?: string | null;
    onApply?: () => void;
    onCancel?: () => void;
    onRegenerate?: () => void;
    regenerateLabel?: string;
    subtitle?: string;
    state?: "loading" | "preview" | "review" | "error" | "unavailable";
    className?: string;
}

function AiRenameUnavailableIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M4.93 4.93l14.14 14.14" />
        </svg>
    );
}

function AiRenameErrorIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
    );
}

export function AiRenamePreviewCard({
    applyLabel,
    bodyLabel,
    cancelLabel,
    className,
    closeLabel,
    filename,
    hint,
    isApplying,
    isRegenerating,
    message,
    onApply,
    onCancel,
    onRegenerate,
    originalFilename,
    regenerateLabel,
    state = "preview",
    subtitle,
    title,
}: AiRenamePreviewCardProps) {
    const isBusy = isApplying || isRegenerating;
    const canAct = state === "preview" || state === "review";
    const showRegenerate = Boolean(onRegenerate && regenerateLabel);
    const showCancel = Boolean(onCancel && cancelLabel);
    const showApply = Boolean(onApply && applyLabel);
    const isErrorState = state === "error" || state === "unavailable";
    const stateLabel = state === "review" ? "复核确认" : (bodyLabel ?? title);
    const reviewOldTitle = originalFilename?.trim() || "—";
    const reviewNewTitle = filename?.trim() || "—";
    const ErrorIcon =
        state === "unavailable" ? AiRenameUnavailableIcon : AiRenameErrorIcon;

    return (
        <Card
            hasNoPadding
            className={cn("w-[min(360px,calc(100vw-32px))] gap-0", className)}
            data-open="true"
            data-sot-panel="ai-rename-preview"
            data-sot-state={state}
            role="dialog"
            aria-label={title}
        >
            <CardHeader
                className="grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 border-b border-border px-4 py-3"
                data-sot-part="head"
            >
                <div className="min-w-0" data-sot-part="head-copy">
                    <CardTitle
                        className="break-words text-xs font-semibold leading-none text-foreground"
                        data-sot-part="eyebrow"
                    >
                        {title}
                    </CardTitle>
                    <CardDescription
                        className="break-words text-xs font-medium leading-snug text-muted-foreground"
                        data-sot-part="subtitle"
                    >
                        {subtitle ?? ""}
                    </CardDescription>
                </div>
                {onCancel ? (
                    <CardAction
                        className="shrink-0"
                        data-sot-part="head-action"
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="rounded-md"
                            onClick={onCancel}
                            disabled={isApplying}
                            aria-label={closeLabel ?? cancelLabel}
                            title={closeLabel ?? cancelLabel}
                            data-sot-control="ai-rename-close"
                            data-sot-state={isApplying ? "busy" : state}
                        >
                            <X data-icon="inline-start" aria-hidden="true" />
                        </Button>
                    </CardAction>
                ) : null}
            </CardHeader>

            <CardContent
                className="flex min-h-20 flex-col px-4 py-4"
                data-sot-part="body"
            >
                {state === "loading" ? (
                    <div
                        className="flex flex-col gap-2"
                        data-sot-part="state"
                        data-sot-state="loading"
                    >
                        <span
                            className="mx-auto mb-1 size-4 animate-spin rounded-full border-2 border-border border-t-current"
                            data-sot-part="loading-spinner"
                            aria-hidden="true"
                        />
                        <p
                            className="m-0 break-words text-sm leading-6 text-muted-foreground"
                            data-sot-part="message"
                        >
                            {message ?? title}
                        </p>
                    </div>
                ) : isErrorState ? (
                    <Alert
                        variant={state === "error" ? "destructive" : "default"}
                        className="items-start gap-3"
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <span
                            className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-full",
                                state === "unavailable"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-destructive/10 text-destructive",
                            )}
                            data-sot-part="error-icon"
                            aria-hidden="true"
                        >
                            <ErrorIcon
                                width={14}
                                height={14}
                                aria-hidden="true"
                            />
                        </span>
                        <AlertTitle className="sr-only">{title}</AlertTitle>
                        <AlertDescription
                            className="grid min-w-0 gap-1 text-left"
                            data-sot-part="state-description"
                        >
                            <p
                                className="m-0 break-words text-sm font-medium leading-6 text-foreground"
                                data-sot-part="message"
                            >
                                {message ?? title}
                            </p>
                            {hint ? (
                                <p
                                    className="m-0 break-words text-sm leading-6 text-muted-foreground"
                                    data-sot-part="hint"
                                >
                                    {hint}
                                </p>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div
                        className="flex flex-col gap-2"
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <div
                            className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                            data-sot-part="label"
                        >
                            {stateLabel}
                        </div>
                        {state === "review" ? (
                            <div
                                className="my-1.5 flex flex-col gap-1.5"
                                data-sot-part="review-row"
                            >
                                <div
                                    className="flex min-w-0 items-baseline gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-2"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="outline"
                                        className="min-w-[56px] justify-start uppercase tracking-[0.04em]"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="old"
                                    >
                                        原标题
                                    </Badge>
                                    <span
                                        className="min-w-0 break-words text-sm font-semibold leading-relaxed line-through text-muted-foreground"
                                        data-sot-part="review-old"
                                        data-sot-review-value="old"
                                    >
                                        {reviewOldTitle}
                                    </span>
                                </div>
                                <div
                                    className="flex min-w-0 items-baseline gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-2"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="secondary"
                                        className="min-w-[56px] justify-start uppercase tracking-[0.04em]"
                                        data-sot-part="review-tag"
                                        data-sot-review-field="new"
                                    >
                                        新标题
                                    </Badge>
                                    <span
                                        className="min-w-0 break-words text-sm font-semibold leading-relaxed text-foreground"
                                        data-sot-part="review-new"
                                        data-sot-review-value="new"
                                    >
                                        {reviewNewTitle}
                                    </span>
                                </div>
                            </div>
                        ) : filename ? (
                            <div
                                className="min-w-0 rounded-lg border border-border bg-muted/50 px-2.5 py-2 text-sm font-semibold leading-relaxed text-foreground"
                                data-sot-part="title"
                            >
                                {filename}
                            </div>
                        ) : null}
                        {message ? (
                            <p
                                className="m-0 break-words text-sm leading-6 text-muted-foreground"
                                data-sot-part="hint"
                            >
                                {message}
                            </p>
                        ) : null}
                    </div>
                )}
            </CardContent>

            {showRegenerate || showCancel || showApply ? (
                <>
                    <Separator className="mx-4" />
                    <CardFooter
                        className="flex items-center gap-1.5 px-4 py-3"
                        data-sot-part="actions"
                    >
                        {showRegenerate ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className="shrink-0"
                                onClick={onRegenerate}
                                disabled={isBusy || state === "unavailable"}
                                aria-busy={isRegenerating}
                                aria-disabled={
                                    isBusy || state === "unavailable"
                                        ? "true"
                                        : "false"
                                }
                                aria-label={regenerateLabel}
                                title={regenerateLabel}
                                data-sot-control="ai-rename-regenerate"
                                data-sot-state={
                                    isRegenerating ? "loading" : state
                                }
                            >
                                <RefreshCw
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                                {regenerateLabel}
                            </Button>
                        ) : null}
                        <span
                            className="flex-1"
                            data-sot-part="actions-spacer"
                        />
                        {showCancel ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className="shrink-0"
                                onClick={onCancel}
                                disabled={isApplying}
                                aria-label={cancelLabel}
                                title={cancelLabel}
                                data-sot-control="ai-rename-cancel"
                                data-sot-state={isApplying ? "busy" : state}
                            >
                                {cancelLabel}
                            </Button>
                        ) : null}
                        {showApply ? (
                            <Button
                                type="button"
                                variant="default"
                                size="xs"
                                className="shrink-0"
                                onClick={onApply}
                                disabled={isBusy || !canAct}
                                aria-disabled={
                                    isBusy || !canAct ? "true" : "false"
                                }
                                aria-busy={isApplying}
                                aria-label={applyLabel}
                                title={applyLabel}
                                data-sot-control="ai-rename-apply"
                                data-sot-state={isApplying ? "loading" : state}
                            >
                                <Check
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                                {applyLabel}
                            </Button>
                        ) : null}
                    </CardFooter>
                </>
            ) : null}
        </Card>
    );
}
