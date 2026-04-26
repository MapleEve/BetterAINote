"use client";

import {
    createContext,
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

type ConfirmVariant = "default" | "destructive";

interface ConfirmDialogOptions {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    variant?: ConfirmVariant;
}

type ConfirmDialogState = ConfirmDialogOptions & {
    resolve: (confirmed: boolean) => void;
};

interface ConfirmDialogContextValue {
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(
    null,
);

export function ConfirmDialogProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [state, setState] = useState<ConfirmDialogState | null>(null);
    const resolvingRef = useRef(false);

    const close = useCallback(
        (confirmed: boolean) => {
            if (!state || resolvingRef.current) return;

            resolvingRef.current = true;
            state.resolve(confirmed);
            setState(null);
            window.setTimeout(() => {
                resolvingRef.current = false;
            }, 0);
        },
        [state],
    );

    const confirm = useCallback((options: ConfirmDialogOptions) => {
        return new Promise<boolean>((resolve) => {
            setState((current) => {
                current?.resolve(false);
                return {
                    ...options,
                    resolve,
                };
            });
        });
    }, []);

    const value = useMemo(() => ({ confirm }), [confirm]);
    const variant = state?.variant ?? "default";

    return (
        <ConfirmDialogContext.Provider value={value}>
            {children}
            <Dialog
                open={Boolean(state)}
                onOpenChange={(open) => {
                    if (!open) close(false);
                }}
            >
                <DialogContent
                    className="max-w-[min(92vw,28rem)] gap-5"
                    showCloseButton={false}
                >
                    {state ? (
                        <>
                            <DialogHeader className="gap-3">
                                <DialogTitle>{state.title}</DialogTitle>
                                <DialogDescription className="text-base leading-7 text-foreground/78">
                                    {state.description}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => close(false)}
                                >
                                    {state.cancelLabel}
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        variant === "destructive"
                                            ? "destructive"
                                            : "default"
                                    }
                                    onClick={() => close(true)}
                                >
                                    {state.confirmLabel}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
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
