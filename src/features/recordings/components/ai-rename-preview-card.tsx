"use client";

import { Ban, Check, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useId } from "react";
import { useLanguage } from "@/components/language-provider";
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
    const { t } = useLanguage();
    const titleId = useId();
    const descriptionId = useId();
    const isBusy = isApplying || isRegenerating;
    const canAct = state === "preview" || state === "review";
    const showRegenerate = Boolean(onRegenerate && regenerateLabel);
    const showCancel = Boolean(onCancel && cancelLabel);
    const showApply = Boolean(onApply && applyLabel);
    const isErrorState = state === "error" || state === "unavailable";
    const stateLabel =
        state === "review"
            ? t("recordingDetail.ai.reviewState")
            : (bodyLabel ?? title);
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
                className={cn(
                    "w-[min(360px,calc(100vw-32px))] gap-0 overflow-hidden rounded-xl border-border bg-card p-0 [box-shadow:var(--card-popover-shadow)]",
                    className,
                )}
                aria-labelledby={titleId}
                aria-describedby={subtitle ? descriptionId : undefined}
                data-control="ai-rename-preview"
                data-state={state}
            >
                <CardHeader className="grid-cols-[1fr_auto] items-start gap-x-2.5 gap-y-0.5 border-b border-border px-3.5 pt-3 !pb-[7px]">
                    <div>
                        <CardTitle
                            id={titleId}
                            className="break-words text-[11px] leading-normal font-semibold tracking-[0.02em] text-muted-foreground"
                        >
                            {title}
                        </CardTitle>
                        <CardDescription
                            id={descriptionId}
                            className="break-words text-[11px] leading-normal font-medium text-muted-foreground"
                        >
                            {subtitle ?? ""}
                        </CardDescription>
                    </div>
                    {onCancel ? (
                        <CardAction className="shrink-0">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="shrink-0 text-[11.5px]"
                                onClick={onCancel}
                                disabled={isApplying}
                                aria-label={closeLabel ?? cancelLabel}
                                title={closeLabel ?? cancelLabel}
                            >
                                <X
                                    className="size-[11px] shrink-0"
                                    aria-hidden="true"
                                />
                            </Button>
                        </CardAction>
                    ) : null}
                </CardHeader>

                <CardContent
                    className={cn(
                        "flex flex-col p-3.5",
                        state === "loading" && "min-h-20",
                        state === "error" && "min-h-22",
                        state === "unavailable" && "min-h-32",
                    )}
                >
                    {state === "loading" ? (
                        <div className="flex flex-col items-stretch gap-2">
                            <Spinner
                                className="text-primary"
                                aria-hidden="true"
                            />
                            <p className="m-0 break-words text-[12.5px] leading-[1.5] font-medium text-muted-foreground">
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
                                className="grid min-w-0 justify-items-center gap-1"
                            >
                                <p className="m-0 break-words text-[12.5px] leading-[1.5] font-medium text-muted-foreground">
                                    {message ?? title}
                                </p>
                                {hint ? (
                                    <p className="m-0 max-w-full break-words text-pretty text-[11.5px] leading-[1.5] font-medium text-muted-foreground">
                                        {hint}
                                    </p>
                                ) : null}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="flex flex-col items-stretch gap-2">
                            <div className="font-mono text-[10.5px] leading-none font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                {stateLabel}
                            </div>
                            {state === "review" ? (
                                <div className="mt-1.5 mb-0.5 flex flex-col gap-1.5">
                                    <div className="flex min-w-0 items-baseline gap-2 rounded-lg border border-border bg-muted px-2.5 py-[7px]">
                                        <Badge
                                            variant="ghost"
                                            className="min-w-14 justify-start rounded-none border-0 bg-transparent p-0 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.04em] shadow-none"
                                        >
                                            {t(
                                                "recordingDetail.ai.originalTitle",
                                            )}
                                        </Badge>
                                        <span className="min-w-0 break-words text-[13px] leading-[1.4] font-semibold text-muted-foreground line-through decoration-muted-foreground">
                                            {reviewOldTitle}
                                        </span>
                                    </div>
                                    <div className="flex min-w-0 items-baseline gap-2 rounded-lg border border-border bg-muted px-2.5 py-[7px]">
                                        <Badge
                                            variant="ghost"
                                            className="min-w-14 justify-start rounded-none border-0 bg-transparent p-0 text-[10.5px] font-semibold text-primary uppercase tracking-[0.04em] shadow-none"
                                        >
                                            {t("recordingDetail.ai.newTitle")}
                                        </Badge>
                                        <span className="min-w-0 break-words text-[13px] leading-[1.4] font-semibold text-foreground">
                                            {reviewNewTitle}
                                        </span>
                                    </div>
                                </div>
                            ) : filename ? (
                                <div className="min-w-0 rounded-lg border border-border bg-muted px-2.5 py-2 text-[15px] leading-[1.4] font-semibold text-foreground">
                                    {filename}
                                </div>
                            ) : null}
                            {message ? (
                                <p
                                    className={
                                        state === "review"
                                            ? "m-0 max-w-full break-words text-[11px] leading-[1.5] font-medium text-muted-foreground min-[390px]:whitespace-nowrap"
                                            : "m-0 max-w-full break-words text-pretty text-[11.5px] leading-[1.5] font-medium text-muted-foreground"
                                    }
                                >
                                    {message}
                                </p>
                            ) : null}
                        </div>
                    )}
                </CardContent>

                {showRegenerate || showCancel || showApply ? (
                    <CardFooter className="min-h-12 gap-1.5 border-t border-border bg-muted px-3.5 py-2.5 !pt-2.5">
                        {showRegenerate ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className="shrink-0 text-[11.5px]"
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
                                    className="size-[11px] shrink-0"
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
                                className="shrink-0 text-[11.5px]"
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
                                className="shrink-0 text-[11.5px]"
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
                                    className="size-[11px] shrink-0"
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
