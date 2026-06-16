"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { type ToastT, toast, useSonner } from "sonner";

const DEFAULT_TOAST_DURATION_MS = 2600;
const TOAST_EXIT_DURATION_MS = 240;

function resolveNode(node: ToastT["title"] | ToastT["description"]) {
    return typeof node === "function" ? node() : node;
}

function toastVariant(toastItem: ToastT) {
    if (toastItem.type === "error") {
        return "error";
    }
    if (toastItem.type === "info" || toastItem.type === "loading") {
        return "info";
    }
    return "success";
}

function toastClassName(variant: string) {
    if (variant === "error") {
        return "toast toast-err";
    }
    if (variant === "success") {
        return "toast toast-ok";
    }
    return "toast";
}

function ToastIcon({ variant }: { variant: string }) {
    if (variant === "error") {
        return (
            // biome-ignore lint/a11y/noSvgWithoutTitle: SOT toast icon is hidden by the parent .toast-ico wrapper.
            <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path key="mark" d="M12 9v4" />
                <path key="dot" d="M12 17h.01" />
                <circle key="ring" cx="12" cy="12" r="10" />
            </svg>
        );
    }

    if (variant === "info") {
        return (
            // biome-ignore lint/a11y/noSvgWithoutTitle: SOT toast icon is hidden by the parent .toast-ico wrapper.
            <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle key="ring" cx="12" cy="12" r="10" />
                <line key="mark" x1="12" y1="16" x2="12" y2="12" />
                <line key="dot" x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
        );
    }

    return (
        // biome-ignore lint/a11y/noSvgWithoutTitle: SOT toast icon is hidden by the parent .toast-ico wrapper.
        <svg viewBox="0 0 24 24">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function SotToast({
    isOpen,
    toastItem,
}: {
    isOpen: boolean;
    toastItem: ToastT;
}) {
    const variant = toastVariant(toastItem);
    const title = toastItem.jsx ?? resolveNode(toastItem.title);
    const description = resolveNode(toastItem.description);

    return (
        // biome-ignore lint/a11y/useSemanticElements: SOT runtime uses div.toast with role=status.
        <div
            className={toastClassName(variant)}
            role="status"
            data-open={isOpen ? "true" : "false"}
        >
            <span className="toast-ico" aria-hidden="true">
                <ToastIcon variant={variant} />
            </span>
            <span>
                {title as ReactNode}
                {description ? <> · {description as ReactNode}</> : null}
            </span>
        </div>
    );
}

export function Toaster() {
    const { toasts } = useSonner();
    const [closingIds, setClosingIds] = useState<Set<ToastT["id"]>>(
        () => new Set(),
    );
    const timers = useRef(
        new Map<ToastT["id"], ReturnType<typeof setTimeout>>(),
    );
    const removalTimers = useRef(
        new Map<ToastT["id"], ReturnType<typeof setTimeout>>(),
    );
    const signatures = useRef(new Map<ToastT["id"], string>());

    useEffect(() => {
        const activeIds = new Set(toasts.map((toastItem) => toastItem.id));
        for (const [id, timer] of timers.current) {
            if (!activeIds.has(id)) {
                clearTimeout(timer);
                timers.current.delete(id);
                signatures.current.delete(id);
            }
        }
        for (const [id, timer] of removalTimers.current) {
            if (!activeIds.has(id)) {
                clearTimeout(timer);
                removalTimers.current.delete(id);
            }
        }

        for (const toastItem of toasts) {
            const duration = toastItem.duration ?? DEFAULT_TOAST_DURATION_MS;
            if (toastItem.type === "loading" || duration === Infinity) {
                continue;
            }

            const signature = `${toastItem.type}:${String(
                resolveNode(toastItem.title),
            )}:${duration}`;
            if (signatures.current.get(toastItem.id) === signature) {
                continue;
            }

            const previousTimer = timers.current.get(toastItem.id);
            if (previousTimer) {
                clearTimeout(previousTimer);
            }
            const previousRemovalTimer = removalTimers.current.get(
                toastItem.id,
            );
            if (previousRemovalTimer) {
                clearTimeout(previousRemovalTimer);
                removalTimers.current.delete(toastItem.id);
            }
            setClosingIds((current) => {
                if (!current.has(toastItem.id)) {
                    return current;
                }
                const next = new Set(current);
                next.delete(toastItem.id);
                return next;
            });
            signatures.current.set(toastItem.id, signature);
            timers.current.set(
                toastItem.id,
                setTimeout(() => {
                    setClosingIds((current) => {
                        const next = new Set(current);
                        next.add(toastItem.id);
                        return next;
                    });
                    removalTimers.current.set(
                        toastItem.id,
                        setTimeout(() => {
                            toast.dismiss(toastItem.id);
                            removalTimers.current.delete(toastItem.id);
                            setClosingIds((current) => {
                                const next = new Set(current);
                                next.delete(toastItem.id);
                                return next;
                            });
                        }, TOAST_EXIT_DURATION_MS),
                    );
                }, duration),
            );
        }
    }, [toasts]);

    useEffect(() => {
        return () => {
            for (const timer of timers.current.values()) {
                clearTimeout(timer);
            }
            for (const timer of removalTimers.current.values()) {
                clearTimeout(timer);
            }
            timers.current.clear();
            removalTimers.current.clear();
            signatures.current.clear();
        };
    }, []);

    return (
        <div
            className="toast-stack"
            id="toast-stack"
            aria-live="polite"
            aria-atomic="true"
        >
            {toasts.map((toastItem) => (
                <SotToast
                    isOpen={!closingIds.has(toastItem.id)}
                    key={toastItem.id}
                    toastItem={toastItem}
                />
            ))}
        </div>
    );
}
