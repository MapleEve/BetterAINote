"use client";

import { AppRouteShell } from "@/components/app-route-shell";
import { AppThemeToggle } from "@/features/settings/components/app-theme-toggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppRouteShell ThemeAction={AppThemeToggle}>{children}</AppRouteShell>
    );
}
