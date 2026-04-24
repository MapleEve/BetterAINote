"use client";

import { useState } from "react";
import { SettingsDialog } from "@/components/settings-dialog";
import {
    navigateBrowserRoute,
    useBrowserRouteController,
} from "@/lib/platform/browser-router";

export function SettingsPageContent() {
    const router = useBrowserRouteController();
    const [open, setOpen] = useState(true);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            navigateBrowserRoute(router, "/dashboard");
        }
    };

    return <SettingsDialog open={open} onOpenChange={handleOpenChange} />;
}
