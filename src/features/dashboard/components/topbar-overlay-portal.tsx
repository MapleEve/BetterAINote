"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const DESKTOP_BREAKPOINT_PX = 640;
const OVERLAY_EDGE_GAP_PX = 12;
const OVERLAY_TRIGGER_GAP_PX = 8;

type TopbarOverlayLayout = {
    style: CSSProperties;
};

interface TopbarOverlayPortalProps {
    anchorRef: RefObject<HTMLElement | null>;
    children: (layout: TopbarOverlayLayout) => ReactNode;
    maxWidthPx: number;
    open: boolean;
}

function getOverlayStyle(
    anchor: HTMLElement,
    maxWidthPx: number,
): CSSProperties {
    const rect = anchor.getBoundingClientRect();
    const top = Math.round(rect.bottom + OVERLAY_TRIGGER_GAP_PX);

    if (window.innerWidth < DESKTOP_BREAKPOINT_PX) {
        return {
            left: OVERLAY_EDGE_GAP_PX,
            right: OVERLAY_EDGE_GAP_PX,
            top,
        };
    }

    const width = Math.min(
        maxWidthPx,
        Math.max(0, window.innerWidth - OVERLAY_EDGE_GAP_PX * 2),
    );
    const right = Math.max(
        OVERLAY_EDGE_GAP_PX,
        Math.round(window.innerWidth - rect.right),
    );

    return {
        right,
        top,
        width,
    };
}

export function TopbarOverlayPortal({
    anchorRef,
    children,
    maxWidthPx,
    open,
}: TopbarOverlayPortalProps) {
    const [mounted, setMounted] = useState(false);
    const [style, setStyle] = useState<CSSProperties | null>(null);

    const updateStyle = useCallback(() => {
        const anchor = anchorRef.current;
        if (!anchor) {
            return;
        }

        setStyle(getOverlayStyle(anchor, maxWidthPx));
    }, [anchorRef, maxWidthPx]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open || !mounted) {
            return;
        }

        updateStyle();

        const anchor = anchorRef.current;
        const resizeObserver =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(updateStyle);

        if (anchor) {
            resizeObserver?.observe(anchor);
        }
        window.addEventListener("resize", updateStyle);
        window.addEventListener("scroll", updateStyle, true);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updateStyle);
            window.removeEventListener("scroll", updateStyle, true);
        };
    }, [anchorRef, mounted, open, updateStyle]);

    if (!open || !mounted || !style) {
        return null;
    }

    return createPortal(children({ style }), document.body);
}
