import { createCipheriv, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
} from "./helpers/sot-fixtures";

function resolveActivityE2ERoot() {
    const activityRoot = process.env.BETTERAINOTE_E2E_ROOT?.trim();
    const playwrightRoot = process.env.PLAYWRIGHT_E2E_ROOT?.trim();

    if (
        activityRoot &&
        playwrightRoot &&
        path.resolve(activityRoot) !== path.resolve(playwrightRoot)
    ) {
        throw new Error(
            "BETTERAINOTE_E2E_ROOT must match PLAYWRIGHT_E2E_ROOT for Activity E2E",
        );
    }

    return path.resolve(
        activityRoot ?? playwrightRoot ?? path.join(process.cwd(), "tmp/e2e"),
    );
}

const E2E_ROOT_DIR = resolveActivityE2ERoot();
const E2E_DATA_DIR = path.join(E2E_ROOT_DIR, "data");
const ACTIVITY_RECORDING_ID = "e2e-activity-transcription";
const ACTIVITY_BACKGROUND_RECORDING_ID = "e2e-activity-background";
const ACTIVITY_JOB_ID = "e2e-activity-transcription-job";
const ACTIVITY_IFLYREC_SOURCE_CONNECTION_ID = "e2e-activity-iflyrec-source";
const ACTIVITY_IFLYREC_SESSION_ID = "e2e-activity-session";
const E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const IFLYREC_RECENT_OPERATIONS_PATH =
    "/XFTJWebAdaptService/v2/hjProcess/recentOperationFiles";
const ACTIVITY_TRIGGER_SOT_STATES = [
    "unread-0",
    "unread-3",
    "unread-99",
] as const;
const ACTIVITY_PANEL_SOT_STATES = [
    "idle",
    "syncing",
    "worker-down",
    "queued",
    "partial-failed",
] as const;

type ActivityTriggerSotState = (typeof ACTIVITY_TRIGGER_SOT_STATES)[number];
type ActivityPanelSotState = (typeof ACTIVITY_PANEL_SOT_STATES)[number];
type ActivitySotFixtureKind = "panel" | "trigger";

const ACTIVITY_TRIGGER_SELECTORS: Record<ActivityTriggerSotState, string> = {
    "unread-0": '#activity .notif-trigger[data-unread="0"]',
    "unread-3": '#activity .notif-trigger[data-unread="3"]',
    "unread-99": '#activity .notif-trigger[data-unread="99"]',
};

const ACTIVITY_PANEL_CARD_LABELS: Record<ActivityPanelSotState, string> = {
    idle: "Panel · idle sync",
    syncing: "Panel · syncing",
    "worker-down": "Worker down",
    queued: "Queued tasks",
    "partial-failed": "Partial-failed sync",
};

const ACTIVITY_FIXTURE_CSS = String.raw`
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-trigger {
    position: relative;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--fg-secondary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .icon-btn svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.8;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .btn {
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--line-hairline);
    border-radius: 9px;
    background: var(--bg-elevated);
    color: var(--fg-primary);
    cursor: pointer;
    box-shadow: var(--shadow-xs);
    font: 600 12.5px var(--font-sans);
    display: inline-flex;
    align-items: center;
    gap: 7px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .btn.ghost {
    border-color: transparent;
    background: transparent;
    color: var(--fg-secondary);
    box-shadow: none;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .btn.btn-sm {
    height: 26px;
    padding: 0 10px;
    border-radius: 7px;
    font-size: 12px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .btn[disabled],
__ACTIVITY_SCOPE__ .activity-pixel-stage .btn[aria-disabled="true"] {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .btn[aria-busy="true"] {
    pointer-events: none;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .btn svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.8;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-close {
    width: 26px;
    height: 26px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-close svg {
    width: 12px;
    height: 12px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    display: inline-flex;
    pointer-events: none;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-trigger[data-unread="0"] .notif-badge {
    display: none;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: var(--z-dropdown);
    overflow: hidden;
    pointer-events: none;
    display: flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-panel[data-open="true"] {
    pointer-events: auto;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-head {
    display: flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-head-l {
    display: flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status {
    display: flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status-text {
    display: flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-list {
    overflow-y: auto;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-list:empty {
    display: none;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item {
    display: grid;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-ico {
    display: inline-flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-body {
    display: flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-actions {
    display: flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-dismiss {
    display: inline-flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-empty-ico {
    display: inline-flex;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-panel {
    background: var(--bg-elevated);
    border: 1px solid var(--line-hairline);
    border-radius: 12px;
    box-shadow: 0 1px 2px rgb(15 23 42 / 0.04),
        0 12px 32px -8px rgb(15 23 42 / 0.18),
        0 24px 64px -12px rgb(15 23 42 / 0.22);
    opacity: 0;
    transform: translateY(-4px) scale(0.99);
    transition: opacity 180ms var(--ease-out),
        transform 180ms var(--ease-out);
}
[data-theme="dark"] __ACTIVITY_SCOPE__ .activity-pixel-stage .notif-panel {
    background: var(--graphite-900);
    border-color: var(--glass-border);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.5),
        0 12px 32px -8px rgb(0 0 0 / 0.55),
        0 24px 64px -12px rgb(0 0 0 / 0.6);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-panel[data-open="true"] {
    opacity: 1;
    transform: translateY(0) scale(1);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage.cl-pop-host > .notif-panel {
    position: static !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    transform: none !important;
    inset: auto !important;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-panel {
    width: 380px;
    max-width: calc(100vw - 32px);
    max-height: 520px;
    display: flex;
    flex-direction: column;
    gap: 0;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-trigger .notif-badge {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--signal-danger);
    color: white;
    font: 700 9.5px var(--font-sans);
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 1.5px var(--bg-elevated);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-head {
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--line-hairline);
}
[data-theme="dark"] __ACTIVITY_SCOPE__ .activity-pixel-stage .notif-head {
    border-bottom-color: var(--glass-border-soft);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-head-l {
    flex-direction: column;
    gap: 2px;
    flex: 1;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-title {
    font: 600 13px var(--font-sans);
    color: var(--fg-primary);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-count {
    font: 500 11px var(--font-mono);
    color: var(--fg-tertiary);
    padding: 0;
    border: 0;
    background: transparent;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status {
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-recessed);
    border-bottom: 1px solid var(--line-hairline);
}
[data-theme="dark"] __ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status {
    background: rgb(255 255 255 / 0.03);
    border-bottom-color: var(--glass-border-soft);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status-ico {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--signal-success);
    flex: none;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status[data-state="syncing"] .notif-status-ico {
    background: var(--signal-info);
    animation: bpulse 1.4s ease-in-out infinite;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status[data-state="error"] .notif-status-ico {
    background: var(--signal-danger);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status-text {
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status-line {
    font: 600 12px var(--font-sans);
    color: var(--fg-primary);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-status-sub {
    font: 500 11px var(--font-mono);
    color: var(--fg-tertiary);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-list {
    flex: 1;
    padding: 4px;
    margin: 0;
    list-style: none;
    max-height: 340px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item {
    grid-template-columns: 26px 1fr auto;
    gap: 10px;
    align-items: start;
    padding: 10px;
    border-radius: 8px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item + .notif-item {
    border-top: 1px solid var(--line-hairline);
    border-radius: 0;
}
[data-theme="dark"] __ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item + .notif-item {
    border-top-color: var(--glass-border-soft);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item.is-unread {
    background: var(--accent-soft);
    border-radius: 8px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item.is-unread + .notif-item {
    border-top: 0;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-ico {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    align-items: center;
    justify-content: center;
    background: var(--bg-recessed);
    border: 1px solid var(--line-hairline);
    color: var(--fg-tertiary);
    flex: none;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-ico svg {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item[data-kind="success"] .notif-ico {
    background: color-mix(in srgb, var(--signal-success) 14%, transparent);
    border-color: color-mix(in srgb, var(--signal-success) 30%, transparent);
    color: var(--signal-success);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item[data-kind="error"] .notif-ico {
    background: color-mix(in srgb, var(--signal-danger) 14%, transparent);
    border-color: color-mix(in srgb, var(--signal-danger) 30%, transparent);
    color: var(--signal-danger);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item[data-kind="warn"] .notif-ico {
    background: color-mix(in srgb, var(--signal-warning) 18%, transparent);
    border-color: color-mix(in srgb, var(--signal-warning) 32%, transparent);
    color: var(--signal-warning-strong);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item[data-kind="info"] .notif-ico {
    background: color-mix(in srgb, var(--signal-info) 14%, transparent);
    border-color: color-mix(in srgb, var(--signal-info) 30%, transparent);
    color: var(--signal-info);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item[data-kind="queued"] .notif-ico {
    background: color-mix(in srgb, var(--fg-tertiary) 16%, transparent);
    color: var(--fg-tertiary);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item[data-kind="partial-failed"] .notif-ico {
    background: color-mix(in srgb, var(--signal-warning) 16%, transparent);
    color: var(--signal-warning);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-body {
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-msg,
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item-title {
    font: 600 12.5px / 1.35 var(--font-sans);
    color: var(--fg-primary);
    margin: 0;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-sub,
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item-body {
    font: 500 12px / 1.5 var(--font-sans);
    color: var(--fg-secondary);
    margin: 2px 0 0;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-time,
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item-meta {
    font: 500 11px / 1.4 var(--font-mono);
    color: var(--fg-tertiary);
    margin-top: 4px;
    letter-spacing: 0.02em;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-actions {
    align-items: center;
    gap: 6px;
    margin-top: 6px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-dismiss {
    width: 22px;
    height: 22px;
    padding: 1px 6px;
    border-radius: 6px;
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--fg-tertiary);
    align-items: center;
    justify-content: center;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-dismiss:hover {
    background: var(--bg-recessed);
    color: var(--fg-primary);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-dismiss:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
    outline-offset: 2px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-dismiss svg {
    width: 11px;
    height: 11px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-empty {
    padding: 28px 18px;
    text-align: center;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-empty-ico {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--signal-success) 14%, transparent);
    color: var(--signal-success);
    align-items: center;
    justify-content: center;
    margin: 0 auto 8px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-empty-ico svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-empty-msg {
    font: 600 13px var(--font-sans);
    color: var(--fg-primary);
    margin: 0 0 4px;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-empty-sub {
    font: 500 12px var(--font-sans);
    color: var(--fg-tertiary);
    margin: 0;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font: 500 11px/1 var(--font-mono);
    color: var(--fg-tertiary);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress .inp-track {
    position: relative;
    height: 4px;
    width: 80px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--fg-tertiary) 18%, transparent);
    overflow: hidden;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress .inp-bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--signal-info);
    border-radius: inherit;
    width: 0%;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress[data-pct="25"] .inp-bar {
    width: 25%;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress[data-pct="40"] .inp-bar {
    width: 40%;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress[data-pct="60"] .inp-bar {
    width: 60%;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress[data-pct="75"] .inp-bar {
    width: 75%;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress[data-pct="90"] .inp-bar {
    width: 90%;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress[data-pct="100"] .inp-bar {
    width: 100%;
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress.indeterminate .inp-track {
    background: color-mix(in srgb, var(--signal-info) 16%, transparent);
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .inline-progress.indeterminate .inp-bar {
    width: 36%;
    animation: sbn-sweep 1.4s linear infinite;
    background: linear-gradient(
        90deg,
        transparent,
        var(--signal-info) 50%,
        transparent
    );
}
__ACTIVITY_SCOPE__ .activity-pixel-stage .notif-item .notif-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
}
`;

