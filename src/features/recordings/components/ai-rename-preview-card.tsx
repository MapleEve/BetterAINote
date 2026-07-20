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
        root: "w-[min(360px,calc(100vw-32px))] gap-0 overflow-hidden rounded-xl border-[var(--card-popover-border)] bg-[var(--card-popover-bg)] p-0 [box-shadow:var(--card-popover-shadow)]",
        header: "grid-cols-[1fr_auto] items-start gap-x-2.5 gap-y-0.5 border-b border-[var(--card-popover-divider)] px-3.5 pt-3 !pb-[7px]",
        title: "break-words text-[11px] leading-normal font-semibold tracking-[0.02em] text-[var(--fg-secondary)]",
        content: "flex flex-col p-3.5",
        loadingContent: "min-h-20",
        errorContent: "min-h-22",
        unavailableContent: "min-h-32",
        footer: "min-h-12 gap-1.5 border-t border-[var(--card-popover-divider)] bg-[var(--card-popover-footer-bg)] px-3.5 py-2.5 !pt-2.5",
        description:
            "break-words text-[11px] leading-normal font-medium text-[var(--fg-tertiary)]",
        action: "shrink-0",
    },
    state: {
        root: "flex flex-col items-stretch gap-2",
        label: "text-[10.5px] leading-none font-semibold text-[var(--fg-tertiary)] uppercase tracking-[0.08em] [font-family:var(--font-mono)]",
        message:
            "m-0 break-words text-[12.5px] leading-[1.5] font-medium text-[var(--fg-secondary)]",
        hint: "m-0 max-w-full break-words text-[11.5px] leading-[1.5] font-medium text-[var(--fg-tertiary)] [text-wrap:pretty]",
        reviewHint:
            "m-0 max-w-full break-words text-[11px] leading-[1.5] font-medium text-[var(--fg-tertiary)] min-[390px]:whitespace-nowrap",
        previewTitle:
            "min-w-0 rounded-lg border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-2.5 py-2 text-[15px] leading-[1.4] font-semibold text-foreground",
        reviewRow: "mt-1.5 mb-0.5 flex flex-col gap-1.5",
        reviewLine:
            "flex min-w-0 items-baseline gap-2 rounded-lg border border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-2.5 py-[7px]",
        reviewValue:
            "min-w-0 break-words text-[13px] leading-[1.4] font-semibold",
        reviewOld:
            "text-muted-foreground line-through decoration-muted-foreground",
        reviewNew: "text-foreground",
        spinner: "text-primary",
    },
    button: {
        action: "shrink-0 text-[11.5px]",
        actionIcon: "size-[11px] shrink-0",
        apply: "border-border bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
    },
    badge: {
        tag: "min-w-14 justify-start rounded-none border-0 bg-transparent p-0 text-[10.5px] font-semibold uppercase tracking-[0.04em] shadow-none",
        old: "text-[var(--fg-tertiary)]",
        new: "!bg-transparent text-[var(--accent)]",
    },
    alert: {
        description: "grid min-w-0 justify-items-center gap-1",
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
                    className="absolute right-0 bottom-0 size-0"
                    aria-hidden="true"
                />
            </PopoverAnchor>
            <PopoverContent
                align="end"
                alignOffset={18}
                side="bottom"
                sideOffset={8}
                avoidCollisions={false}
                onOpenAutoFocus={(event) => event.preventDefault()}
                onEscapeKeyDown={(event) => {
                    if (!onCancel) {
                        return;
                    }

                    event.preventDefault();
                    onCancel();
                }}
                className={cn(aiRenamePreviewClassNames.card.root, className)}
                aria-labelledby={titleId}
                aria-describedby={subtitle ? descriptionId : undefined}
                data-control="ai-rename-preview"
                data-state={state}
            >
                <CardHeader className={aiRenamePreviewClassNames.card.header}>
                    <div>
                        <CardTitle
                            id={titleId}
                            className={aiRenamePreviewClassNames.card.title}
                        >
                            {title}
                        </CardTitle>
                        <CardDescription
                            id={descriptionId}
                            className={
                                aiRenamePreviewClassNames.card.description
                            }
                        >
                            {subtitle ?? ""}
                        </CardDescription>
                    </div>
                    {onCancel ? (
                        <CardAction
                            className={aiRenamePreviewClassNames.card.action}
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className={
                                    aiRenamePreviewClassNames.button.action
                                }
                                onClick={onCancel}
                                disabled={isApplying}
                                aria-label={closeLabel ?? cancelLabel}
                                title={closeLabel ?? cancelLabel}
                            >
                                <X
                                    className={
                                        aiRenamePreviewClassNames.button
                                            .actionIcon
                                    }
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
                >
                    {state === "loading" ? (
                        <div className={aiRenamePreviewClassNames.state.root}>
                            <Spinner
                                className={
                                    aiRenamePreviewClassNames.state.spinner
                                }
                                aria-hidden="true"
                            />
                            <p
                                className={
                                    aiRenamePreviewClassNames.state.message
                                }
                            >
                                {message ?? title}
                            </p>
                        </div>
                    ) : isErrorState ? (
                        <Alert
                            variant={
                                state === "error" ? "destructive" : "default"
                            }
                            density="spacious"
                            layout="centered"
                        >
                            <ErrorIcon aria-hidden="true" />
                            <AlertTitle className="sr-only">{title}</AlertTitle>
                            <AlertDescription
                                density="comfortable"
                                className={
                                    aiRenamePreviewClassNames.alert.description
                                }
                            >
                                <p
                                    className={
                                        aiRenamePreviewClassNames.state.message
                                    }
                                >
                                    {message ?? title}
                                </p>
                                {hint ? (
                                    <p
                                        className={
                                            aiRenamePreviewClassNames.state.hint
                                        }
                                    >
                                        {hint}
                                    </p>
                                ) : null}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className={aiRenamePreviewClassNames.state.root}>
                            <div
                                className={
                                    aiRenamePreviewClassNames.state.label
                                }
                            >
                                {stateLabel}
                            </div>
                            {state === "review" ? (
                                <div
                                    className={
                                        aiRenamePreviewClassNames.state
                                            .reviewRow
                                    }
                                >
                                    <div
                                        className={
                                            aiRenamePreviewClassNames.state
                                                .reviewLine
                                        }
                                    >
                                        <Badge
                                            variant="ghost"
                                            className={cn(
                                                aiRenamePreviewClassNames.badge
                                                    .tag,
                                                aiRenamePreviewClassNames.badge
                                                    .old,
                                            )}
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
                                        >
                                            {reviewOldTitle}
                                        </span>
                                    </div>
                                    <div
                                        className={
                                            aiRenamePreviewClassNames.state
                                                .reviewLine
                                        }
                                    >
                                        <Badge
                                            variant="ghost"
                                            className={cn(
                                                aiRenamePreviewClassNames.badge
                                                    .tag,
                                                aiRenamePreviewClassNames.badge
                                                    .new,
                                            )}
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
                                >
                                    {message}
                                </p>
                            ) : null}
                        </div>
                    )}
                </CardContent>

                {showRegenerate || showCancel || showApply ? (
                    <CardFooter
                        className={aiRenamePreviewClassNames.card.footer}
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
                            >
                                <RefreshCw
                                    className={
                                        aiRenamePreviewClassNames.button
                                            .actionIcon
                                    }
                                    aria-hidden="true"
                                />
                                {regenerateLabel}
                            </Button>
                        ) : null}
                        <span className="flex-1" />
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
                            >
                                {cancelLabel}
                            </Button>
                        ) : null}
                        {showApply ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className={cn(
                                    aiRenamePreviewClassNames.button.action,
                                    aiRenamePreviewClassNames.button.apply,
                                )}
                                onClick={onApply}
                                disabled={isBusy || !canAct}
                                aria-disabled={
                                    isBusy || !canAct ? "true" : "false"
                                }
                                aria-busy={isApplying}
                                aria-label={applyLabel}
                                title={applyLabel}
                            >
                                <Check
                                    className={
                                        aiRenamePreviewClassNames.button
                                            .actionIcon
                                    }
                                    aria-hidden="true"
                                />
                                {applyLabel}
                            </Button>
                        ) : null}
                    </CardFooter>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}
