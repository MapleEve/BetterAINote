"use client";

import { useRouter } from "next/navigation";

export interface BrowserRouteController {
    push(href: string): void;
    replace(href: string): void;
    refresh(): void;
    back(): void;
}

export function useBrowserRouteController(): BrowserRouteController {
    return useRouter();
}

export function navigateBrowserRoute(
    controller: Pick<BrowserRouteController, "push">,
    href: string,
) {
    controller.push(href);
}

export function refreshBrowserRoute(
    controller: Pick<BrowserRouteController, "refresh">,
) {
    controller.refresh();
}

export function navigateAndRefreshBrowserRoute(
    controller: Pick<BrowserRouteController, "push" | "refresh">,
    href: string,
) {
    navigateBrowserRoute(controller, href);
    refreshBrowserRoute(controller);
}

export function goBackBrowserRoute(
    controller: Pick<BrowserRouteController, "back">,
) {
    controller.back();
}
