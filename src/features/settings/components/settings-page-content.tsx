"use client";

import { useState } from "react";
import {
    navigateBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";
import { SettingsDialog } from "./settings-dialog";

interface SettingsPageContentProps {
    user?: {
        email?: string | null;
        name?: string | null;
    };
}

export function SettingsPageContent({ user }: SettingsPageContentProps) {
    const router = useBrowserRouteController();
    const [open, setOpen] = useState(true);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            navigateBrowserRoute(router, "/dashboard");
        }
    };

    return (
        <SettingsDialog
            open={open}
            onOpenChange={handleOpenChange}
            user={user}
        />
    );
}
