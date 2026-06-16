"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogContextValue {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue>({
    open: false,
});

export function Dialog({
    open = false,
    onOpenChange,
    children,
}: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}) {
    const value = React.useMemo(
        () => ({ open, onOpenChange }),
        [open, onOpenChange],
    );

    return (
        <DialogContext.Provider value={value}>
            {children}
        </DialogContext.Provider>
    );
}

export function DialogTrigger({
    onClick,
    ...props
}: React.ComponentProps<"button">) {
    const { onOpenChange } = React.useContext(DialogContext);

    return (
        <button
            data-slot="dialog-trigger"
            {...props}
            onClick={(event) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    onOpenChange?.(true);
                }
            }}
        />
    );
}

export function DialogClose({
    onClick,
    ...props
}: React.ComponentProps<"button">) {
    const { onOpenChange } = React.useContext(DialogContext);

    return (
        <button
            data-slot="dialog-close"
            {...props}
            onClick={(event) => {
                onClick?.(event);
                if (!event.defaultPrevented) {
                    onOpenChange?.(false);
                }
            }}
        />
    );
}

export function DialogHeader({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            className={cn(
                "flex flex-col gap-2 text-center sm:text-left",
                className,
            )}
            {...props}
        />
    );
}

export function DialogFooter({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                className,
            )}
            {...props}
        />
    );
}

export function DialogTitle({
    className,
    ...props
}: React.ComponentProps<"h2">) {
    return (
        <h2
            data-slot="dialog-title"
            className={cn("text-lg font-semibold leading-none", className)}
            {...props}
        />
    );
}

export function DialogDescription({
    className,
    ...props
}: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="dialog-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

type DialogContentProps = React.ComponentProps<"div"> & {
    showCloseButton?: boolean;
    onCloseAutoFocus?: (event: Event) => void;
    onEscapeKeyDown?: (event: KeyboardEvent) => void;
    onInteractOutside?: (event: Event) => void;
};

export function DialogContent({
    className,
    children,
    showCloseButton = true,
    onCloseAutoFocus,
    onEscapeKeyDown,
    onInteractOutside,
    ...props
}: DialogContentProps) {
    const { open, onOpenChange } = React.useContext(DialogContext);

    const requestClose = React.useCallback(() => {
        onOpenChange?.(false);
        const event = new Event("closeAutoFocus", { cancelable: true });
        onCloseAutoFocus?.(event);
    }, [onCloseAutoFocus, onOpenChange]);

    React.useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            if (
                target instanceof HTMLElement &&
                target.closest(
                    '[data-sot-panel="confirm-dialog"], .confirm-dialog',
                )
            ) {
                return;
            }

            if (event.key !== "Escape") return;
            onEscapeKeyDown?.(event);
            if (!event.defaultPrevented) {
                requestClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onEscapeKeyDown, open, requestClose]);

    if (!open) return null;

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: SOT scrim owns backdrop click dismissal.
        <div
            className="scrim"
            data-open="true"
            onMouseDown={(event) => {
                if (event.target !== event.currentTarget) return;
                onInteractOutside?.(event.nativeEvent);
                if (!event.nativeEvent.defaultPrevented) {
                    requestClose();
                }
            }}
        >
            <div
                data-slot="dialog-content"
                {...props}
                className={cn(className)}
                role="dialog"
                aria-modal="true"
            >
                {showCloseButton ? (
                    <DialogClose
                        className="icon-btn ghost-btn"
                        aria-label="关闭"
                        type="button"
                    >
                        <X />
                    </DialogClose>
                ) : null}
                {children}
            </div>
        </div>
    );
}