function activityFixtureCss(fixtureId: string) {
    return ACTIVITY_FIXTURE_CSS.split("__ACTIVITY_SCOPE__").join(
        `#${fixtureId}`,
    );
}

type ActivityPixelDiff = {
    bounds: {
        maxX: number;
        maxY: number;
        minX: number;
        minY: number;
    } | null;
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
};

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");

function assertE2EDatabasePath(filePath: string) {
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== E2E_ROOT_DIR &&
        !resolvedPath.startsWith(`${E2E_ROOT_DIR}${path.sep}`)
    ) {
        throw new Error(
            `Refusing to touch non-E2E database path: ${resolvedPath}`,
        );
    }
}

async function executeWithBusyRetry<T>(
    operation: () => Promise<T>,
    attempts = 5,
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (
                !(error instanceof Error) ||
                !error.message.includes("SQLITE_BUSY") ||
                attempt === attempts - 1
            ) {
                throw error;
            }
            await new Promise((resolve) =>
                setTimeout(resolve, 75 * (attempt + 1)),
            );
        }
    }

    throw lastError;
}

async function openSotComponentLibrary(page: Page) {
    await page.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
        document.body.dataset.theme = "light";
    });
}

async function readSotActivityHtml(page: Page) {
    const triggerEntries = await Promise.all(
        ACTIVITY_TRIGGER_SOT_STATES.map(async (state) => [
            state,
            await page
                .locator(ACTIVITY_TRIGGER_SELECTORS[state])
                .first()
                .evaluate((element) => element.outerHTML),
        ]),
    );
    const panelEntries = await Promise.all(
        ACTIVITY_PANEL_SOT_STATES.map(async (state) => {
            const panel = page
                .locator("#activity .cl-card")
                .filter({ hasText: ACTIVITY_PANEL_CARD_LABELS[state] })
                .locator(".notif-panel")
                .first();
            await expect(panel).toBeVisible();
            return [
                state,
                await panel.evaluate((element) => element.outerHTML),
            ] as const;
        }),
    );

    return {
        panels: Object.fromEntries(panelEntries) as Record<
            ActivityPanelSotState,
            string
        >,
        triggers: Object.fromEntries(triggerEntries) as Record<
            ActivityTriggerSotState,
            string
        >,
    };
}

async function captureActivityFixture(
    page: Page,
    kind: ActivitySotFixtureKind,
    html: string,
) {
    const fixtureId = `sot-activity-${kind}-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    const fixtureCss = activityFixtureCss(fixtureId);

    await page.evaluate(
        ({
            fixtureCss: css,
            fixtureId: id,
            html: fixtureHtml,
            kind: fixtureKind,
        }) => {
            document
                .querySelector(`style[data-activity-fixture="${id}"]`)
                ?.remove();
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "light";
            document.body.dataset.theme = "light";

            const fixtureStyle = document.createElement("style");
            fixtureStyle.dataset.activityFixture = id;
            fixtureStyle.textContent = css;
            document.head.appendChild(fixtureStyle);

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className =
                fixtureKind === "panel"
                    ? "activity-pixel-stage cl-pop-host"
                    : "activity-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.overflow = "visible";
            stage.style.padding = fixtureKind === "panel" ? "20px" : "16px";
            stage.style.width = fixtureKind === "panel" ? "420px" : "68px";
            stage.style.height = fixtureKind === "panel" ? "560px" : "68px";
            stage.innerHTML = fixtureHtml;

            if (fixtureKind === "trigger") {
                stage.style.display = "flex";
                stage.style.alignItems = "center";
                stage.style.justifyContent = "center";
            } else {
                stage.style.display = "block";
            }

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureCss, fixtureId, html, kind },
    );

    const stage = page.locator(`#${fixtureId} > .activity-pixel-stage`).first();
    const root =
        kind === "panel"
            ? page.locator(`#${fixtureId} .notif-panel`).first()
            : page.locator(`#${fixtureId} .notif-trigger`).first();
    await expect(root).toBeVisible();
    await page.waitForTimeout(250);

    const metrics = await root.evaluate((element) => {
        const readStyle = (node: Element | null) => {
            if (!node) return null;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return {
                backgroundColor: style.backgroundColor,
                borderColor: style.borderColor,
                boxShadow: style.boxShadow,
                color: style.color,
                display: style.display,
                font: style.font,
                height: Math.round(rect.height * 1000) / 1000,
                opacity: style.opacity,
                padding: style.padding,
                transform: style.transform,
                width: Math.round(rect.width * 1000) / 1000,
            };
        };

        return {
            badge: readStyle(element.querySelector(".notif-badge")),
            dismissButton: readStyle(element.querySelector(".notif-dismiss")),
            dismissPath: readStyle(element.querySelector(".notif-dismiss path")),
            dismissSvg: readStyle(element.querySelector(".notif-dismiss svg")),
            firstItem: readStyle(element.querySelector(".notif-item")),
            root: readStyle(element),
            status: readStyle(element.querySelector(".notif-status")),
            statusButton: readStyle(
                element.querySelector(
                    '.notif-status [data-slot="button"]',
                ),
            ),
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.querySelector(`style[data-activity-fixture="${id}"]`)?.remove();
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function compareActivityPixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<ActivityPixelDiff> {
    return page.evaluate(
        async ({ actual: actualSrc, expected: expectedSrc }) => {
            const loadImage = (src: string) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () =>
                        reject(new Error(`Failed to decode screenshot ${src}`));
                    image.src = src;
                });
            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expectedSrc),
                loadImage(actualSrc),
            ]);

            if (
                expectedImage.naturalWidth !== actualImage.naturalWidth ||
                expectedImage.naturalHeight !== actualImage.naturalHeight
            ) {
                return {
                    bounds: null,
                    differingPixels: -1,
                    dimensionsMatch: false,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: -1,
                    productHeight: actualImage.naturalHeight,
                    productWidth: actualImage.naturalWidth,
                };
            }

            const canvas = document.createElement("canvas");
            canvas.width = expectedImage.naturalWidth;
            canvas.height = expectedImage.naturalHeight;
            const context = canvas.getContext("2d", {
                willReadFrequently: true,
            });
            if (!context) {
                throw new Error("Canvas 2D context unavailable");
            }

            context.drawImage(expectedImage, 0, 0);
            const expectedData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(actualImage, 0, 0);
            const actualData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;

            let differingPixels = 0;
            let maxChannelDelta = 0;
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = -1;
            let maxY = -1;
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    const pixelIndex = index / 4;
                    const x = pixelIndex % canvas.width;
                    const y = Math.floor(pixelIndex / canvas.width);
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }

            return {
                bounds:
                    differingPixels > 0
                        ? { maxX, maxY, minX, minY }
                        : null,
                differingPixels,
                dimensionsMatch: true,
                expectedHeight: expectedImage.naturalHeight,
                expectedWidth: expectedImage.naturalWidth,
                maxChannelDelta,
                productHeight: actualImage.naturalHeight,
                productWidth: actualImage.naturalWidth,
            };
        },
        { actual, expected },
    );
}

