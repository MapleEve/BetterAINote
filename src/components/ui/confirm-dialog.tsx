"use client";

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
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
    details?: string[];
    warning?: string;
}

const ConfirmDialogContext = createContext<{
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
} | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ConfirmDialogOptions | null>(null);
    const pendingResolveRef = useRef<((confirmed: boolean) => void) | null>(
        null,
    );

    const close = useCallback((confirmed: boolean) => {
        const resolve = pendingResolveRef.current;
        if (!resolve) return;
        pendingResolveRef.current = null;
        resolve(confirmed);
        setState(null);
    }, []);

    const confirm = useCallback((options: ConfirmDialogOptions) => {
        return new Promise<boolean>((resolve) => {
            pendingResolveRef.current?.(false);
            pendingResolveRef.current = resolve;
            setState(options);
        });
    }, []);

    const value = useMemo(() => ({ confirm }), [confirm]);

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
                    data-sot-panel="confirm-dialog"
                    className="sm:max-w-md"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <DialogTitle>{state?.title}</DialogTitle>
                        <DialogDescription>
                            {state?.description}
                        </DialogDescription>
                    </DialogHeader>
                    {state?.details?.length || state?.warning ? (
                        <div className="flex flex-col gap-3 text-sm">
                            {state.details?.length ? (
                                <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                                    {state.details.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            ) : null}
                            {state.warning ? (
                                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                                    {state.warning}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => close(false)}
                        >
                            {state?.cancelLabel}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
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
