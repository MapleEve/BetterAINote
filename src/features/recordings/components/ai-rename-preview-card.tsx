"use client";

import {
    AlertCircle,
    Check,
    Loader2,
    RefreshCw,
    Sparkles,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiRenamePreviewCardProps {
    title: string;
    filename?: string | null;
    actionLabel?: string;
    actionHref?: string;
    actionTestId?: string;
    applyLabel?: string;
    cancelLabel?: string;
    isApplying: boolean;
    isRegenerating: boolean;
    message?: string | null;
    onAction?: () => void;
    onApply?: () => void;
    onCancel?: () => void;
    onRegenerate?: () => void;
    regenerateLabel?: string;
    state?: "loading" | "preview" | "review" | "error" | "unavailable";
    className?: string;
}

export function AiRenamePreviewCard({
    actionLabel,
    actionHref,
    actionTestId,
    applyLabel,
    cancelLabel,
    className,
    filename,
    isApplying,
    isRegenerating,
    message,
    onAction,
    onApply,
    onCancel,
    onRegenerate,
    regenerateLabel,
    state = "preview",
    title,
}: AiRenamePreviewCardProps) {
    const isBusy = isApplying || isRegenerating;
    const canAct = state === "preview" || state === "review";
    const showRetry =
        (state === "error" || canAct) &&
        Boolean(onRegenerate && regenerateLabel);
    const StatusIcon =
        state === "loading"
            ? Loader2
            : state === "error" || state === "unavailable"
              ? AlertCircle
              : Sparkles;

    return (
        <div
            className={cn(
                "rounded-2xl border p-3 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)] backdrop-blur-xl",
                state === "error"
                    ? "border-destructive/30 bg-destructive/10"
                    : state === "unavailable"
                      ? "border-amber-500/25 bg-amber-500/10"
                      : "border-primary/22 bg-primary/8",
                className,
            )}
            data-ai-rename-preview=""
            data-ai-rename-state={state}
            data-testid="ai-rename-preview-card"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p
                        className={cn(
                            "flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase",
                            state === "error"
                                ? "text-destructive"
                                : state === "unavailable"
                                  ? "text-amber-700 dark:text-amber-200"
                                  : "text-primary",
                        )}
                    >
                        <StatusIcon
                            className={cn(
                                "size-3.5",
                                state === "loading" && "animate-spin",
                            )}
                        />
                        <span>{title}</span>
                    </p>
                    {filename ? (
                        <p className="mt-1 truncate text-sm font-medium">
                            {filename}
                        </p>
                    ) : null}
                    {message ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                            {message}
                        </p>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    {showRetry ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onRegenerate}
                            disabled={isBusy}
                            aria-busy={isRegenerating}
                            aria-label={regenerateLabel}
                            title={regenerateLabel}
                            data-testid="ai-rename-regenerate"
                        >
                            {isRegenerating ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <RefreshCw className="size-3.5" />
                            )}
                        </Button>
                    ) : null}
                    {canAct && onCancel ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            disabled={isBusy}
                            aria-label={cancelLabel}
                            title={cancelLabel}
                            data-testid="ai-rename-cancel"
                        >
                            <X className="size-3.5" />
                        </Button>
                    ) : null}
                    {canAct && onApply ? (
                        <Button
                            type="button"
                            size="sm"
                            onClick={onApply}
                            disabled={isBusy}
                            aria-busy={isApplying}
                            aria-label={applyLabel}
                            title={applyLabel}
                            data-testid="ai-rename-apply"
                        >
                            {isApplying ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <Check className="size-3.5" />
                            )}
                        </Button>
                    ) : null}
                    {(onAction || actionHref) && actionLabel ? (
                        <Button
                            asChild={Boolean(actionHref)}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={actionHref ? undefined : onAction}
                            disabled={isBusy}
                            data-testid={
                                actionTestId ?? "ai-rename-card-action"
                            }
                        >
                            {actionHref ? (
                                <a href={actionHref}>{actionLabel}</a>
                            ) : (
                                actionLabel
                            )}
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
