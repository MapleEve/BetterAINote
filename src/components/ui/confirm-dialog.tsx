"use client";

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogOptions {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    confirmVariant?: "default" | "destructive";
    details?: string[];
    warning?: string;
}

const ConfirmDialogContext = createContext<{
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
} | null>(null);

const confirmDialogPortalWrapperProps = {
    "data-sot-panel": "confirm-dialog",
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ConfirmDialogOptions | null>(null);
    const pendingResolveRef = useRef<((confirmed: boolean) => void) | null>(
        null,
    );
    const returnFocusRef = useRef<HTMLElement | null>(null);

    const close = useCallback((confirmed: boolean) => {
        const resolve = pendingResolveRef.current;
        if (!resolve) return;
        pendingResolveRef.current = null;
        setState(null);
        resolve(confirmed);
        const returnFocusTarget = returnFocusRef.current;
        returnFocusRef.current = null;
        if (!returnFocusTarget) return;

        const restoreFocus = () => {
            if (
                document.contains(returnFocusTarget) &&
                !returnFocusTarget.hasAttribute("disabled") &&
                returnFocusTarget.getAttribute("aria-disabled") !== "true"
            ) {
                returnFocusTarget.focus({ preventScroll: true });
            }
        };
        window.requestAnimationFrame(restoreFocus);
        window.setTimeout(restoreFocus, 50);
        window.setTimeout(restoreFocus, 250);
    }, []);

    const confirm = useCallback((options: ConfirmDialogOptions) => {
        return new Promise<boolean>((resolve) => {
            pendingResolveRef.current?.(false);
            pendingResolveRef.current = resolve;
            returnFocusRef.current =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;
            setState(options);
        });
    }, []);

    const value = useMemo(() => ({ confirm }), [confirm]);
    const confirmButtonVariant = state?.confirmVariant ?? "destructive";

    useEffect(() => {
        if (!state) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            close(false);
        };

        window.addEventListener("keydown", handleEscape, true);

        return () => {
            window.removeEventListener("keydown", handleEscape, true);
        };
    }, [close, state]);

    return (
        <ConfirmDialogContext.Provider value={value}>
            {children}
            <Dialog
                open={Boolean(state)}
                onOpenChange={(open) => {
                    if (!open) {
                        close(false);
                    }
                }}
            >
                <DialogContent
                    data-sot-content="confirm-dialog"
                    overlayProps={{ "data-sot-overlay": "confirm-dialog" }}
                    portalWrapperProps={confirmDialogPortalWrapperProps}
                    className="sm:max-w-md"
                    showCloseButton={false}
                >
                    <DialogHeader data-sot-part="confirm-head">
                        <DialogTitle data-sot-part="confirm-title">
                            {state?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div data-sot-part="confirm-body">
                        <DialogDescription data-sot-part="confirm-description">
                            {state?.description}
                        </DialogDescription>
                        {state?.details?.length || state?.warning ? (
                            <div data-sot-part="confirm-extra">
                                {state.details?.length ? (
                                    <ul data-sot-list="confirm-dialog-details">
                                        {state.details.map((item) => (
                                            <li
                                                key={item}
                                                data-sot-item="confirm-dialog-detail"
                                            >
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                {state.warning ? (
                                    <p data-sot-part="confirm-warning">
                                        {state.warning}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter data-sot-part="confirm-foot">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="sm:min-w-20"
                            onClick={() => close(false)}
                        >
                            {state?.cancelLabel}
                        </Button>
                        <Button
                            type="button"
                            variant={confirmButtonVariant}
                            size="sm"
                            className="sm:min-w-20"
                            onClick={() => close(true)}
                        >
                            {state?.confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ConfirmDialogContext.Provider>
    );
}

export function useConfirmDialog() {
    const context = useContext(ConfirmDialogContext);
    if (!context) {
        throw new Error(
            "useConfirmDialog must be used inside ConfirmDialogProvider",
        );
    }
    return context.confirm;
}
