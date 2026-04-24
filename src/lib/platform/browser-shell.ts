"use client";

import { getRuntimeOrigin, hasBrowserWindow } from "@/lib/platform/runtime";

export function getBrowserOrigin(fallback = "http://localhost:3001"): string {
    return getRuntimeOrigin(fallback);
}

export function resolveBrowserUrl(
    value: string,
    fallbackOrigin = "http://localhost:3001",
): string {
    return new URL(value, getBrowserOrigin(fallbackOrigin)).toString();
}

export function readBrowserHash(): string {
    if (!hasBrowserWindow()) {
        return "";
    }

    return window.location.hash.slice(1);
}

export function writeBrowserHash(nextHash: string) {
    if (!hasBrowserWindow()) {
        return;
    }

    window.location.hash = nextHash;
}

export function reloadBrowserWindow() {
    if (!hasBrowserWindow()) {
        return;
    }

    window.location.reload();
}

export function readBrowserStorage(key: string): string | null {
    if (!hasBrowserWindow()) {
        return null;
    }

    return window.localStorage.getItem(key);
}

export function writeBrowserStorage(key: string, value: string) {
    if (!hasBrowserWindow()) {
        return;
    }

    window.localStorage.setItem(key, value);
}

export function writeBrowserDocumentLanguage(language: string) {
    if (!hasBrowserWindow()) {
        return;
    }

    document.documentElement.lang = language;
}

export type BrowserIntervalHandle = number | null;
export type BrowserTimeoutHandle = number | null;

export function startBrowserInterval(
    callback: () => void,
    delayMs: number,
): BrowserIntervalHandle {
    if (!hasBrowserWindow()) {
        return null;
    }

    return window.setInterval(callback, delayMs);
}

export function stopBrowserInterval(intervalHandle: BrowserIntervalHandle) {
    if (!hasBrowserWindow() || intervalHandle === null) {
        return;
    }

    window.clearInterval(intervalHandle);
}

export function startBrowserTimeout(
    callback: () => void,
    delayMs: number,
): BrowserTimeoutHandle {
    if (!hasBrowserWindow()) {
        return null;
    }

    return window.setTimeout(callback, delayMs);
}

export function stopBrowserTimeout(timeoutHandle: BrowserTimeoutHandle) {
    if (!hasBrowserWindow() || timeoutHandle === null) {
        return;
    }

    window.clearTimeout(timeoutHandle);
}

export function addBrowserWindowEventListener<K extends keyof WindowEventMap>(
    eventName: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
) {
    if (!hasBrowserWindow()) {
        return;
    }

    window.addEventListener(eventName, listener as EventListener, options);
}

export function subscribeToBrowserWindowEvent<K extends keyof WindowEventMap>(
    eventName: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
) {
    addBrowserWindowEventListener(eventName, listener, options);

    return () => removeBrowserWindowEventListener(eventName, listener, options);
}

export function removeBrowserWindowEventListener<
    K extends keyof WindowEventMap,
>(
    eventName: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
) {
    if (!hasBrowserWindow()) {
        return;
    }

    window.removeEventListener(eventName, listener as EventListener, options);
}

export function isEditableBrowserEventTarget(
    target: EventTarget | null,
): target is HTMLElement {
    if (!hasBrowserWindow() || typeof HTMLElement === "undefined") {
        return false;
    }

    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
    );
}

export function syncBrowserAudioElementSource(
    audio: HTMLAudioElement,
    nextSrc: string,
) {
    if (!nextSrc) {
        audio.removeAttribute("src");
        audio.load();
        return;
    }

    const resolvedSrc = resolveBrowserUrl(nextSrc);
    if (audio.src === resolvedSrc) {
        return;
    }

    audio.src = nextSrc;
    audio.load();
}

export function confirmInBrowser(message: string): boolean {
    if (!hasBrowserWindow()) {
        return false;
    }

    return window.confirm(message);
}
