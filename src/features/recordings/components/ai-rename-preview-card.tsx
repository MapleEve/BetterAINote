"use client";

import { Ban, Check, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useId } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "@/components/ui/popover";
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

const aiRenamePreviewClassNames = {
    card: {
        root: "w-[min(360px,calc(100vw-32px))] gap-0 rounded-[var(--radius-lg)] border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] p-0 font-sans shadow-[var(--card-popover-shadow)] backdrop-blur-none transition-none data-[open=true]:pointer-events-auto [&_[data-sot-part=state][hidden]]:!hidden",
        header: "h-[55px] grid-cols-[1fr_auto] items-start gap-x-2.5 gap-y-0.5 border-b border-[var(--card-popover-divider)] px-[14px] pt-3 pb-2 [&_[data-slot=card-head-copy]]:min-w-0",
        title: "break-words font-sans text-[11px] font-semibold leading-normal tracking-[0.02em] text-[var(--fg-secondary)]",
        content: "flex flex-col p-[14px]",
        loadingContent: "h-[78px]",
        errorContent: "h-[88px]",
        unavailableContent: "h-[130px]",
        footer: "h-[48px] gap-1.5 bg-[var(--card-popover-footer-bg)] px-[14px] py-0",
        description:
            "break-words font-sans text-[11px] font-medium leading-normal text-[var(--fg-tertiary)]",
        action: "shrink-0",
    },
    state: {
        root: "flex flex-col items-stretch gap-2",
        label: "font-mono text-[10.5px] font-semibold leading-none text-[var(--fg-tertiary)] uppercase tracking-[0.08em]",
        message:
            "m-0 break-words font-sans text-[12.5px] font-medium leading-[1.5] text-[var(--fg-secondary)]",
        hint: "m-0 max-w-full break-words font-sans text-[11.5px] font-medium leading-[1.5] text-[var(--fg-tertiary)] [text-wrap:pretty]",
        reviewHint:
            "m-0 max-w-full whitespace-nowrap font-sans text-[10px] font-medium leading-[1.5] text-[var(--fg-tertiary)]",
        previewTitle:
            "min-w-0 rounded-lg border border-border bg-[var(--bg-recessed)] px-2.5 py-2 font-display text-[15px] font-semibold leading-[1.4] text-[var(--fg-primary)]",
        reviewRow: "my-1.5 flex flex-col gap-1.5",
        reviewLine:
            "flex min-w-0 items-baseline gap-2 rounded-[8px] border border-border bg-[var(--bg-recessed)] px-2.5 py-2",
        reviewValue:
            "min-w-0 break-words font-sans text-[13px] font-semibold leading-[1.4]",
        reviewOld:
            "text-[var(--fg-secondary)] line-through decoration-muted-foreground",
        reviewNew: "text-[var(--fg-primary)]",
        spinner:
            "mx-auto mb-1.5 size-4 border-2 text-primary",
    },
    button: {
        close: "size-6 rounded-md border border-transparent bg-transparent p-0 text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground [&_svg:not([class*='size-'])]:size-3",
        action: "h-[26px] shrink-0 gap-[7px] rounded-[7px] border border-transparent bg-transparent px-[10px] font-sans text-[12px] font-semibold leading-normal text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] disabled:opacity-[0.55] has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[11px]",
        primaryAction:
            "h-[26px] shrink-0 gap-[7px] rounded-[7px] border border-border bg-[var(--glass-tint-base)] px-[10px] font-sans text-[12px] font-semibold leading-normal text-[var(--fg-primary)] shadow-xs backdrop-blur-[14px] backdrop-saturate-[140%] hover:bg-[var(--glass-tint-base)] hover:text-[var(--fg-primary)] disabled:opacity-[0.55] has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[11px]",
    },
    badge: {
        oldTag: "h-auto min-w-[56px] justify-start rounded-none border-transparent bg-transparent px-0 py-0 font-sans text-[10.5px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-[0.04em] shadow-none [a&]:hover:bg-transparent [a&]:hover:text-[var(--fg-tertiary)]",
        newTag: "h-auto min-w-[56px] justify-start rounded-none border-transparent bg-transparent px-0 py-0 font-sans text-[10.5px] font-semibold text-[var(--accent)] uppercase tracking-[0.04em] shadow-none [a&]:hover:bg-transparent [a&]:hover:text-[var(--accent)]",
    },
    alert: {
        root: "flex w-full items-start gap-3 px-1 py-2 font-sans text-sm [&_[data-slot=alert-icon]]:flex [&_[data-slot=alert-icon]]:size-7 [&_[data-slot=alert-icon]]:shrink-0 [&_[data-slot=alert-icon]]:items-center [&_[data-slot=alert-icon]]:justify-center [&_[data-slot=alert-icon]]:rounded-full [&_[data-slot=alert-icon]_svg]:size-[14px]",
        error: "flex-col items-center border-0 bg-transparent text-center text-[var(--fg-primary)] shadow-none *:data-[slot=alert-description]:text-[var(--fg-primary)] [&_[data-slot=alert-icon]]:bg-destructive/10 [&_[data-slot=alert-icon]]:text-destructive",
        unavailable:
            "flex-col items-center border-0 bg-transparent text-center text-[var(--fg-secondary)] shadow-none *:data-[slot=alert-description]:text-[var(--fg-secondary)] [&_[data-slot=alert-icon]]:bg-secondary [&_[data-slot=alert-icon]]:text-secondary-foreground",
        description:
            "grid min-w-0 gap-1 text-center [&_[data-slot=alert-message]]:m-0 [&_[data-slot=alert-message]]:break-words [&_[data-slot=alert-message]]:font-sans [&_[data-slot=alert-message]]:text-[12.5px] [&_[data-slot=alert-message]]:font-medium [&_[data-slot=alert-message]]:leading-[1.5] [&_[data-slot=alert-message]]:text-[var(--fg-secondary)] [&_[data-slot=alert-hint]]:m-0 [&_[data-slot=alert-hint]]:break-words [&_[data-slot=alert-hint]]:font-sans [&_[data-slot=alert-hint]]:text-[11.5px] [&_[data-slot=alert-hint]]:font-medium [&_[data-slot=alert-hint]]:leading-[1.5] [&_[data-slot=alert-hint]]:text-[var(--fg-tertiary)]",
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
    const titleId = useId();
    const descriptionId = useId();
    const isBusy = isApplying || isRegenerating;
    const canAct = state === "preview" || state === "review";
    const showRegenerate = Boolean(onRegenerate && regenerateLabel);
    const showCancel = Boolean(onCancel && cancelLabel);
    const showApply = Boolean(onApply && applyLabel);
    const isErrorState = state === "error" || state === "unavailable";
    const stateLabel = state === "review" ? "复核确认" : (bodyLabel ?? title);
    const reviewOldTitle = originalFilename?.trim() || "—";
    const reviewNewTitle = filename?.trim() || "—";
    const ErrorIcon = state === "unavailable" ? Ban : TriangleAlert;

    return (
        <Popover open modal={false}>
            <PopoverAnchor asChild>
                <span
                    className="inline-flex size-0"
                    data-sot-part="ai-rename-anchor"
                    aria-hidden="true"
                />
            </PopoverAnchor>
            <PopoverContent
                align="end"
                side="bottom"
                sideOffset={8}
                avoidCollisions={false}
                onOpenAutoFocus={(event) => event.preventDefault()}
                className={cn(aiRenamePreviewClassNames.card.root, className)}
                data-open="true"
                data-sot-panel="ai-rename-preview"
                data-sot-state={state}
                aria-labelledby={titleId}
                aria-describedby={subtitle ? descriptionId : undefined}
            >
                <CardHeader
                    className={aiRenamePreviewClassNames.card.header}
                    data-sot-part="head"
                >
                    <div data-slot="card-head-copy" data-sot-part="head-copy">
                        <CardTitle
                            id={titleId}
                            className={aiRenamePreviewClassNames.card.title}
                            data-sot-part="eyebrow"
                        >
                            {title}
                        </CardTitle>
                        <CardDescription
                            id={descriptionId}
                            className={
                                aiRenamePreviewClassNames.card.description
                            }
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
                                className={
                                    aiRenamePreviewClassNames.button.close
                                }
                                onClick={onCancel}
                                disabled={isApplying}
                                aria-label={closeLabel ?? cancelLabel}
                                title={closeLabel ?? cancelLabel}
                                data-sot-control="ai-rename-close"
                                data-sot-state={isApplying ? "busy" : state}
                            >
                                <X
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                />
                            </Button>
                        </CardAction>
                    ) : null}
                </CardHeader>

                <CardContent
                    className={cn(
                        aiRenamePreviewClassNames.card.content,
                        state === "loading" &&
                            aiRenamePreviewClassNames.card.loadingContent,
                        state === "error" &&
                            aiRenamePreviewClassNames.card.errorContent,
                        state === "unavailable" &&
                            aiRenamePreviewClassNames.card.unavailableContent,
                    )}
                    data-sot-part="body"
                    data-sot-state={state}
                >
                    {state === "loading" ? (
                        <div
                            className={aiRenamePreviewClassNames.state.root}
                            data-slot="card-state"
                            data-sot-part="state"
                            data-sot-state="loading"
                        >
                            <Spinner
                                className={
                                    aiRenamePreviewClassNames.state.spinner
                                }
                                data-sot-part="loading-spinner"
                                aria-hidden="true"
                            />
                            <p
                                className={
                                    aiRenamePreviewClassNames.state.message
                                }
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
                                    : aiRenamePreviewClassNames.alert
                                          .unavailable,
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
                                    className={
                                        aiRenamePreviewClassNames.state.message
                                    }
                                    data-slot="alert-message"
                                    data-sot-part="message"
                                >
                                    {message ?? title}
                                </p>
                                {hint ? (
                                    <p
                                        className={
                                            aiRenamePreviewClassNames.state.hint
                                        }
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
                            className={aiRenamePreviewClassNames.state.root}
                            data-slot="card-state"
                            data-sot-part="state"
                            data-sot-state={state}
                        >
                            <div
                                className={
                                    aiRenamePreviewClassNames.state.label
                                }
                                data-slot="card-state-label"
                                data-sot-part="label"
                            >
                                {stateLabel}
                            </div>
                            {state === "review" ? (
                                <div
                                    className={
                                        aiRenamePreviewClassNames.state
                                            .reviewRow
                                    }
                                    data-slot="card-review-row"
                                    data-sot-part="review-row"
                                >
                                    <div
                                        className={
                                            aiRenamePreviewClassNames.state
                                                .reviewLine
                                        }
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
                                            className={cn(
                                                aiRenamePreviewClassNames.state
                                                    .reviewValue,
                                                aiRenamePreviewClassNames.state
                                                    .reviewOld,
                                            )}
                                            data-slot="card-review-value"
                                            data-review-tone="old"
                                            data-sot-part="review-old"
                                            data-sot-review-value="old"
                                        >
                                            {reviewOldTitle}
                                        </span>
                                    </div>
                                    <div
                                        className={
                                            aiRenamePreviewClassNames.state
                                                .reviewLine
                                        }
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
                                            className={cn(
                                                aiRenamePreviewClassNames.state
                                                    .reviewValue,
                                                aiRenamePreviewClassNames.state
                                                    .reviewNew,
                                            )}
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
                                    className={
                                        aiRenamePreviewClassNames.state
                                            .previewTitle
                                    }
                                    data-slot="card-preview-title"
                                    data-sot-part="title"
                                >
                                    {filename}
                                </div>
                            ) : null}
                            {message ? (
                                <p
                                    className={
                                        state === "review"
                                            ? aiRenamePreviewClassNames.state
                                                  .reviewHint
                                            : aiRenamePreviewClassNames.state
                                                  .hint
                                    }
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
                        <Separator className="bg-[var(--card-popover-divider)]" />
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
                                    data-sot-state={
                                        isApplying ? "loading" : state
                                    }
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
            </PopoverContent>
        </Popover>
    );
}