async function expectActivityPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    kind: ActivitySotFixtureKind,
    state: string,
    html: string,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureActivityFixture(sotPage, kind, html),
        captureActivityFixture(page, kind, html),
    ]);
    const diff = await compareActivityPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `activity-${kind}-${state}`
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
        await testInfo.attach(`${name}-metrics.json`, {
            body: Buffer.from(
                JSON.stringify(
                    {
                        product: productCapture.metrics,
                        sot: sotCapture.metrics,
                    },
                    null,
                    2,
                ),
            ),
            contentType: "application/json",
        });
    }

    const diffLabel = `activity ${kind} ${state} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
    expect(diff.differingPixels, diffLabel).toBe(0);
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const id = result.rows[0]?.id;
        if (typeof id !== "string") {
            throw new Error("Playwright user not found");
        }
        return id;
    } finally {
        await client.close();
    }
}

type SyncWorkerStateSnapshot = {
    createdAt: number;
    id: string;
    isRunning: number;
    lastError: string | null;
    lastFinishedAt: number | null;
    lastHeartbeatAt: number | null;
    lastStartedAt: number | null;
    lastSummary: string | null;
    manualTriggerRequestedAt: number | null;
    nextRunAt: number | null;
    updatedAt: number;
    userId: string;
};

const PARTIAL_FAILED_SYNC_WORKER_STATE_ID =
    "e2e-activity-partial-failed-worker-state";

function requiredString(value: unknown, label: string) {
    if (typeof value !== "string") {
        throw new Error(`Expected ${label} to be a string`);
    }
    return value;
}

function requiredNumber(value: unknown, label: string) {
    if (typeof value !== "number") {
        throw new Error(`Expected ${label} to be a number`);
    }
    return value;
}

function optionalNumber(value: unknown) {
    return typeof value === "number" ? value : null;
}

function optionalString(value: unknown) {
    return typeof value === "string" ? value : null;
}

function encryptWithPlaywrightE2EKey(plaintext: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
        "aes-256-gcm",
        Buffer.from(E2E_ENCRYPTION_KEY, "hex"),
        iv,
    );
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);

    return [
        iv.toString("hex"),
        cipher.getAuthTag().toString("hex"),
        encrypted.toString("hex"),
    ].join(":");
}

async function readSyncWorkerStateForUser(userId: string) {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await executeWithBusyRetry(() =>
            client.execute({
                sql: `
                    SELECT
                        id,
                        user_id,
                        last_heartbeat_at,
                        last_started_at,
                        last_finished_at,
                        next_run_at,
                        manual_trigger_requested_at,
                        is_running,
                        last_error,
                        last_summary,
                        created_at,
                        updated_at
                    FROM sync_worker_state
                    WHERE user_id = ?
                    LIMIT 1
                `,
                args: [userId],
            }),
        );
        const row = result.rows[0];
        if (!row) {
            return null;
        }

        return {
            createdAt: requiredNumber(row.created_at, "created_at"),
            id: requiredString(row.id, "id"),
            isRunning: requiredNumber(row.is_running, "is_running"),
            lastError: optionalString(row.last_error),
            lastFinishedAt: optionalNumber(row.last_finished_at),
            lastHeartbeatAt: optionalNumber(row.last_heartbeat_at),
            lastStartedAt: optionalNumber(row.last_started_at),
            lastSummary: optionalString(row.last_summary),
            manualTriggerRequestedAt: optionalNumber(
                row.manual_trigger_requested_at,
            ),
            nextRunAt: optionalNumber(row.next_run_at),
            updatedAt: requiredNumber(row.updated_at, "updated_at"),
            userId: requiredString(row.user_id, "user_id"),
        } satisfies SyncWorkerStateSnapshot;
    } finally {
        await client.close();
    }
}

async function seedPartialFailedSyncWorkerState(userId: string) {
    const now = Date.now();
    const lastStartedAt = now - 15_000;
    const lastSummary = JSON.stringify({
        errorCount: 2,
        newRecordings: 3,
        removedRecordings: 1,
        updatedRecordings: 5,
    });
    const client = createClient({ url: databaseUrl(CORE_DB) });

    try {
        await executeWithBusyRetry(() =>
            client.execute({
                sql: `
                    INSERT INTO sync_worker_state (
                        id,
                        user_id,
                        last_heartbeat_at,
                        last_started_at,
                        last_finished_at,
                        next_run_at,
                        manual_trigger_requested_at,
                        is_running,
                        last_error,
                        last_summary,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        last_heartbeat_at = excluded.last_heartbeat_at,
                        last_started_at = excluded.last_started_at,
                        last_finished_at = excluded.last_finished_at,
                        next_run_at = excluded.next_run_at,
                        manual_trigger_requested_at = NULL,
                        is_running = 0,
                        last_error = NULL,
                        last_summary = excluded.last_summary,
                        updated_at = excluded.updated_at
                `,
                args: [
                    PARTIAL_FAILED_SYNC_WORKER_STATE_ID,
                    userId,
                    now,
                    lastStartedAt,
                    now,
                    now + 30 * 60 * 1000,
                    lastSummary,
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await client.close();
    }
}

async function restoreSyncWorkerStateForUser(
    userId: string,
    snapshot: SyncWorkerStateSnapshot | null,
) {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        if (!snapshot) {
            await executeWithBusyRetry(() =>
                client.execute({
                    sql: "DELETE FROM sync_worker_state WHERE user_id = ?",
                    args: [userId],
                }),
            );
            return;
        }

        await executeWithBusyRetry(() =>
            client.execute({
                sql: `
                    INSERT INTO sync_worker_state (
                        id,
                        user_id,
                        last_heartbeat_at,
                        last_started_at,
                        last_finished_at,
                        next_run_at,
                        manual_trigger_requested_at,
                        is_running,
                        last_error,
                        last_summary,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        id = excluded.id,
                        last_heartbeat_at = excluded.last_heartbeat_at,
                        last_started_at = excluded.last_started_at,
                        last_finished_at = excluded.last_finished_at,
                        next_run_at = excluded.next_run_at,
                        manual_trigger_requested_at = excluded.manual_trigger_requested_at,
                        is_running = excluded.is_running,
                        last_error = excluded.last_error,
                        last_summary = excluded.last_summary,
                        created_at = excluded.created_at,
                        updated_at = excluded.updated_at
                `,
                args: [
                    snapshot.id,
                    snapshot.userId,
                    snapshot.lastHeartbeatAt,
                    snapshot.lastStartedAt,
                    snapshot.lastFinishedAt,
                    snapshot.nextRunAt,
                    snapshot.manualTriggerRequestedAt,
                    snapshot.isRunning,
                    snapshot.lastError,
                    snapshot.lastSummary,
                    snapshot.createdAt,
                    snapshot.updatedAt,
                ],
            }),
        );
    } finally {
        await client.close();
    }
}

type ActivityIflyrecSourceSyncState = {
    enabled: number;
    id: string;
    lastSyncError: string | null;
    lastSyncFinishedAt: number | null;
    lastSyncStartedAt: number | null;
    syncStatus: string;
};

type IflyrecUpstreamRequest = {
    body: string;
    headers: Record<string, string>;
    method: string;
    pathname: string;
};

async function cleanupActivityIflyrecSourceConnection(userId: string) {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await executeWithBusyRetry(() =>
            client.execute({
                sql: "DELETE FROM source_connections WHERE user_id = ? AND id = ? AND provider = 'iflyrec'",
                args: [userId, ACTIVITY_IFLYREC_SOURCE_CONNECTION_ID],
            }),
        );
    } finally {
        await client.close();
    }
}

async function seedActivityIflyrecSourceConnection(
    userId: string,
    baseUrl: string,
) {
    const now = Date.now();
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await executeWithBusyRetry(() =>
            client.execute({
                sql: `
                    INSERT INTO source_connections (
                        id, user_id, provider, enabled, auth_mode, base_url,
                        config, secret_config, last_sync, sync_status,
                        last_sync_error, last_sync_started_at, last_sync_finished_at,
                        created_at, updated_at
                    ) VALUES (?, ?, 'iflyrec', 1, 'session-header', ?, ?, ?, ?, 'error', ?, ?, NULL, ?, ?)
                    ON CONFLICT(user_id, provider) DO UPDATE SET
                        id = excluded.id,
                        enabled = excluded.enabled,
                        auth_mode = excluded.auth_mode,
                        base_url = excluded.base_url,
                        config = excluded.config,
                        secret_config = excluded.secret_config,
                        last_sync = excluded.last_sync,
                        sync_status = excluded.sync_status,
                        last_sync_error = excluded.last_sync_error,
                        last_sync_started_at = excluded.last_sync_started_at,
                        last_sync_finished_at = excluded.last_sync_finished_at,
                        updated_at = excluded.updated_at
                `,
                args: [
                    ACTIVITY_IFLYREC_SOURCE_CONNECTION_ID,
                    userId,
                    baseUrl,
                    "{}",
                    encryptWithPlaywrightE2EKey(
                        JSON.stringify({ sessionId: ACTIVITY_IFLYREC_SESSION_ID }),
                    ),
                    now - 60_000,
                    "E2E activity sync error",
                    now - 15_000,
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await client.close();
    }
}

async function readActivityIflyrecSourceSyncState(userId: string) {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await executeWithBusyRetry(() =>
            client.execute({
                sql: `
                    SELECT id, enabled, sync_status, last_sync_error,
                           last_sync_started_at, last_sync_finished_at
                    FROM source_connections
                    WHERE user_id = ? AND provider = 'iflyrec'
                    LIMIT 1
                `,
                args: [userId],
            }),
        );
        const row = result.rows[0];
        if (!row) {
            throw new Error("Seeded activity iFlyrec source connection was not found");
        }

        return {
            enabled: requiredNumber(row.enabled, "enabled"),
            id: requiredString(row.id, "id"),
            lastSyncError: optionalString(row.last_sync_error),
            lastSyncFinishedAt: optionalNumber(row.last_sync_finished_at),
            lastSyncStartedAt: optionalNumber(row.last_sync_started_at),
            syncStatus: requiredString(row.sync_status, "sync_status"),
        } satisfies ActivityIflyrecSourceSyncState;
    } finally {
        await client.close();
    }
}

async function startControlledActivityIflyrecUpstream() {
    let releaseResponse = () => {};
    const responseGate = new Promise<void>((resolve) => {
        releaseResponse = resolve;
    });
    let resolveFirstRequest: (request: IflyrecUpstreamRequest) => void = () =>
        {};
    const firstRequest = new Promise<IflyrecUpstreamRequest>((resolve) => {
        resolveFirstRequest = resolve;
    });
    const requests: IflyrecUpstreamRequest[] = [];

    const server = createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        const capturedRequest: IflyrecUpstreamRequest = {
            body: Buffer.concat(chunks).toString("utf8"),
            headers: Object.fromEntries(
                Object.entries(request.headers).map(([key, value]) => [
                    key,
                    Array.isArray(value) ? value.join(",") : (value ?? ""),
                ]),
            ),
            method: request.method ?? "",
            pathname: new URL(
                request.url ?? "/",
                "http://127.0.0.1",
            ).pathname,
        };
        requests.push(capturedRequest);
        if (requests.length === 1) {
            resolveFirstRequest(capturedRequest);
        }

        await responseGate;
        const supportedRequest =
            capturedRequest.method === "POST" &&
            capturedRequest.pathname === IFLYREC_RECENT_OPERATIONS_PATH;
        response.writeHead(supportedRequest ? 200 : 404, {
            "Content-Type": "application/json",
        });
        response.end(
            JSON.stringify(
                supportedRequest
                    ? { biz: { hjList: [] } }
                    : { error: "Unexpected controlled iFlyrec request" },
            ),
        );
    });

    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once("error", onError);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", onError);
            resolve();
        });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
        server.close();
        throw new Error("Controlled activity iFlyrec upstream did not bind a TCP port");
    }

    return {
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
        close: async () => {
            releaseResponse();
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        },
        releaseEmptyRecordingList: releaseResponse,
        requests,
        waitForRequest: () => firstRequest,
    };
}

async function cleanupActivityRecording() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE id = ? OR recording_id IN (?, ?)",
            args: [
                ACTIVITY_JOB_ID,
                ACTIVITY_RECORDING_ID,
                ACTIVITY_BACKGROUND_RECORDING_ID,
            ],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id IN (?, ?)",
            args: [ACTIVITY_RECORDING_ID, ACTIVITY_BACKGROUND_RECORDING_ID],
        });
    } finally {
        await library.close();
    }
}

async function seedActivityRecording(
    userId: string,
    options: { cleanup?: boolean; now?: number } = {},
) {
    const now = options.now ?? Date.now();
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        if (options.cleanup ?? true) {
            await cleanupActivityRecording();
        }
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO recordings (
                    id, user_id, source_provider, source_recording_id, source_version,
                    source_metadata, provider_device_id, filename, duration, start_time,
                    end_time, filesize, file_md5, storage_type, storage_path,
                    downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                ACTIVITY_RECORDING_ID,
                userId,
                "ticnote",
                "e2e-activity-source",
                "1",
                "{}",
                "e2e-activity-device",
                "E2E activity transcription",
                120_000,
                now - 120_000,
                now,
                2048,
                "e2e-activity",
                "local",
                "",
                null,
                0,
                0,
                now,
                now,
            ],
        });
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO transcription_jobs (
                    id, user_id, recording_id, status, force, provider, model,
                    provider_job_id, remote_status, attempts, last_error,
                    requested_at, started_at, completed_at, next_poll_at,
                    created_at, updated_at
                ) VALUES (?, ?, ?, 'processing', 0, 'voice-transcribe', 'e2e',
                    'remote-e2e-activity', 'transcribing', 1, NULL,
                    ?, ?, NULL, ?, ?, ?)
            `,
            args: [
                ACTIVITY_JOB_ID,
                userId,
                ACTIVITY_RECORDING_ID,
                now - 60_000,
                now - 45_000,
                now + 60_000,
                now - 60_000,
                now,
            ],
        });
    } finally {
        await library.close();
    }
}

