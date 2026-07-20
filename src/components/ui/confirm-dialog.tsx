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
    surface?: "default" | "recording-retranscribe";
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

const CONFIRM_DIALOG_CONTENT_CLASS = "sm:max-w-[460px]";

const CONFIRM_DIALOG_RETRANSCRIBE_CONTENT_CLASS =
    "my-3 block overflow-hidden [border-color:var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] [box-shadow:0_22px_56px_rgb(0_0_0_/_0.5)]!";

const CONFIRM_DIALOG_RETRANSCRIBE_HEADER_CLASS =
    "block flex-row gap-[normal] px-5 pt-4 pb-1";

const CONFIRM_DIALOG_RETRANSCRIBE_TITLE_CLASS =
    "m-0 [font-family:var(--font-display)] ![font-size:16px] ![line-height:1.35] font-semibold tracking-[-0.012em] text-foreground";

const CONFIRM_DIALOG_RETRANSCRIBE_DESCRIPTION_CLASS =
    "m-0 block px-5 pt-2 pb-1 [font-family:var(--font-sans)] ![font-size:13px] ![line-height:1.55] font-medium text-muted-foreground";

const CONFIRM_DIALOG_RETRANSCRIBE_DETAILS_LIST_CLASS =
    "mt-1 mb-2 gap-1 pl-[18px] [font-family:var(--font-sans)] ![font-size:13px] ![line-height:1.55] font-medium [color:var(--fg-secondary)]";

const CONFIRM_DIALOG_RETRANSCRIBE_DETAIL_ITEM_CLASS =
    "flex items-center gap-1.5 [font-family:var(--font-sans)] ![font-size:12.5px] ![line-height:1.55] font-medium [color:var(--fg-secondary)]";

const CONFIRM_DIALOG_RETRANSCRIBE_FOOTER_CLASS =
    "flex-row border-t [border-color:var(--glass-border-soft)] bg-[color-mix(in_srgb,white_3%,transparent)] px-4 pt-3 pb-4";

const CONFIRM_DIALOG_RETRANSCRIBE_BUTTON_CLASS =
    "h-[26px] rounded-[7px] px-2.5 ![font-size:12px] font-semibold transition-none";

const CONFIRM_DIALOG_RETRANSCRIBE_CANCEL_BUTTON_CLASS =
    "border-transparent! bg-transparent [color:var(--fg-secondary)] [box-shadow:none]! focus-visible:[box-shadow:none]! focus-visible:!ring-0";

const CONFIRM_DIALOG_RETRANSCRIBE_CONFIRM_BUTTON_CLASS =
    "border [border-color:var(--button-destructive-border)]! [background:var(--button-destructive-bg)]! [color:var(--button-destructive-fg)]! [box-shadow:var(--button-destructive-shadow)]!";

const CONFIRM_DIALOG_HEADER_CLASS = "text-left";

const CONFIRM_DIALOG_BODY_CLASS = "flex flex-col gap-3";

const CONFIRM_DIALOG_EXTRA_CLASS = "flex flex-col gap-3";

