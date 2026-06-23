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
import { Spinner } from "@/components/ui/spinner";
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

const aiRenamePreviewClassNames = {
    card: {
        root: "w-[min(360px,calc(100vw-32px))] gap-0",
        header:
            "grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 border-b border-border px-4 py-3 [&_[data-slot=card-head-copy]]:min-w-0",
        title: "break-words text-xs font-semibold leading-none text-foreground",
        content:
            "flex min-h-20 flex-col px-4 py-4 [&_[data-slot=card-state]]:flex [&_[data-slot=card-state]]:flex-col [&_[data-slot=card-state]]:gap-2 [&_[data-slot=card-state-label]]:text-[10.5px] [&_[data-slot=card-state-label]]:font-semibold [&_[data-slot=card-state-label]]:uppercase [&_[data-slot=card-state-label]]:tracking-[0.08em] [&_[data-slot=card-state-label]]:text-muted-foreground [&_[data-slot=card-message]]:m-0 [&_[data-slot=card-message]]:break-words [&_[data-slot=card-message]]:text-sm [&_[data-slot=card-message]]:leading-6 [&_[data-slot=card-message]]:text-muted-foreground [&_[data-slot=card-hint]]:m-0 [&_[data-slot=card-hint]]:break-words [&_[data-slot=card-hint]]:text-sm [&_[data-slot=card-hint]]:leading-6 [&_[data-slot=card-hint]]:text-muted-foreground [&_[data-slot=card-review-row]]:my-1.5 [&_[data-slot=card-review-row]]:flex [&_[data-slot=card-review-row]]:flex-col [&_[data-slot=card-review-row]]:gap-1.5 [&_[data-slot=card-review-line]]:flex [&_[data-slot=card-review-line]]:min-w-0 [&_[data-slot=card-review-line]]:items-baseline [&_[data-slot=card-review-line]]:gap-2 [&_[data-slot=card-review-line]]:rounded-lg [&_[data-slot=card-review-line]]:border [&_[data-slot=card-review-line]]:border-border [&_[data-slot=card-review-line]]:bg-muted/50 [&_[data-slot=card-review-line]]:px-2.5 [&_[data-slot=card-review-line]]:py-2 [&_[data-slot=card-review-value]]:min-w-0 [&_[data-slot=card-review-value]]:break-words [&_[data-slot=card-review-value]]:text-sm [&_[data-slot=card-review-value]]:font-semibold [&_[data-slot=card-review-value]]:leading-relaxed [&_[data-review-tone=old]]:line-through [&_[data-review-tone=old]]:text-muted-foreground [&_[data-review-tone=new]]:text-foreground [&_[data-slot=card-preview-title]]:min-w-0 [&_[data-slot=card-preview-title]]:rounded-lg [&_[data-slot=card-preview-title]]:border [&_[data-slot=card-preview-title]]:border-border [&_[data-slot=card-preview-title]]:bg-muted/50 [&_[data-slot=card-preview-title]]:px-2.5 [&_[data-slot=card-preview-title]]:py-2 [&_[data-slot=card-preview-title]]:text-sm [&_[data-slot=card-preview-title]]:font-semibold [&_[data-slot=card-preview-title]]:leading-relaxed [&_[data-slot=card-preview-title]]:text-foreground",
        footer: "gap-1.5 px-4 py-3",
        description:
            "break-words text-xs font-medium leading-snug text-muted-foreground",
        action: "shrink-0",
    },
    button: {
        close:
            "size-6 rounded-md border border-transparent bg-transparent p-0 text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 [&_svg:not([class*='size-'])]:size-3",
        action:
            "h-6 shrink-0 gap-1 rounded-md border border-transparent bg-transparent px-2 text-xs text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground has-[>svg]:px-1.5 dark:hover:bg-accent/50 [&_svg:not([class*='size-'])]:size-3",
        primaryAction:
            "h-6 shrink-0 gap-1 rounded-md bg-primary px-2 text-xs text-primary-foreground shadow-xs hover:bg-primary/90 has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
    },
    badge: {
        oldTag:
            "min-w-[56px] justify-start border-border text-foreground uppercase tracking-[0.04em] [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        newTag:
            "min-w-[56px] justify-start bg-secondary text-secondary-foreground uppercase tracking-[0.04em] [a&]:hover:bg-secondary/90",
    },
    alert: {
        root:
            "flex w-full items-start gap-3 rounded-lg px-4 py-3 text-sm [&_[data-slot=alert-icon]]:flex [&_[data-slot=alert-icon]]:size-8 [&_[data-slot=alert-icon]]:shrink-0 [&_[data-slot=alert-icon]]:items-center [&_[data-slot=alert-icon]]:justify-center [&_[data-slot=alert-icon]]:rounded-full [&_[data-slot=alert-icon]_svg]:size-[14px]",
        error:
            "border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] text-[var(--fg-primary)] *:data-[slot=alert-description]:text-[var(--fg-primary)] [&_[data-slot=alert-icon]]:bg-destructive/10 [&_[data-slot=alert-icon]]:text-destructive",
        unavailable:
            "bg-card text-card-foreground *:data-[slot=alert-description]:text-[var(--fg-primary)] [&_[data-slot=alert-icon]]:bg-muted [&_[data-slot=alert-icon]]:text-muted-foreground",
        description:
            "grid min-w-0 gap-1 text-left [&_[data-slot=alert-message]]:m-0 [&_[data-slot=alert-message]]:break-words [&_[data-slot=alert-message]]:text-sm [&_[data-slot=alert-message]]:font-medium [&_[data-slot=alert-message]]:leading-6 [&_[data-slot=alert-message]]:text-foreground [&_[data-slot=alert-hint]]:m-0 [&_[data-slot=alert-hint]]:break-words [&_[data-slot=alert-hint]]:text-sm [&_[data-slot=alert-hint]]:leading-6 [&_[data-slot=alert-hint]]:text-muted-foreground",
    },
} as const;

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
            className={cn(aiRenamePreviewClassNames.card.root, className)}
            data-open="true"
            data-sot-panel="ai-rename-preview"
            data-sot-state={state}
            role="dialog"
            aria-label={title}
        >
            <CardHeader
                className={aiRenamePreviewClassNames.card.header}
                data-sot-part="head"
            >
                <div data-slot="card-head-copy" data-sot-part="head-copy">
                    <CardTitle
                        className={aiRenamePreviewClassNames.card.title}
                        data-sot-part="eyebrow"
                    >
                        {title}
                    </CardTitle>
                    <CardDescription
                        className={aiRenamePreviewClassNames.card.description}
                        data-sot-part="subtitle"
                    >
                        {subtitle ?? ""}
                    </CardDescription>
                </div>
                {onCancel ? (
                    <CardAction
                        className={aiRenamePreviewClassNames.card.action}
                        data-sot-part="head-action"
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className={aiRenamePreviewClassNames.button.close}
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
                className={aiRenamePreviewClassNames.card.content}
                data-sot-part="body"
            >
                {state === "loading" ? (
                    <div
                        data-slot="card-state"
                        data-sot-part="state"
                        data-sot-state="loading"
                    >
                        <Spinner
                            placement="centeredBlock"
                            data-sot-part="loading-spinner"
                            aria-hidden="true"
                        />
                        <p
                            data-slot="card-message"
                            data-sot-part="message"
                        >
                            {message ?? title}
                        </p>
                    </div>
                ) : isErrorState ? (
                    <Alert
                        className={cn(
                            aiRenamePreviewClassNames.alert.root,
                            state === "error"
                                ? aiRenamePreviewClassNames.alert.error
                                : aiRenamePreviewClassNames.alert.unavailable,
                        )}
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <span
                            data-slot="alert-icon"
                            data-sot-part="error-icon"
                            aria-hidden="true"
                        >
                            <ErrorIcon aria-hidden="true" />
                        </span>
                        <AlertTitle className="sr-only">{title}</AlertTitle>
                        <AlertDescription
                            className={
                                aiRenamePreviewClassNames.alert.description
                            }
                            data-sot-part="state-description"
                        >
                            <p
                                data-slot="alert-message"
                                data-sot-part="message"
                            >
                                {message ?? title}
                            </p>
                            {hint ? (
                                <p
                                    data-slot="alert-hint"
                                    data-sot-part="hint"
                                >
                                    {hint}
                                </p>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div
                        data-slot="card-state"
                        data-sot-part="state"
                        data-sot-state={state}
                    >
                        <div
                            data-slot="card-state-label"
                            data-sot-part="label"
                        >
                            {stateLabel}
                        </div>
                        {state === "review" ? (
                            <div
                                data-slot="card-review-row"
                                data-sot-part="review-row"
                            >
                                <div
                                    data-slot="card-review-line"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="outline"
                                        className={
                                            aiRenamePreviewClassNames.badge
                                                .oldTag
                                        }
                                        data-sot-part="review-tag"
                                        data-sot-review-field="old"
                                    >
                                        原标题
                                    </Badge>
                                    <span
                                        data-slot="card-review-value"
                                        data-review-tone="old"
                                        data-sot-part="review-old"
                                        data-sot-review-value="old"
                                    >
                                        {reviewOldTitle}
                                    </span>
                                </div>
                                <div
                                    data-slot="card-review-line"
                                    data-sot-part="review-line"
                                >
                                    <Badge
                                        variant="secondary"
                                        className={
                                            aiRenamePreviewClassNames.badge
                                                .newTag
                                        }
                                        data-sot-part="review-tag"
                                        data-sot-review-field="new"
                                    >
                                        新标题
                                    </Badge>
                                    <span
                                        data-slot="card-review-value"
                                        data-review-tone="new"
                                        data-sot-part="review-new"
                                        data-sot-review-value="new"
                                    >
                                        {reviewNewTitle}
                                    </span>
                                </div>
                            </div>
                        ) : filename ? (
                            <div
                                data-slot="card-preview-title"
                                data-sot-part="title"
                            >
                                {filename}
                            </div>
                        ) : null}
                        {message ? (
                            <p
                                data-slot="card-hint"
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
                        className={aiRenamePreviewClassNames.card.footer}
                        data-sot-part="actions"
                    >
                        {showRegenerate ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className={
                                    aiRenamePreviewClassNames.button.action
                                }
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
                                className={
                                    aiRenamePreviewClassNames.button.action
                                }
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
                                size="xs"
                                className={
                                    aiRenamePreviewClassNames.button
                                        .primaryAction
                                }
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