async function seedActivityBackgroundRecording(userId: string, now = Date.now()) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO recordings (
                    id, user_id, source_provider, source_recording_id, source_version,
                    source_metadata, provider_device_id, filename, duration, start_time,
                    end_time, filesize, file_md5, storage_type, storage_path,
                    downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                ACTIVITY_BACKGROUND_RECORDING_ID,
                userId,
                "ticnote",
                "e2e-activity-background-source",
                "1",
                "{}",
                "e2e-activity-device",
                "E2E activity current selection",
                60_000,
                now - 60_000,
                now,
                1024,
                "e2e-activity-background",
                "local",
                "",
                null,
                0,
                0,
                now,
                now,
            ],
        });
    } finally {
        await library.close();
    }
}

function unhealthyWorkerStatus() {
    const now = new Date();

    return {
        autoSyncEnabled: true,
        lastSyncTime: now.toISOString(),
        nextSyncTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        workerStatus: {
            healthy: false,
            isRunning: false,
            lastHeartbeatAt: new Date(
                now.getTime() - 2 * 60 * 1000,
            ).toISOString(),
            lastStartedAt: null,
            lastFinishedAt: null,
            nextRunAt: null,
            manualTriggerRequestedAt: null,
            lastError: "本地更新服务未响应。",
            lastSummary: null,
        },
    };
}