const CONFIRM_DIALOG_DETAILS_LIST_CLASS = "flex list-disc flex-col gap-1 pl-5";

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
    const overlaySlotProps = slotProps?.overlay;
    const portalWrapperSlotProps = slotProps?.portalWrapper;
    const headerSlotProps = slotProps?.header;
    const titleSlotProps = {
        ...slotProps?.title,
        className: cn(
            state?.surface === "recording-retranscribe" &&
                CONFIRM_DIALOG_RETRANSCRIBE_TITLE_CLASS,
            slotProps?.title?.className,
        ),
    };
    const bodySlotProps = slotProps?.body;
    const descriptionSlotProps = {
        ...slotProps?.description,
        className: cn(
            state?.surface === "recording-retranscribe" &&
                CONFIRM_DIALOG_RETRANSCRIBE_DESCRIPTION_CLASS,
            slotProps?.description?.className,
        ),
    };
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
                    overlayProps={overlaySlotProps}
                    portalWrapperProps={portalWrapperSlotProps}
                    className={cn(
                        CONFIRM_DIALOG_CONTENT_CLASS,
                        state?.surface === "recording-retranscribe" &&
                            CONFIRM_DIALOG_RETRANSCRIBE_CONTENT_CLASS,
                        contentSlotProps?.className,
                    )}
                    showCloseButton={false}
                >
                    <DialogHeader
                        {...headerSlotProps}
                        className={cn(
                            "gap-2 text-left",
                            CONFIRM_DIALOG_HEADER_CLASS,
                            state?.surface === "recording-retranscribe" &&
                                CONFIRM_DIALOG_RETRANSCRIBE_HEADER_CLASS,
                            headerSlotProps?.className,
                        )}
                    >
                        <DialogTitle
                            {...titleSlotProps}
                            className={titleSlotProps?.className}
                        >
                            {state?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div
                        {...bodySlotProps}
                        className={cn(
                            CONFIRM_DIALOG_BODY_CLASS,
                            bodySlotProps?.className,
                        )}
                    >
                        <DialogDescription
                            {...descriptionSlotProps}
                            className={descriptionSlotProps?.className}
                        >
                            {state?.description}
                        </DialogDescription>
                        {state?.details?.length || state?.warning ? (
                            <div
                                {...extraSlotProps}
                                className={cn(
                                    CONFIRM_DIALOG_EXTRA_CLASS,
                                    extraSlotProps?.className,
                                )}
                            >
                                {state.details?.length ? (
                                    <ul
                                        {...detailsListSlotProps}
                                        className={cn(
                                            CONFIRM_DIALOG_DETAILS_LIST_CLASS,
                                            state?.surface ===
                                                "recording-retranscribe" &&
                                                CONFIRM_DIALOG_RETRANSCRIBE_DETAILS_LIST_CLASS,
                                            detailsListSlotProps?.className,
                                        )}
                                    >
                                        {state.details.map((item) => (
                                            <li
                                                {...detailItemSlotProps}
                                                className={cn(
                                                    state?.surface ===
                                                        "recording-retranscribe" &&
                                                        CONFIRM_DIALOG_RETRANSCRIBE_DETAIL_ITEM_CLASS,
                                                    detailItemSlotProps?.className,
                                                )}
                                                key={item}
                                            >
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                {state.warning ? (
                                    <p
                                        {...warningSlotProps}
                                        className={warningSlotProps?.className}
                                    >
                                        {state.warning}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter
                        {...footerSlotProps}
                        className={cn(
                            "gap-2 sm:justify-end",
                            state?.surface === "recording-retranscribe" &&
                                CONFIRM_DIALOG_RETRANSCRIBE_FOOTER_CLASS,
                            footerSlotProps?.className,
                        )}
                    >
                        <Button
                            {...cancelButtonSlotProps}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => close(false)}
                            className={cn(
                                state?.surface === "recording-retranscribe" &&
                                    CONFIRM_DIALOG_RETRANSCRIBE_BUTTON_CLASS,
                                state?.surface === "recording-retranscribe" &&
                                    CONFIRM_DIALOG_RETRANSCRIBE_CANCEL_BUTTON_CLASS,
                                cancelButtonSlotProps?.className,
                            )}
                        >
                            {state?.cancelLabel}
                        </Button>
                        <Button
                            {...confirmButtonSlotProps}
                            type="button"
                            variant={confirmButtonVariant}
                            size="sm"
                            onClick={() => close(true)}
                            className={cn(
                                state?.surface === "recording-retranscribe" &&
                                    CONFIRM_DIALOG_RETRANSCRIBE_BUTTON_CLASS,
                                state?.surface === "recording-retranscribe" &&
                                    CONFIRM_DIALOG_RETRANSCRIBE_CONFIRM_BUTTON_CLASS,
                                confirmButtonSlotProps?.className,
                            )}
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
