"use client";

import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiRenamePreviewCardProps {
    title: string;
    filename: string;
    applyLabel: string;
    cancelLabel: string;
    isApplying: boolean;
    isRegenerating: boolean;
    onApply: () => void;
    onCancel: () => void;
    onRegenerate: () => void;
    regenerateLabel: string;
    className?: string;
}

export function AiRenamePreviewCard({
    applyLabel,
    cancelLabel,
    className,
    filename,
    isApplying,
    isRegenerating,
    onApply,
    onCancel,
    onRegenerate,
    regenerateLabel,
    title,
}: AiRenamePreviewCardProps) {
    const isBusy = isApplying || isRegenerating;

    return (
        <div
            className={cn(
                "rounded-2xl border border-primary/22 bg-primary/8 p-3 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)] backdrop-blur-xl",
                className,
            )}
            data-ai-rename-preview=""
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
                        {title}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium">
                        {filename}
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRegenerate}
                        disabled={isBusy}
                        aria-busy={isRegenerating}
                        aria-label={regenerateLabel}
                        title={regenerateLabel}
                    >
                        {isRegenerating ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="size-3.5" />
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        disabled={isBusy}
                        aria-label={cancelLabel}
                        title={cancelLabel}
                    >
                        <X className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={onApply}
                        disabled={isBusy}
                        aria-busy={isApplying}
                        aria-label={applyLabel}
                        title={applyLabel}
                    >
                        {isApplying ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Check className="size-3.5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