function healthyWorkerStatus(
    options: {
        errorCount?: number;
        newRecordings?: number;
        removedRecordings?: number;
        running?: boolean;
        updatedRecordings?: number;
    } = {},
) {
    const now = new Date();

    return {
        autoSyncEnabled: true,
        lastSyncTime: now.toISOString(),
        nextSyncTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        workerStatus: {
            healthy: true,
            isRunning: options.running ?? false,
            lastHeartbeatAt: now.toISOString(),
            lastStartedAt: options.running ? now.toISOString() : null,
            lastFinishedAt: options.running ? null : now.toISOString(),
            nextRunAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
            manualTriggerRequestedAt: null,
            lastError: null,
            lastSummary: {
                newRecordings: options.newRecordings ?? 0,
                updatedRecordings: options.updatedRecordings ?? 0,
                removedRecordings: options.removedRecordings ?? 0,
                errorCount: options.errorCount ?? 0,
            },
        },
    };
}

async function mockSyncEndpoint(
    page: Page,
    releasePost: Promise<void>,
    getStatusResponse: () => unknown = unhealthyWorkerStatus,
) {
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() === "POST") {
            await releasePost;
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    success: true,
                    queued: true,
                    newRecordings: 0,
                }),
            });
            return;
        }

        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(getStatusResponse()),
            });
            return;
        }

        await route.continue();
    });
}

async function resetDisplaySettings(
    page: Page,
    overrides: Record<string, unknown> = {},
) {
    const resetResponse = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "zh-CN",
            ...overrides,
        },
    });
    expect(resetResponse.ok()).toBe(true);
}

async function reloadDashboardWithDisplaySettings(
    page: Page,
    expectations: { activityLabel: string; theme: "dark" | "light" },
) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(`html[data-theme="${expectations.theme}"]`))
        .toHaveCount(1);
    await expect(dashboardControl(page, "dashboard-activity")).toHaveAttribute(
        "aria-label",
        expectations.activityLabel,
    );
}

function dashboardSurface(page: Page) {
    return page.locator('[data-surface="dashboard-workstation"]');
}

function dashboardControl(page: Page, name: string) {
    return dashboardSurface(page).locator(`[data-control="${name}"]`);
}

function dashboardPanel(page: Page, name: string) {
    return dashboardSurface(page).locator(`[data-panel="${name}"]`);
}

function recordingRow(page: Page, title: string) {
    return dashboardSurface(page)
        .locator('[data-control="dashboard-recording-row"]')
        .filter({ hasText: title });
}

function selectedRecordingTitle(page: Page, title: string | RegExp) {
    return page.getByRole("heading", { name: title });
}

async function openActivityOverlay(page: Page) {
    const surface = dashboardSurface(page);
    const trigger = surface.getByRole("button", {
        name: /^(?:通知|Notifications)$/,
    });
    const panel = surface.getByRole("dialog", {
        name: /^(?:最近动态|Recent activity)$/,
    });

    await expect(surface).toHaveAttribute("data-state", "ready");
    await expect(trigger).toBeVisible();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await panel.isVisible().catch(() => false)) {
            break;
        }
        await trigger.click();
        if (await panel.isVisible({ timeout: 1_500 }).catch(() => false)) {
            break;
        }
    }

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    return panel;
}

async function expectActivityPortalOverlay(page: Page) {
    const panel = dashboardPanel(page, "dashboard-activity");
    await expect(panel).toBeVisible();
}

async function expectActivityAnchoredToTrigger(page: Page) {
    const panel = dashboardPanel(page, "dashboard-activity");
    await expect(panel).toBeVisible();

    const metrics = await panel.evaluate((node) => {
        const panelRect = node.getBoundingClientRect();
        const trigger = document.querySelector(
            '[data-control="dashboard-activity"]',
        );
        if (!trigger) {
            throw new Error("Missing activity trigger");
        }
        const triggerRect = trigger.getBoundingClientRect();

        return {
            expectedRight: Math.max(
                12,
                Math.round(window.innerWidth - triggerRect.right),
            ),
            panelRightOffset: window.innerWidth - panelRect.right,
            panelTop: panelRect.top,
            triggerBottom: triggerRect.bottom,
        };
    });

    expect(Math.abs(metrics.panelTop - (metrics.triggerBottom + 8))).toBeLessThanOrEqual(16);
    expect(Math.abs(metrics.panelRightOffset - metrics.expectedRight)).toBeLessThanOrEqual(16);
}

async function expectActivityMobileLayout(page: Page) {
    const panel = dashboardPanel(page, "dashboard-activity");
    await expect(panel).toBeVisible();

    const metrics = await panel.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
            left: rect.left,
            right: window.innerWidth - rect.right,
            viewportWidth: window.innerWidth,
            width: rect.width,
        };
    });

    expect(Math.abs(metrics.left - 12)).toBeLessThanOrEqual(2);
    expect(Math.abs(metrics.right - 12)).toBeLessThanOrEqual(2);
    expect(metrics.width).toBeLessThanOrEqual(metrics.viewportWidth);
}

