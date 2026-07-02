"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type AvatarImageStatus = "idle" | "loading" | "loaded" | "error";

type AvatarContextValue = {
    imageStatus: AvatarImageStatus;
    setImageStatus: React.Dispatch<React.SetStateAction<AvatarImageStatus>>;
};

const AvatarContext = React.createContext<AvatarContextValue | null>(null);

function Avatar({
    className,
    size = "default",
    ...props
}: React.ComponentProps<"span"> & {
    size?: "default" | "sm" | "lg";
}) {
    const [imageStatus, setImageStatus] =
        React.useState<AvatarImageStatus>("idle");

    return (
        <AvatarContext.Provider value={{ imageStatus, setImageStatus }}>
            <span
                data-slot="avatar"
                data-size={size}
                className={cn(
                    "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
                    className,
                )}
                {...props}
            />
        </AvatarContext.Provider>
    );
}

function AvatarImage({
    className,
    onError,
    onLoad,
    src,
    style,
    ...props
}: React.ComponentProps<"img">) {
    const avatar = React.useContext(AvatarContext);
    const imageIsHidden = avatar ? avatar.imageStatus !== "loaded" : false;
    const setImageStatus = avatar?.setImageStatus;

    React.useEffect(() => {
        setImageStatus?.(src ? "loading" : "error");
    }, [setImageStatus, src]);

    return (
        <img
            data-slot="avatar-image"
            className={cn("aspect-square size-full", className)}
            src={src}
            style={{
                display: imageIsHidden ? "none" : undefined,
                ...style,
            }}
            onError={(event) => {
                setImageStatus?.("error");
                onError?.(event);
            }}
            onLoad={(event) => {
                setImageStatus?.("loaded");
                onLoad?.(event);
            }}
            {...props}
        />
    );
}

function AvatarFallback({
    className,
    delayMs,
    ...props
}: React.ComponentProps<"span"> & { delayMs?: number }) {
    const avatar = React.useContext(AvatarContext);
    const [canRender, setCanRender] = React.useState(delayMs === undefined);

    React.useEffect(() => {
        if (delayMs === undefined) {
            setCanRender(true);
            return;
        }

        setCanRender(false);
        const timer = window.setTimeout(() => setCanRender(true), delayMs);

        return () => window.clearTimeout(timer);
    }, [delayMs]);

    if (avatar?.imageStatus === "loaded" || !canRender) {
        return null;
    }

    return (
        <span
            data-slot="avatar-fallback"
            className={cn(
                "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
                className,
            )}
            {...props}
        />
    );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="avatar-badge"
            className={cn(
                "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none",
                "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
                "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
                "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
                className,
            )}
            {...props}
        />
    );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="avatar-group"
            className={cn(
                "group/avatar-group flex [&>*+*]:-ml-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
                className,
            )}
            {...props}
        />
    );
}

function AvatarGroupCount({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="avatar-group-count"
            className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
                className,
            )}
            {...props}
        />
    );
}

export {
    Avatar,
    AvatarImage,
    AvatarFallback,
    AvatarBadge,
    AvatarGroup,
    AvatarGroupCount,
};
