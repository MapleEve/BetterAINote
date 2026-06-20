"use client";

import {
    type ComponentPropsWithoutRef,
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
import { cn } from "@/lib/utils";

interface ConfirmDialogOptions {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    confirmVariant?: "default" | "destructive";
    details?: string[];
    warning?: string;
}

type DataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

type SlotProps<T> = T & DataAttributes;

export interface ConfirmDialogSlotProps {
    content?: SlotProps<
        Omit<
            ComponentPropsWithoutRef<typeof DialogContent>,
            | "children"
            | "overlayProps"
            | "portalWrapperProps"
            | "showCloseButton"
        >
    >;
    overlay?: SlotProps<
        NonNullable<
            ComponentPropsWithoutRef<typeof DialogContent>["overlayProps"]
        >
    >;
    portalWrapper?: SlotProps<
        NonNullable<
            ComponentPropsWithoutRef<typeof DialogContent>["portalWrapperProps"]
        >
    >;
    header?: SlotProps<ComponentPropsWithoutRef<typeof DialogHeader>>;
    title?: SlotProps<ComponentPropsWithoutRef<typeof DialogTitle>>;
    body?: SlotProps<ComponentPropsWithoutRef<"div">>;
    description?: SlotProps<ComponentPropsWithoutRef<typeof DialogDescription>>;
    extra?: SlotProps<ComponentPropsWithoutRef<"div">>;
    detailsList?: SlotProps<ComponentPropsWithoutRef<"ul">>;
    detailItem?: SlotProps<ComponentPropsWithoutRef<"li">>;
    warning?: SlotProps<ComponentPropsWithoutRef<"p">>;
    footer?: SlotProps<ComponentPropsWithoutRef<typeof DialogFooter>>;
    cancelButton?: SlotProps<ComponentPropsWithoutRef<typeof Button>>;
    confirmButton?: SlotProps<ComponentPropsWithoutRef<typeof Button>>;
}

const ConfirmDialogContext = createContext<{
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
} | null>(null);

export function ConfirmDialogProvider({
    children,
    slotProps,
}: {
    children: ReactNode;
    slotProps?: ConfirmDialogSlotProps;
}) {
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
    const contentSlotProps = slotProps?.content;
    const headerSlotProps = slotProps?.header;
    const titleSlotProps = slotProps?.title;
    const bodySlotProps = slotProps?.body;
    const descriptionSlotProps = slotProps?.description;
    const extraSlotProps = slotProps?.extra;
    const detailsListSlotProps = slotProps?.detailsList;
    const detailItemSlotProps = slotProps?.detailItem;
    const warningSlotProps = slotProps?.warning;
    const footerSlotProps = slotProps?.footer;
    const cancelButtonSlotProps = slotProps?.cancelButton;
    const confirmButtonSlotProps = slotProps?.confirmButton;

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
                    {...contentSlotProps}
                    overlayProps={slotProps?.overlay}
                    portalWrapperProps={slotProps?.portalWrapper}
                    className={cn("sm:max-w-md", contentSlotProps?.className)}
                    showCloseButton={false}
                >
                    <DialogHeader
                        {...headerSlotProps}
                        className={cn(
                            "gap-2 text-left",
                            headerSlotProps?.className,
                        )}
                    >
                        <DialogTitle
                            {...titleSlotProps}
                            className={cn(
                                "m-0 text-base leading-snug font-semibold tracking-normal",
                                titleSlotProps?.className,
                            )}
                        >
                            {state?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div {...bodySlotProps}>
                        <DialogDescription
                            {...descriptionSlotProps}
                            className={cn(
                                "m-0 text-sm leading-relaxed text-muted-foreground",
                                descriptionSlotProps?.className,
                            )}
                        >
                            {state?.description}
                        </DialogDescription>
                        {state?.details?.length || state?.warning ? (
                            <div {...extraSlotProps}>
                                {state.details?.length ? (
                                    <ul {...detailsListSlotProps}>
                                        {state.details.map((item) => (
                                            <li
                                                {...detailItemSlotProps}
                                                key={item}
                                            >
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                {state.warning ? (
                                    <p {...warningSlotProps}>{state.warning}</p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter
                        {...footerSlotProps}
                        className={cn(
                            "gap-[8px] sm:justify-end",
                            footerSlotProps?.className,
                        )}
                    >
                        <Button
                            {...cancelButtonSlotProps}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => close(false)}
                        >
                            {state?.cancelLabel}
                        </Button>
                        <Button
                            {...confirmButtonSlotProps}
                            type="button"
                            variant={confirmButtonVariant}
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
