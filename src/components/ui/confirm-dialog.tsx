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

const CONFIRM_DIALOG_PANEL_CLASS = "z-[calc(var(--z-modal)+2)]";

const CONFIRM_DIALOG_OVERLAY_CLASS =
    "m-0 h-auto max-h-none w-auto max-w-none border-0 bg-[var(--modal-scrim-bg)] p-0 backdrop-blur-[6px] backdrop-saturate-[120%] transition-opacity duration-[220ms] ease-[var(--ease-out)] data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100";

const CONFIRM_DIALOG_CONTENT_CLASS =
    "m-[12px_auto] block w-full max-w-[460px] gap-0 overflow-hidden rounded-lg border border-[var(--line-hairline)] bg-[var(--bg-elevated)] p-0 font-sans text-[var(--fg-primary)] shadow-[var(--shadow-md)] data-[state=closed]:opacity-0 sm:max-w-[460px]";

const CONFIRM_DIALOG_HEADER_CLASS = "block flex-row gap-0 px-5 pt-4 pb-1";

const CONFIRM_DIALOG_TITLE_CLASS =
    "font-display text-[16px] leading-[1.35] tracking-[-0.012em] text-[var(--fg-primary)]";

const CONFIRM_DIALOG_BODY_CLASS =
    "block px-5 pt-2 pb-1 font-sans text-[13px] leading-[1.55] font-medium text-[var(--fg-secondary)]";

const CONFIRM_DIALOG_DESCRIPTION_CLASS = "mb-2";

const CONFIRM_DIALOG_EXTRA_CLASS = "flex flex-col gap-3";

const CONFIRM_DIALOG_DETAILS_LIST_CLASS =
    "mt-1 mb-2 flex list-disc flex-col gap-1 pl-[18px]";

const CONFIRM_DIALOG_DETAIL_ITEM_CLASS =
    "flex items-center gap-1.5 font-sans text-[12.5px] leading-[1.55] font-medium text-[var(--fg-secondary)]";

const CONFIRM_DIALOG_WARNING_CLASS =
    "rounded-md border border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] px-3 py-2 text-[var(--signal-danger)]";

const CONFIRM_DIALOG_FOOTER_CLASS =
    "flex justify-end border-t border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-4 pt-3 pb-4";

const CONFIRM_DIALOG_ACTION_BUTTON_CLASS =
    "h-[26px] min-w-[auto] gap-[7px] rounded-[7px]";

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
                    overlayProps={{
                        ...overlaySlotProps,
                        className: cn(
                            CONFIRM_DIALOG_OVERLAY_CLASS,
                            overlaySlotProps?.className,
                        ),
                    }}
                    portalWrapperProps={{
                        ...portalWrapperSlotProps,
                        className: cn(
                            CONFIRM_DIALOG_PANEL_CLASS,
                            portalWrapperSlotProps?.className,
                        ),
                    }}
                    className={cn(
                        CONFIRM_DIALOG_CONTENT_CLASS,
                        contentSlotProps?.className,
                    )}
                    showCloseButton={false}
                >
                    <DialogHeader
                        {...headerSlotProps}
                        className={cn(
                            "gap-2 text-left",
                            CONFIRM_DIALOG_HEADER_CLASS,
                            headerSlotProps?.className,
                        )}
                    >
                        <DialogTitle
                            {...titleSlotProps}
                            className={cn(
                                "m-0 text-base leading-snug font-semibold tracking-normal",
                                CONFIRM_DIALOG_TITLE_CLASS,
                                titleSlotProps?.className,
                            )}
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
                            className={cn(
                                "m-0 text-sm leading-relaxed text-muted-foreground",
                                CONFIRM_DIALOG_DESCRIPTION_CLASS,
                                descriptionSlotProps?.className,
                            )}
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
                                            detailsListSlotProps?.className,
                                        )}
                                    >
                                        {state.details.map((item) => (
                                            <li
                                                {...detailItemSlotProps}
                                                className={cn(
                                                    CONFIRM_DIALOG_DETAIL_ITEM_CLASS,
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
                                        className={cn(
                                            CONFIRM_DIALOG_WARNING_CLASS,
                                            warningSlotProps?.className,
                                        )}
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
                            "gap-[8px] sm:justify-end",
                            CONFIRM_DIALOG_FOOTER_CLASS,
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
                                CONFIRM_DIALOG_ACTION_BUTTON_CLASS,
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
                                CONFIRM_DIALOG_ACTION_BUTTON_CLASS,
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
