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
        root: "w-[min(360px,calc(100vw-32px))] gap-0 overflow-hidden p-0 data-[open=true]:pointer-events-auto [&_[data-sot-part=state][hidden]]:!hidden",
        header: "min-h-14 grid-cols-[1fr_auto] items-start gap-x-2.5 gap-y-1 border-b px-3.5 py-3 [&_[data-slot=card-head-copy]]:min-w-0",
        title: "break-words text-xs text-muted-foreground uppercase tracking-wide",
        content: "flex flex-col px-3.5 py-3",
        loadingContent: "min-h-20",
        errorContent: "min-h-22",
        unavailableContent: "min-h-32",
        footer: "min-h-12 gap-1.5 border-t px-3.5 py-2",
        description: "break-words text-xs",
        action: "shrink-0",
    },
    state: {
        root: "flex flex-col items-stretch gap-2",
        label: "font-mono text-xs font-semibold leading-none text-muted-foreground uppercase tracking-wide",
        message:
            "m-0 break-words text-sm font-medium leading-relaxed text-muted-foreground",
        hint: "m-0 max-w-full break-words text-xs font-medium leading-relaxed text-muted-foreground [text-wrap:pretty]",
        reviewHint:
            "m-0 max-w-full whitespace-nowrap text-xs font-medium leading-relaxed text-muted-foreground",
        previewTitle:
            "min-w-0 rounded-lg border bg-muted px-2.5 py-2 text-sm font-semibold leading-relaxed text-foreground",
        reviewRow: "my-1.5 flex flex-col gap-1.5",
        reviewLine:
            "flex min-w-0 items-baseline gap-2 rounded-lg border bg-muted px-2.5 py-2",
        reviewValue:
            "min-w-0 break-words text-sm font-semibold leading-relaxed",
        reviewOld:
            "text-muted-foreground line-through decoration-muted-foreground",
        reviewNew: "text-foreground",
        spinner: "text-primary",
    },
    button: {
        action: "shrink-0",
    },
    badge: {
        tag: "min-w-14 justify-start",
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
                                    aiRenamePreviewClassNames.button.action
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
                            variant={
                                state === "error" ? "destructive" : "default"
                            }
                            density="spacious"
                            layout="centered"
                            data-sot-part="state"
                            data-sot-state={state}
                        >
                            <ErrorIcon
                                data-sot-part="error-icon"
                                aria-hidden="true"
                            />
                            <AlertTitle className="sr-only">{title}</AlertTitle>
                            <AlertDescription
                                density="comfortable"
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
                                                    .tag
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
                                                    .tag
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
                        <Separator />
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
                                    variant="default"
                                    size="xs"
                                    className={
                                        aiRenamePreviewClassNames.button.action
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