test("dashboard Activity controls match SOT component-library pixels", async ({
    page,
}, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 760 });

    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(healthyWorkerStatus()),
        });
    });

    await ensureSignedIn(page);
    await resetDisplaySettings(page, { theme: "light", uiLanguage: "zh-CN" });
    await reloadDashboardWithDisplaySettings(page, {
        activityLabel: "通知",
        theme: "light",
    });

    const runtimeTrigger = dashboardControl(page, "dashboard-activity");
    await expect(runtimeTrigger).toBeVisible();
    await expect(runtimeTrigger).toHaveAttribute("data-slot", "button");
    await expect(runtimeTrigger).toHaveAttribute("data-variant", "ghost");
    await expect(runtimeTrigger).toHaveAttribute("data-size", "icon-sm");
    await expect(
        runtimeTrigger.locator('[data-part="dashboard-activity-badge"]'),
    ).toHaveCount(1);

    const sotPage = await page.context().newPage();
    try {
        await openSotComponentLibrary(sotPage);
        const sotActivityHtml = await readSotActivityHtml(sotPage);

        for (const state of ACTIVITY_TRIGGER_SOT_STATES) {
            await expectActivityPixelMatch(
                page,
                testInfo,
                sotPage,
                "trigger",
                state,
                sotActivityHtml.triggers[state],
            );
        }

        for (const state of ACTIVITY_PANEL_SOT_STATES) {
            await expectActivityPixelMatch(
                page,
                testInfo,
                sotPage,
                "panel",
                state,
                sotActivityHtml.panels[state],
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("activity overlay opens data source settings for worker-down notifications", async ({
    page,
}) => {
    await mockSyncEndpoint(page, Promise.resolve());

    await ensureSignedIn(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = dashboardControl(page, "dashboard-activity");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-label", "通知");
    await expect(trigger).toHaveAttribute("data-unread", "1");

    const panel = await openActivityOverlay(page);
    await expectActivityPortalOverlay(page);
    await expectActivityAnchoredToTrigger(page);
    await expect(
        panel.locator('[data-part="dashboard-activity-heading"]'),
    ).toBeVisible();
    await expect(
        panel.locator('[data-part="dashboard-activity-count"]'),
    ).toContainText("1 项待处理");

    const item = panel.locator('[data-activity-id="worker-unavailable"]');
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("data-kind", "worker-down");
    await expect(item).toHaveAttribute("data-action-state", "idle");
    await expect(
        item.locator('[data-part="dashboard-activity-item-title"]'),
    ).toContainText(
        "自动更新暂时不可用",
    );
    await expect(
        item.locator('[data-part="dashboard-activity-item-body"]'),
    ).toContainText(
        "本地更新服务未响应。",
    );
    await expect(
        item.locator('[data-part="dashboard-activity-item-meta"]'),
    ).toHaveText("刚刚");

    const action = item.getByRole("button", { name: "前往数据源设置" });
    await expect(item).toHaveAttribute("data-action", "settings");
    await expect(action).toContainText("前往数据源设置");
    await action.click();

    const settingsShell = page.getByRole("dialog", { name: "设置" });
    await expect(panel).toBeHidden();
    await expect(settingsShell).toBeVisible();
    await expect(
        settingsShell.getByRole("button", { name: "数据源" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(panel).toHaveCount(0);

    await settingsShell.getByRole("button", { name: "关闭设置" }).click();
    await expect(settingsShell).toBeHidden();
    await expect(dashboardControl(page, "dashboard-settings")).toBeFocused();
});

test("activity overlay dismisses actionable notifications into an empty state", async ({
    page,
}) => {
    await mockSyncEndpoint(page, Promise.resolve());

    await ensureSignedIn(page);
    await resetDisplaySettings(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = dashboardControl(page, "dashboard-activity");
    await expect(trigger).toHaveAttribute("aria-label", "通知");
    await expect(trigger).toHaveAttribute("data-unread", "1");

    const panel = await openActivityOverlay(page);
    await expect(panel).toHaveAttribute("data-state", "error");
    await expect(panel).toContainText("1 项待处理");

    const item = panel.locator('[data-activity-id="worker-unavailable"]');
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: "忽略 自动更新暂时不可用" }).click();

    await expect(item).toHaveCount(0);
    await expect(panel).toHaveAttribute("data-state", "empty");
    await expect(panel).toContainText("全部已处理");
    await expect(
        panel.locator('[data-part="dashboard-activity-empty"]'),
    ).toBeVisible();
    await expect(
        panel.locator('[data-part="dashboard-activity-empty-icon"]'),
    ).toBeVisible();
    await expect(
        panel.locator('[data-part="dashboard-activity-empty-title"]'),
    ).toContainText("没有新的动态");
    await expect(
        panel.locator('[data-part="dashboard-activity-empty-body"]'),
    ).toContainText("来源更新与转写任务都在正常运行");
    await expect(
        panel.locator('[data-list="dashboard-activity-items"]'),
    ).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-label", "通知");
    await expect(trigger).toHaveAttribute("data-unread", "0");
    await expect(
        trigger.locator('[data-part="dashboard-activity-badge"]'),
    ).toBeHidden();

    const closeButton = panel.getByRole("button", { name: "关闭最近动态" });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

test("activity overlay exposes default summary and syncing states without layout jumps", async ({
    page,
}) => {
    let statusMode: "empty" | "partial-failed" | "syncing" = "empty";
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
                healthyWorkerStatus({
                    errorCount: statusMode === "partial-failed" ? 2 : 0,
                    newRecordings: statusMode === "partial-failed" ? 3 : 0,
                    removedRecordings: statusMode === "partial-failed" ? 1 : 0,
                    running: statusMode === "syncing",
                    updatedRecordings: statusMode === "partial-failed" ? 5 : 0,
                }),
            ),
        });
    });

    await ensureSignedIn(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = dashboardControl(page, "dashboard-activity");
    const panel = dashboardPanel(page, "dashboard-activity");

    await openActivityOverlay(page);
    await expect(panel).toHaveAttribute("data-state", "default");
    await expect(
        panel.locator('[data-part="dashboard-activity-title"]'),
    ).toHaveText("最近动态");
    await expect(
        panel.locator('[data-part="dashboard-activity-count"]'),
    ).toContainText("0 项待处理");
    const status = panel.locator(
        '[data-part="dashboard-activity-status"]',
    );
    await expect(status).toHaveAttribute("data-state", "idle");
    await expect(
        status.locator('[data-part="dashboard-activity-status-line"]'),
    ).toBeVisible();
    await expect(
        status.locator('[data-part="dashboard-activity-status-sub"]'),
    ).toContainText("上次更新于");
    const summaryItem = panel.locator(
        '[data-activity-id="source-sync-summary"]',
    );
    await expect(summaryItem).toBeVisible();
    await expect(summaryItem).toHaveAttribute("data-kind", "success");
    await expect(summaryItem).toContainText("最近一次更新完成");
    await expect(summaryItem).toContainText("新增 0，更新 0，移除 0。");
    await expect(
        summaryItem.locator(
            '[data-part="dashboard-activity-item-title"]',
        ),
    ).toContainText(
        "最近一次更新完成",
    );
    await expect(
        summaryItem.locator('[data-part="dashboard-activity-item-body"]'),
    ).toContainText(
        "新增 0，更新 0，移除 0。",
    );
    const summaryItemHeight = await summaryItem.evaluate((node) =>
        node.getBoundingClientRect().height,
    );
    expect(summaryItemHeight).toBeGreaterThan(48);

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();

    statusMode = "partial-failed";
    await page.reload({ waitUntil: "domcontentloaded" });
    await openActivityOverlay(page);
    await expect(panel).toHaveAttribute("data-state", "error");
    await expect(status).toHaveAttribute("data-state", "error");
    await expect(
        status.locator('[data-part="dashboard-activity-status-line"]'),
    ).toHaveText("部分来源更新失败");
    await expect(
        status.locator('[data-part="dashboard-activity-status-sub"]'),
    ).toContainText("2 个来源更新失败，稍后可重试。");
    const partialSummaryItem = panel.locator(
        '[data-activity-id="source-sync-summary"]',
    );
    await expect(partialSummaryItem).toBeVisible();
    await expect(partialSummaryItem).toHaveAttribute(
        "data-kind",
        "partial-failed",
    );
    await expect(partialSummaryItem).toHaveAttribute("data-state", "warn");
    await expect(
        partialSummaryItem.locator(
            '[data-part="dashboard-activity-item-title"]',
        ),
    ).toContainText(
        "部分来源更新失败",
    );
    await expect(
        partialSummaryItem.locator(
            '[data-part="dashboard-activity-item-body"]',
        ),
    ).toContainText(
        "新增 3，更新 5，移除 1，失败 2。",
    );
    await expect(
        partialSummaryItem.locator(
            '[data-control="dashboard-activity-action"]',
        ),
    ).toHaveText("重试");

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();

    statusMode = "syncing";
    await page.reload({ waitUntil: "domcontentloaded" });

    await openActivityOverlay(page);
    await expect(panel).toHaveAttribute("data-state", "loading");
    await expect(
        panel.locator('[data-part="dashboard-activity-status"]'),
    ).toHaveAttribute("data-state", "running");
    await expect(
        panel.locator('[data-item="dashboard-activity-item"]').first(),
    ).toContainText("正在更新来源");
    await expect(
        panel.locator('[data-item="dashboard-activity-item"]').first(),
    ).toHaveAttribute("data-kind", "queued");
    await expectActivityPortalOverlay(page);

    await page.setViewportSize({ width: 390, height: 740 });
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await openActivityOverlay(page);
    await expectActivityMobileLayout(page);
});

test("activity overlay shows backend-seeded partial-failed worker state across mobile tablet desktop and retries through the real sync endpoint", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    const originalWorkerState = await readSyncWorkerStateForUser(userId);
    const iflyrecUpstream = await startControlledActivityIflyrecUpstream();
    const viewports = [
        { height: 844, name: "mobile" as const, width: 390 },
        { height: 900, name: "tablet" as const, width: 768 },
        { height: 760, name: "desktop" as const, width: 1280 },
    ];

    try {
        await seedActivityIflyrecSourceConnection(
            userId,
            iflyrecUpstream.baseUrl,
        );
        await seedPartialFailedSyncWorkerState(userId);
        await expect
            .poll(() => readActivityIflyrecSourceSyncState(userId))
            .toMatchObject({
                enabled: 1,
                id: ACTIVITY_IFLYREC_SOURCE_CONNECTION_ID,
                lastSyncError: "E2E activity sync error",
                syncStatus: "error",
            });

        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            const syncStatusResponsePromise = page.waitForResponse(
                (response) =>
                    response.url().includes("/api/data-sources/sync") &&
                    response.request().method() === "GET" &&
                    response.status() === 200,
            );
            await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

            const syncStatusResponse = await syncStatusResponsePromise;
            const syncStatus = (await syncStatusResponse.json()) as {
                configured?: boolean;
                workerStatus?: {
                    healthy?: boolean;
                    isRunning?: boolean;
                    lastSummary?: {
                        errorCount?: number;
                        newRecordings?: number;
                        removedRecordings?: number;
                        updatedRecordings?: number;
                    } | null;
                } | null;
            };
            expect(syncStatus.configured, viewport.name).toBe(true);
            expect(syncStatus.workerStatus?.healthy, viewport.name).toBe(true);
            expect(syncStatus.workerStatus?.isRunning, viewport.name).toBe(false);
            expect(syncStatus.workerStatus?.lastSummary, viewport.name).toEqual(
                expect.objectContaining({
                    errorCount: 2,
                    newRecordings: 3,
                    removedRecordings: 1,
                    updatedRecordings: 5,
                }),
            );

            const trigger = dashboardControl(page, "dashboard-activity");
            await expect(trigger, viewport.name).toHaveAttribute(
                "data-unread",
                "1",
            );
            const panel = await openActivityOverlay(page);
            await expect(trigger, viewport.name).toHaveAttribute(
                "aria-expanded",
                "true",
            );
            await expect(panel, viewport.name).toHaveAttribute(
                "data-state",
                "error",
            );
            await expect(
                panel.locator('[data-part="dashboard-activity-status"]'),
                viewport.name,
            ).toHaveAttribute("data-state", "error");
            await expect(
                panel.locator(
                    '[data-part="dashboard-activity-status-line"]',
                ),
                viewport.name,
            ).toHaveText("部分来源更新失败");
            await expect(
                panel.locator(
                    '[data-part="dashboard-activity-status-sub"]',
                ),
                viewport.name,
            ).toContainText("2 个来源更新失败，稍后可重试。");

            const partialSummaryItem = panel.locator(
                '[data-activity-id="source-sync-summary"]',
            );
            await expect(partialSummaryItem, viewport.name).toBeVisible();
            await expect(partialSummaryItem, viewport.name).toHaveAttribute(
                "data-kind",
                "partial-failed",
            );
            await expect(partialSummaryItem, viewport.name).toHaveAttribute(
                "data-state",
                "warn",
            );
            await expect(
                partialSummaryItem.locator(
                    '[data-part="dashboard-activity-item-title"]',
                ),
                viewport.name,
            ).toContainText("部分来源更新失败");
            await expect(
                partialSummaryItem.locator(
                    '[data-part="dashboard-activity-item-body"]',
                ),
                viewport.name,
            ).toContainText("新增 3，更新 5，移除 1，失败 2。");

            const retryAction = partialSummaryItem.locator(
                '[data-control="dashboard-activity-action"]',
            );
            await expect(retryAction, viewport.name).toHaveText("重试");

            const layout = await panel.evaluate((node) => {
                const panelRect = node.getBoundingClientRect();
                const triggerNode = document.querySelector(
                    '[data-control="dashboard-activity"]',
                );
                if (!(triggerNode instanceof HTMLElement)) {
                    throw new Error("Missing activity trigger");
                }
                const triggerRect = triggerNode.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                return {
                    documentOverflowX:
                        document.documentElement.scrollWidth - window.innerWidth,
                    panel: {
                        bottom: panelRect.bottom,
                        left: panelRect.left,
                        position: style.position,
                        right: window.innerWidth - panelRect.right,
                        top: panelRect.top,
                        width: panelRect.width,
                    },
                    trigger: {
                        bottom: triggerRect.bottom,
                        right: window.innerWidth - triggerRect.right,
                    },
                    viewport: {
                        height: window.innerHeight,
                        width: window.innerWidth,
                    },
                };
            });
            expect(layout.viewport, viewport.name).toEqual({
                height: viewport.height,
                width: viewport.width,
            });
            expect(layout.documentOverflowX, viewport.name).toBe(0);
            expect(layout.panel.top, viewport.name).toBeGreaterThanOrEqual(0);
            expect(layout.panel.left, viewport.name).toBeGreaterThanOrEqual(0);
            expect(layout.panel.right, viewport.name).toBeGreaterThanOrEqual(0);
            expect(layout.panel.bottom, viewport.name).toBeLessThanOrEqual(
                layout.viewport.height,
            );
            expect(layout.panel.width, viewport.name).toBeGreaterThan(0);
            expect(layout.panel.width, viewport.name).toBeLessThanOrEqual(
                layout.viewport.width,
            );
            if (viewport.name === "mobile") {
                expect(layout.panel.position).toBe("fixed");
                expect(Math.abs(layout.panel.left - 12)).toBeLessThanOrEqual(2);
                expect(Math.abs(layout.panel.right - 12)).toBeLessThanOrEqual(2);
                expect(
                    Math.abs(
                        layout.panel.width - (layout.viewport.width - 24),
                    ),
                ).toBeLessThanOrEqual(2);
            } else if (viewport.name === "tablet") {
                expect(layout.panel.position).toBe("fixed");
                expect(Math.abs(layout.panel.left - 12)).toBeLessThanOrEqual(2);
                expect(layout.panel.width).toBeLessThanOrEqual(380);
            } else {
                expect(layout.panel.width).toBeLessThanOrEqual(380);
                expect(
                    Math.abs(layout.panel.right - layout.trigger.right),
                ).toBeLessThanOrEqual(16);
                expect(layout.panel.top).toBeGreaterThanOrEqual(
                    layout.trigger.bottom,
                );
            }

            if (viewport.name === "desktop") {
                const retryResponsePromise = page.waitForResponse(
                    (response) =>
                        response.url().includes("/api/data-sources/sync") &&
                        response.request().method() === "POST",
                );
                await retryAction.click();

                const upstreamRequest = await iflyrecUpstream.waitForRequest();
                expect(upstreamRequest).toMatchObject({
                    body: "{}",
                    method: "POST",
                    pathname: IFLYREC_RECENT_OPERATIONS_PATH,
                });
                expect(upstreamRequest.headers["x-biz-id"]).toBe("tjzs");
                expect(upstreamRequest.headers["x-session-id"]).toBe(
                    ACTIVITY_IFLYREC_SESSION_ID,
                );
                expect(iflyrecUpstream.requests).toHaveLength(1);

                const runningSourceState =
                    await readActivityIflyrecSourceSyncState(userId);
                expect(runningSourceState).toMatchObject({
                    enabled: 1,
                    id: ACTIVITY_IFLYREC_SOURCE_CONNECTION_ID,
                    lastSyncError: null,
                    syncStatus: "syncing",
                });
                expect(runningSourceState.lastSyncStartedAt).not.toBeNull();

                const runningWorkerState =
                    await readSyncWorkerStateForUser(userId);
                expect(runningWorkerState).toMatchObject({
                    isRunning: 1,
                    lastError: null,
                    manualTriggerRequestedAt: null,
                    userId,
                });
                expect(runningWorkerState?.lastStartedAt).not.toBeNull();
                await expect(retryAction).toHaveAttribute(
                    "data-action-state",
                    "busy",
                );

                iflyrecUpstream.releaseEmptyRecordingList();
                const retryResponse = await retryResponsePromise;
                expect(retryResponse.ok(), viewport.name).toBe(true);
                const retryBody = (await retryResponse.json()) as {
                    errors?: unknown;
                    newRecordings?: number;
                    queued?: boolean;
                    removedRecordings?: number;
                    success?: boolean;
                };
                expect(retryBody).toMatchObject({
                    newRecordings: 0,
                    queued: false,
                    removedRecordings: 0,
                    success: true,
                });
                expect(retryBody.errors).toEqual([]);

                const syncStatusReadbackResponse = await page.request.get(
                    "/api/data-sources/sync",
                );
                expect(syncStatusReadbackResponse.ok()).toBe(true);
                const syncStatusReadback =
                    (await syncStatusReadbackResponse.json()) as {
                        configured?: boolean;
                        workerStatus?: {
                            healthy?: boolean;
                            isRunning?: boolean;
                            lastError?: string | null;
                            lastFinishedAt?: string | null;
                            lastSummary?: {
                                errorCount?: number;
                                newRecordings?: number;
                                removedRecordings?: number;
                                updatedRecordings?: number;
                            } | null;
                        } | null;
                    };
                expect(syncStatusReadback.configured).toBe(true);
                expect(syncStatusReadback.workerStatus).toEqual(
                    expect.objectContaining({
                        healthy: true,
                        isRunning: false,
                        lastError: null,
                        lastSummary: {
                            errorCount: 0,
                            newRecordings: 0,
                            removedRecordings: 0,
                            updatedRecordings: 0,
                        },
                    }),
                );
                expect(
                    syncStatusReadback.workerStatus?.lastFinishedAt,
                ).not.toBeNull();

                const idleSourceState =
                    await readActivityIflyrecSourceSyncState(userId);
                expect(idleSourceState).toMatchObject({
                    enabled: 1,
                    id: ACTIVITY_IFLYREC_SOURCE_CONNECTION_ID,
                    lastSyncError: null,
                    syncStatus: "idle",
                });
                expect(idleSourceState.lastSyncFinishedAt).not.toBeNull();

                const idleWorkerState = await readSyncWorkerStateForUser(userId);
                expect(idleWorkerState).toMatchObject({
                    isRunning: 0,
                    lastError: null,
                    manualTriggerRequestedAt: null,
                    userId,
                });
                expect(idleWorkerState?.lastFinishedAt).not.toBeNull();

                const activitySyncAction = dashboardControl(
                    page,
                    "dashboard-activity-sync",
                );
                await expect(activitySyncAction).toHaveAttribute(
                    "data-action-state",
                    "done",
                );
                await expect(panel).toHaveAttribute("data-state", "default");
                await expect(trigger).toHaveAttribute("data-unread", "0");
                await expect(
                    panel.locator('[data-part="dashboard-activity-status"]'),
                ).toHaveAttribute("data-state", "idle");
                await expect(partialSummaryItem).toHaveAttribute(
                    "data-kind",
                    "success",
                );
                await expect(
                    partialSummaryItem.locator(
                        '[data-control="dashboard-activity-action"]',
                    ),
                ).toHaveCount(0);
            }

            await panel
                .locator('[data-control="dashboard-activity-close"]')
                .click();
            await expect(panel, viewport.name).toHaveCount(0);
            await expect(trigger, viewport.name).toHaveAttribute(
                "aria-expanded",
                "false",
            );
            await expect(trigger, viewport.name).toBeFocused();
            await openActivityOverlay(page);
            await expect(trigger, viewport.name).toHaveAttribute(
                "aria-expanded",
                "true",
            );
            await expect(partialSummaryItem, viewport.name).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(panel, viewport.name).toHaveCount(0);
            await expect(trigger, viewport.name).toHaveAttribute(
                "aria-expanded",
                "false",
            );
            await expect(trigger, viewport.name).toBeFocused();
        }
    } finally {
        await iflyrecUpstream.close();
        await cleanupActivityIflyrecSourceConnection(userId);
        await restoreSyncWorkerStateForUser(userId, originalWorkerState);
    }
});

test("activity overlay opens transcription items and runs the status sync action", async ({
    page,
}) => {
    let releasePost = () => {};
    const pendingPost = new Promise<void>((resolve) => {
        releasePost = resolve;
    });
    await mockSyncEndpoint(page, pendingPost);

    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    try {
        await seedActivityRecording(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const panel = await openActivityOverlay(page);

        const item = panel.locator(
            `[data-activity-id="transcription-active-${ACTIVITY_RECORDING_ID}"]`,
        );
        await expect(item).toBeVisible();
        await expect(item).toHaveAttribute("data-clickable", "true");
        await item.getByRole("button", { name: "查看" }).click();
        await expect(panel).toBeHidden();
        await expect(selectedRecordingTitle(page, /E2E activity transcription/)).toContainText(
            "E2E activity transcription",
        );

        await openActivityOverlay(page);
        const statusAction = dashboardControl(page, "dashboard-activity-sync");
        const syncPostRequest = page.waitForRequest(
            (request) =>
                request.url().includes("/api/data-sources/sync") &&
                request.method() === "POST",
        );
        await statusAction.click();
        await syncPostRequest;
        await expect(statusAction).toHaveAttribute("data-action-state", "busy");
        releasePost();
        await expect(statusAction).toHaveAttribute("data-action-state", "done");
        await expect(
            panel.locator('[data-part="dashboard-activity-status"]'),
        ).toContainText("已加入更新");
    } finally {
        await cleanupActivityRecording();
    }
});

test("activity overlay opens recording rows with keyboard activation", async ({
    page,
}) => {
    await mockSyncEndpoint(page, Promise.resolve());

    await ensureSignedIn(page);
    await resetDisplaySettings(page);
    const userId = await getPlaywrightUserId();
    const now = Date.now();

    try {
        await cleanupActivityRecording();
        await seedActivityBackgroundRecording(userId, now);
        await seedActivityRecording(userId, {
            cleanup: false,
            now: now - 180_000,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const backgroundRecording = recordingRow(
            page,
            "E2E activity current selection",
        );
        await expect(backgroundRecording).toBeVisible();
        await backgroundRecording.click();
        await expect(
            selectedRecordingTitle(page, /E2E activity current selection/),
        ).toContainText(
            "E2E activity current selection",
        );

        const panel = await openActivityOverlay(page);

        const activityRecordingRow = panel.locator(
            `[data-activity-id="transcription-active-${ACTIVITY_RECORDING_ID}"][role="button"]`,
        );
        await expect(activityRecordingRow).toBeVisible();
        await expect(activityRecordingRow).toHaveAccessibleName(
            /E2E activity transcription/,
        );
        await expect(activityRecordingRow).toHaveAttribute(
            "data-clickable",
            "true",
        );
        await activityRecordingRow.focus();
        await expect(activityRecordingRow).toBeFocused();

        await page.keyboard.press("Enter");

        await expect(panel).toHaveCount(0);
        await expect(selectedRecordingTitle(page, /E2E activity transcription/)).toContainText(
            "E2E activity transcription",
        );
        await expect(recordingRow(page, "E2E activity transcription")).toHaveAttribute(
            "data-state",
            "selected",
        );
    } finally {
        await cleanupActivityRecording();
    }
});

test("activity overlay follows display language for panel and status copy", async ({
    page,
}) => {
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(healthyWorkerStatus()),
        });
    });

    await ensureSignedIn(page);
    await resetDisplaySettings(page, { theme: "light", uiLanguage: "en" });

    try {
        await reloadDashboardWithDisplaySettings(page, {
            activityLabel: "Notifications",
            theme: "light",
        });

        const panel = await openActivityOverlay(page);
        await expect(panel).toHaveAttribute("aria-label", "Recent activity");
        await expect(
            panel.locator('[data-part="dashboard-activity-title"]'),
        ).toHaveText("Recent activity");
        await expect(panel).toContainText("Last update complete");
        await expect(
            panel.locator('[data-part="dashboard-activity-status"]'),
        ).toContainText("Last updated");
        await expect(dashboardControl(page, "dashboard-activity-sync")).toHaveText(
            "Update",
        );
        await expect(panel).toContainText("Added 0, updated 0, removed 0.");
    } finally {
        await resetDisplaySettings(page);
    }
});
