import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_FIXTURE_PROJECT_ROOT,
} from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const ACTIVITY_RECORDING_ID = "e2e-activity-transcription";
const ACTIVITY_BACKGROUND_RECORDING_ID = "e2e-activity-background";
const ACTIVITY_JOB_ID = "e2e-activity-transcription-job";
const ACTIVITY_RESPONSIVE_EVIDENCE_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/activity-popover-responsive-matrix-20260611",
);
const ACTIVITY_REAL_RUNTIME_EVIDENCE_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/activity-popover-real-runtime-20260611",
);

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
type ActivityResponsiveViewportName = "desktop" | "mobile" | "tablet";

type ActivityEvidenceFrame = {
    blocker: string | null;
    frame: string;
    metrics?: unknown;
    note: string;
    panelScreenshot?: string;
    parityType: "existing-evidence-reference" | "pixel" | "structural";
    productScreenshot?: string;
    screenshot?: string;
    sotScreenshot?: string;
    sourceEvidence?: string;
    state: string;
    viewport?: {
        height: number;
        name: ActivityResponsiveViewportName;
        width: number;
    };
    pixelDiff?: ActivityPixelDiff;
};

type ActivityRuntimeFrameMetrics = {
    documentOverflowX: number;
    panel: {
        left: number;
        position: string;
        right: number;
        width: number;
    };
    trigger: {
        bottom: number;
        right: number;
    };
    viewport: {
        height: number;
        width: number;
    };
};

function readActivityRuntimeMetrics(frame: ActivityEvidenceFrame) {
    if (!frame.metrics || typeof frame.metrics !== "object") {
        throw new Error(`${frame.frame} is missing runtime metrics`);
    }
    return frame.metrics as ActivityRuntimeFrameMetrics;
}

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
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");

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
                    ? "activity-pixel-stage cl-stage cl-pop-host"
                    : "activity-pixel-stage cl-stage";
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

function activityEvidencePath(fileName: string) {
    return path.join(ACTIVITY_RESPONSIVE_EVIDENCE_DIR, fileName);
}

function relativeEvidencePath(filePath: string) {
    return path.relative(ACTIVITY_RESPONSIVE_EVIDENCE_DIR, filePath);
}

async function resetActivityResponsiveEvidenceDir() {
    await fs.rm(ACTIVITY_RESPONSIVE_EVIDENCE_DIR, {
        force: true,
        recursive: true,
    });
    await fs.mkdir(ACTIVITY_RESPONSIVE_EVIDENCE_DIR, { recursive: true });
}

async function captureActivityRuntimeResponsiveFrame(
    page: Page,
    frame: {
        height: number;
        name: ActivityResponsiveViewportName;
        state: "worker-down";
        width: number;
    },
): Promise<ActivityEvidenceFrame> {
    await page.setViewportSize({ height: frame.height, width: frame.width });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
        document.body.dataset.theme = "light";
    });

    const panel = await openActivityOverlay(page);
    const trigger = sotControl(page, "dashboard-activity");
    await expect(trigger).toHaveAttribute("data-unread", "1");
    await expect(panel).toHaveAttribute("data-sot-state", "error");
    await expect(panel.locator('[data-sot-activity-id="worker-unavailable"]'))
        .toHaveAttribute("data-kind", "worker-down");

    const metrics = await panel.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const triggerNode = document.querySelector(
            '[data-sot-control="dashboard-activity"]',
        );
        if (!(triggerNode instanceof HTMLElement)) {
            throw new Error("Missing activity trigger");
        }
        const triggerRect = triggerNode.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const item = node.querySelector('[data-sot-item="dashboard-activity-item"]');
        const itemRect = item?.getBoundingClientRect() ?? null;

        return {
            documentOverflowX:
                document.documentElement.scrollWidth - window.innerWidth,
            item: itemRect
                ? {
                      height: Math.round(itemRect.height * 1000) / 1000,
                      width: Math.round(itemRect.width * 1000) / 1000,
                  }
                : null,
            panel: {
                bottom: Math.round(rect.bottom * 1000) / 1000,
                height: Math.round(rect.height * 1000) / 1000,
                left: Math.round(rect.left * 1000) / 1000,
                maxHeight: style.maxHeight,
                maxWidth: style.maxWidth,
                position: style.position,
                right: Math.round((window.innerWidth - rect.right) * 1000) /
                    1000,
                top: Math.round(rect.top * 1000) / 1000,
                width: Math.round(rect.width * 1000) / 1000,
            },
            trigger: {
                bottom: Math.round(triggerRect.bottom * 1000) / 1000,
                height: Math.round(triggerRect.height * 1000) / 1000,
                left: Math.round(triggerRect.left * 1000) / 1000,
                right:
                    Math.round((window.innerWidth - triggerRect.right) * 1000) /
                    1000,
                top: Math.round(triggerRect.top * 1000) / 1000,
                width: Math.round(triggerRect.width * 1000) / 1000,
            },
            viewport: {
                height: window.innerHeight,
                width: window.innerWidth,
            },
        };
    });

    const blockers: string[] = [];
    if (metrics.documentOverflowX > 1) {
        blockers.push(`document overflow-x ${metrics.documentOverflowX}px`);
    }
    if (metrics.panel.left < 0) {
        blockers.push(`panel left overflow ${metrics.panel.left}px`);
    }
    if (metrics.panel.right < 0) {
        blockers.push(`panel right overflow ${metrics.panel.right}px`);
    }
    if (metrics.panel.width > metrics.viewport.width) {
        blockers.push(
            `panel width ${metrics.panel.width}px exceeds viewport ${metrics.viewport.width}px`,
        );
    }
    if (metrics.panel.bottom > metrics.viewport.height) {
        blockers.push(
            `panel bottom ${metrics.panel.bottom}px exceeds viewport ${metrics.viewport.height}px`,
        );
    }

    if (frame.width <= 640) {
        if (Math.abs(metrics.panel.left - 12) > 2) {
            blockers.push(
                `mobile left gutter expected 12px, got ${metrics.panel.left}px`,
            );
        }
        if (Math.abs(metrics.panel.right - 12) > 2) {
            blockers.push(
                `mobile right gutter expected 12px, got ${metrics.panel.right}px`,
            );
        }
        if (
            Math.abs(metrics.panel.width - (metrics.viewport.width - 24)) > 2
        ) {
            blockers.push(
                `mobile width expected ${metrics.viewport.width - 24}px, got ${metrics.panel.width}px`,
            );
        }
        if (metrics.panel.position !== "fixed") {
            blockers.push(
                `mobile panel position expected fixed, got ${metrics.panel.position}`,
            );
        }
    } else if (frame.width <= 860) {
        if (Math.abs(metrics.panel.left - 12) > 2) {
            blockers.push(
                `tablet left gutter expected 12px, got ${metrics.panel.left}px`,
            );
        }
        if (metrics.panel.position !== "fixed") {
            blockers.push(
                `tablet panel position expected fixed, got ${metrics.panel.position}`,
            );
        }
        if (metrics.panel.width > 380) {
            blockers.push(
                `tablet panel width expected <= 380px, got ${metrics.panel.width}px`,
            );
        }
    } else {
        if (metrics.panel.width > 380) {
            blockers.push(`panel width expected <= 380px, got ${metrics.panel.width}px`);
        }
        if (Math.abs(metrics.panel.right - metrics.trigger.right) > 16) {
            blockers.push(
                `right anchor drift expected <=16px, got ${Math.abs(
                    metrics.panel.right - metrics.trigger.right,
                )}px`,
            );
        }
        if (metrics.panel.top < metrics.trigger.bottom) {
            blockers.push(
                `panel top ${metrics.panel.top}px overlaps trigger bottom ${metrics.trigger.bottom}px`,
            );
        }
    }

    const screenshotPath = activityEvidencePath(
        `activity-responsive-runtime-${frame.name}-worker-down-viewport.png`,
    );
    const panelScreenshotPath = activityEvidencePath(
        `activity-responsive-runtime-${frame.name}-worker-down-panel.png`,
    );
    await page.screenshot({
        animations: "disabled",
        fullPage: false,
        path: screenshotPath,
    });
    await panel.screenshot({
        animations: "disabled",
        path: panelScreenshotPath,
    });

    return {
        blocker: blockers.length > 0 ? blockers.join("; ") : null,
        frame: `runtime-${frame.name}-worker-down`,
        metrics,
        note: "Product runtime worker-down state. Structural responsive geometry only; not pixel parity.",
        panelScreenshot: relativeEvidencePath(panelScreenshotPath),
        parityType: "structural",
        screenshot: relativeEvidencePath(screenshotPath),
        state: frame.state,
        viewport: {
            height: frame.height,
            name: frame.name,
            width: frame.width,
        },
    };
}

async function captureActivityDesktopPixelFrame(
    page: Page,
    sotPage: Page,
    sotActivityHtml: Awaited<ReturnType<typeof readSotActivityHtml>>,
): Promise<ActivityEvidenceFrame[]> {
    await page.setViewportSize({ height: 760, width: 1280 });
    await sotPage.setViewportSize({ height: 760, width: 1280 });

    const panelState: ActivityPanelSotState = "worker-down";
    const comparisons = [
        ...ACTIVITY_TRIGGER_SOT_STATES.map((triggerState) => ({
            frame: `sot-desktop-trigger-${triggerState}`,
            html: sotActivityHtml.triggers[triggerState],
            kind: "trigger" as const,
            note: "Retested desktop baseline trigger badge as SOT DOM under SOT CSS versus same DOM under product CSS.",
            state: triggerState,
        })),
        {
            frame: `sot-desktop-panel-${panelState}`,
            html: sotActivityHtml.panels[panelState],
            kind: "panel" as const,
            note: "Retested desktop baseline Activity panel as SOT DOM under SOT CSS versus same DOM under product CSS.",
            state: panelState,
        },
    ];

    const frames: ActivityEvidenceFrame[] = [];
    for (const comparison of comparisons) {
        const [sotCapture, productCapture] = await Promise.all([
            captureActivityFixture(sotPage, comparison.kind, comparison.html),
            captureActivityFixture(page, comparison.kind, comparison.html),
        ]);
        const pixelDiff = await compareActivityPixels(
            page,
            sotCapture.dataUrl,
            productCapture.dataUrl,
        );
        const sotScreenshotPath = activityEvidencePath(
            `${comparison.frame}-sot.png`,
        );
        const productScreenshotPath = activityEvidencePath(
            `${comparison.frame}-product.png`,
        );
        await fs.writeFile(sotScreenshotPath, sotCapture.screenshot);
        await fs.writeFile(productScreenshotPath, productCapture.screenshot);

        const diffLabel = `${comparison.frame} ${JSON.stringify(pixelDiff)}`;
        expect(pixelDiff.dimensionsMatch, diffLabel).toBe(true);
        expect(pixelDiff.differingPixels, diffLabel).toBe(0);
        expect(pixelDiff.maxChannelDelta, diffLabel).toBe(0);

        frames.push({
            blocker: null,
            frame: comparison.frame,
            metrics: {
                product: productCapture.metrics,
                sot: sotCapture.metrics,
            },
            note: comparison.note,
            parityType: "pixel",
            pixelDiff,
            productScreenshot: relativeEvidencePath(productScreenshotPath),
            sotScreenshot: relativeEvidencePath(sotScreenshotPath),
            state: comparison.state,
            viewport: {
                height: 760,
                name: "desktop",
                width: 1280,
            },
        });
    }

    return frames;
}

async function captureExistingRuntimeReferenceFrame(): Promise<ActivityEvidenceFrame> {
    const sourceScreenshot = path.join(
        ACTIVITY_REAL_RUNTIME_EVIDENCE_DIR,
        "activity-warn-summary-mobile-iab.png",
    );
    const sourceJson = path.join(
        ACTIVITY_REAL_RUNTIME_EVIDENCE_DIR,
        "activity-real-runtime-states.json",
    );
    const copiedScreenshot = activityEvidencePath(
        "existing-real-runtime-warn-summary-mobile-iab.png",
    );
    await fs.copyFile(sourceScreenshot, copiedScreenshot);

    return {
        blocker: null,
        frame: "existing-real-runtime-warn-summary-mobile",
        note: "Copied from existing backend-seeded real runtime evidence. This is a reference frame only; it is not used as pixel parity.",
        parityType: "existing-evidence-reference",
        screenshot: relativeEvidencePath(copiedScreenshot),
        sourceEvidence: path.relative(
            ACTIVITY_RESPONSIVE_EVIDENCE_DIR,
            sourceJson,
        ),
        state: "warn-summary",
        viewport: {
            height: 844,
            name: "mobile",
            width: 390,
        },
    };
}

async function writeActivityResponsiveEvidence(frames: ActivityEvidenceFrame[]) {
    const tabletFrame = frames.find(
        (frame) => frame.frame === "runtime-tablet-worker-down",
    );
    const tabletMetrics = tabletFrame
        ? readActivityRuntimeMetrics(tabletFrame)
        : null;
    const desktopTriggerDiffs = ACTIVITY_TRIGGER_SOT_STATES.map((state) => {
        const triggerFrame = frames.find(
            (frame) => frame.frame === `sot-desktop-trigger-${state}`,
        );
        return `${state} differingPixels=${triggerFrame?.pixelDiff?.differingPixels ?? "n/a"}/maxChannelDelta=${triggerFrame?.pixelDiff?.maxChannelDelta ?? "n/a"}`;
    }).join("; ");
    const desktopPanelFrame = frames.find(
        (frame) => frame.frame === "sot-desktop-panel-worker-down",
    );
    const evidence = {
        generatedAt: new Date().toISOString(),
        matrixRow: 99,
        scope: "Activity popover responsive/mobile matrix only",
        sotSources: {
            componentLibrary: path.join(
                SOT_FIXTURE_PROJECT_ROOT,
                "ui_kits/web/component-library.html#activity",
            ),
            runtimeIndex: path.join(
                SOT_FIXTURE_PROJECT_ROOT,
                "ui_kits/web/index.html#notif-panel",
            ),
            styles: `${path.join(
                SOT_FIXTURE_PROJECT_ROOT,
                "ui_kits/web/kit.css",
            )} .notif-*`,
        },
        productSources: {
            runtime:
                "src/features/dashboard/workstation.tsx activityItems/activityItemKind/[data-sot-panel=\"dashboard-activity\"]",
            styles: "src/app/globals.css [data-sot-panel=\"dashboard-activity\"] responsive rules",
        },
        runtimeBoundary: {
            independentPartialFailedKindHandledThisRound: true,
            note: "Current product runtime emits source-sync-summary as data-kind=\"partial-failed\" when workerStatus.lastSummary.errorCount > 0. This responsive matrix still focuses worker-down frames; the sibling Activity E2E covers the partial-failed runtime branch.",
        },
        frames,
        result: {
            status: "partial",
            remainingGaps: [
                "This is row 99 focused responsive/mobile evidence only, not global all-page/all-control acceptance.",
                "Partial-failed runtime kind is covered by the sibling Activity E2E, but this responsive matrix does not add separate partial-failed mobile/tablet/desktop screenshots.",
            ],
        },
    };

    await fs.writeFile(
        activityEvidencePath("activity-popover-responsive-matrix.json"),
        `${JSON.stringify(evidence, null, 2)}\n`,
    );

    const mdLines = [
        "# Activity Popover Responsive Matrix Evidence",
        "",
        "Scope: SOT row 99 only. This run covers Activity popover responsive/mobile matrix evidence and does not claim global all-page/all-control acceptance.",
        "",
        "## Fix Read-back",
        "",
        tabletMetrics
            ? `- Tablet runtime worker-down overflow fixed: panel left=${tabletMetrics.panel.left}px; right=${tabletMetrics.panel.right}px; documentOverflowX=${tabletMetrics.documentOverflowX}px; blocker=${tabletFrame?.blocker ?? "none"}.`
            : "- Tablet runtime worker-down overflow read-back missing.",
        `- Desktop SOT trigger pixel parity preserved: ${desktopTriggerDiffs}.`,
        `- Desktop SOT panel pixel parity preserved: worker-down differingPixels=${desktopPanelFrame?.pixelDiff?.differingPixels ?? "n/a"}/maxChannelDelta=${desktopPanelFrame?.pixelDiff?.maxChannelDelta ?? "n/a"}.`,
        "",
        "## Frames",
        "",
        ...frames.map((frame) => {
            const viewport = frame.viewport
                ? `${frame.viewport.name} ${frame.viewport.width}x${frame.viewport.height}`
                : "n/a";
            const screenshots = [
                frame.screenshot,
                frame.panelScreenshot,
                frame.sotScreenshot,
                frame.productScreenshot,
            ]
                .filter(Boolean)
                .join(", ");
            const diff = frame.pixelDiff
                ? `; differingPixels=${frame.pixelDiff.differingPixels}; maxChannelDelta=${frame.pixelDiff.maxChannelDelta}`
                : "";
            const blocker = frame.blocker ? `; blocker=${frame.blocker}` : "";
            return `- ${frame.frame}: ${frame.parityType}; state=${frame.state}; viewport=${viewport}; screenshots=${screenshots}${diff}${blocker}`;
        }),
        "",
        "## Remaining Gaps",
        "",
        "- Runtime independent `partial-failed` is covered by the sibling Activity E2E through `source-sync-summary[data-kind=\"partial-failed\"]`; this responsive matrix does not add separate partial-failed mobile/tablet/desktop screenshots.",
        "- This evidence is row 99 local补证 only and does not close full all-page/all-control acceptance.",
        "",
    ];
    await fs.writeFile(
        activityEvidencePath("evidence.md"),
        `${mdLines.join("\n")}\n`,
    );
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

async function mockSyncEndpoint(page: Page, releasePost: Promise<void>) {
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
                body: JSON.stringify(unhealthyWorkerStatus()),
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
    await expect(sotControl(page, "dashboard-activity")).toHaveAttribute(
        "aria-label",
        expectations.activityLabel,
    );
}

function sotControl(page: Page, name: string) {
    return page.locator(`[data-sot-control="${name}"]`);
}

function sotPanel(page: Page, name: string) {
    return page.locator(`[data-sot-panel="${name}"]`);
}

function recordingRow(page: Page, title: string) {
    return page
        .locator('[data-sot-control="dashboard-recording-row"]')
        .filter({ hasText: title });
}

function selectedRecordingTitle(page: Page, title: string | RegExp) {
    return page.getByRole("heading", { name: title });
}

async function openActivityOverlay(page: Page) {
    const surface = page.locator('[data-sot-surface="dashboard-workstation"]');
    const trigger = sotControl(page, "dashboard-activity");
    const panel = sotPanel(page, "dashboard-activity");

    await expect(surface).toHaveAttribute("data-sot-state", "ready");
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
    const panel = sotPanel(page, "dashboard-activity");
    await expect(panel).toBeVisible();
}

async function expectActivityAnchoredToTrigger(page: Page) {
    const panel = sotPanel(page, "dashboard-activity");
    await expect(panel).toBeVisible();

    const metrics = await panel.evaluate((node) => {
        const panelRect = node.getBoundingClientRect();
        const trigger = document.querySelector(
            '[data-sot-control="dashboard-activity"]',
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
    const panel = sotPanel(page, "dashboard-activity");
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

    const runtimeTrigger = sotControl(page, "dashboard-activity");
    await expect(runtimeTrigger).toBeVisible();
    await expect(runtimeTrigger).toHaveAttribute("data-slot", "button");
    await expect(runtimeTrigger).toHaveAttribute("data-variant", "ghost");
    await expect(runtimeTrigger).toHaveAttribute("data-size", "icon-sm");
    await expect(
        runtimeTrigger.locator('[data-sot-part="dashboard-activity-badge"]'),
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

test("Activity responsive matrix records row 99 mobile tablet desktop evidence", async ({
    page,
}) => {
    test.setTimeout(180_000);
    await resetActivityResponsiveEvidenceDir();
    await mockSyncEndpoint(page, Promise.resolve());

    await ensureSignedIn(page);
    await resetDisplaySettings(page, { theme: "light", uiLanguage: "zh-CN" });

    const frames: ActivityEvidenceFrame[] = [];
    for (const frame of [
        { height: 844, name: "mobile" as const, state: "worker-down" as const, width: 390 },
        { height: 900, name: "tablet" as const, state: "worker-down" as const, width: 768 },
        { height: 760, name: "desktop" as const, state: "worker-down" as const, width: 1280 },
    ]) {
        frames.push(await captureActivityRuntimeResponsiveFrame(page, frame));
    }

    const sotPage = await page.context().newPage();
    try {
        await openSotComponentLibrary(sotPage);
        const sotActivityHtml = await readSotActivityHtml(sotPage);
        frames.push(
            ...(await captureActivityDesktopPixelFrame(
                page,
                sotPage,
                sotActivityHtml,
            )),
        );
    } finally {
        await sotPage.close();
    }

    frames.push(await captureExistingRuntimeReferenceFrame());
    await writeActivityResponsiveEvidence(frames);

    const evidence = JSON.parse(
        await fs.readFile(
            activityEvidencePath("activity-popover-responsive-matrix.json"),
            "utf8",
        ),
    ) as { frames: ActivityEvidenceFrame[]; matrixRow: number };
    expect(evidence.matrixRow).toBe(99);
    expect(evidence.frames.map((frame) => frame.parityType)).toContain(
        "pixel",
    );
    expect(evidence.frames.map((frame) => frame.parityType)).toContain(
        "structural",
    );
    expect(evidence.frames.map((frame) => frame.parityType)).toContain(
        "existing-evidence-reference",
    );
    expect(evidence.frames.some((frame) => frame.viewport?.name === "mobile"))
        .toBe(true);
    expect(evidence.frames.some((frame) => frame.viewport?.name === "tablet"))
        .toBe(true);
    expect(evidence.frames.some((frame) => frame.viewport?.name === "desktop"))
        .toBe(true);

    const tabletFrame = evidence.frames.find(
        (frame) => frame.frame === "runtime-tablet-worker-down",
    );
    expect(tabletFrame, "runtime-tablet-worker-down evidence frame")
        .toBeDefined();
    if (!tabletFrame) {
        throw new Error("Missing runtime-tablet-worker-down evidence frame");
    }
    expect(tabletFrame.blocker).toBeNull();
    const tabletMetrics = readActivityRuntimeMetrics(tabletFrame);
    expect(tabletMetrics.documentOverflowX).toBe(0);
    expect(tabletMetrics.panel.left).toBeGreaterThanOrEqual(0);
    expect(tabletMetrics.panel.right).toBeGreaterThanOrEqual(0);

    for (const frameName of [
        ...ACTIVITY_TRIGGER_SOT_STATES.map(
            (state) => `sot-desktop-trigger-${state}`,
        ),
        "sot-desktop-panel-worker-down",
    ]) {
        const pixelFrame = evidence.frames.find(
            (frame) => frame.frame === frameName,
        );
        expect(pixelFrame, `${frameName} evidence frame`).toBeDefined();
        if (!pixelFrame) {
            throw new Error(`Missing ${frameName} evidence frame`);
        }
        expect(pixelFrame.blocker, frameName).toBeNull();
        expect(pixelFrame.pixelDiff?.dimensionsMatch, frameName).toBe(true);
        expect(pixelFrame.pixelDiff?.differingPixels, frameName).toBe(0);
        expect(pixelFrame.pixelDiff?.maxChannelDelta, frameName).toBe(0);
    }
});

test("activity overlay opens data source settings for worker-down notifications", async ({
    page,
}) => {
    await mockSyncEndpoint(page, Promise.resolve());

    await ensureSignedIn(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = sotControl(page, "dashboard-activity");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-label", "通知");
    await expect(trigger).toHaveAttribute("data-unread", "1");

    const panel = await openActivityOverlay(page);
    await expectActivityPortalOverlay(page);
    await expectActivityAnchoredToTrigger(page);
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-heading"]'),
    ).toBeVisible();
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-count"]'),
    ).toContainText("1 项待处理");

    const item = panel.locator('[data-sot-activity-id="worker-unavailable"]');
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("data-kind", "worker-down");
    await expect(item).toHaveAttribute("data-action-state", "idle");
    await expect(
        item.locator('[data-sot-part="dashboard-activity-item-title"]'),
    ).toContainText(
        "自动更新暂时不可用",
    );
    await expect(
        item.locator('[data-sot-part="dashboard-activity-item-body"]'),
    ).toContainText(
        "本地更新服务未响应。",
    );
    await expect(
        item.locator('[data-sot-part="dashboard-activity-item-meta"]'),
    ).toHaveText("刚刚");

    const action = item.locator('[data-sot-control="dashboard-activity-action"]');
    await expect(item).toHaveAttribute("data-sot-action", "settings");
    await expect(action).toContainText("前往数据源设置");
    await action.click();

    const settingsShell = page.locator('[data-sot-surface="settings-shell"]');
    await expect(panel).toBeHidden();
    await expect(settingsShell).toBeVisible();
    await expect(settingsShell).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    await expect(panel).toHaveCount(0);

    await sotControl(page, "settings-close").click();
    await expect(settingsShell).toBeHidden();
    await expect(sotControl(page, "dashboard-settings")).toBeFocused();
});

test("activity overlay dismisses actionable notifications into an empty state", async ({
    page,
}) => {
    await mockSyncEndpoint(page, Promise.resolve());

    await ensureSignedIn(page);
    await resetDisplaySettings(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = sotControl(page, "dashboard-activity");
    await expect(trigger).toHaveAttribute("aria-label", "通知");
    await expect(trigger).toHaveAttribute("data-unread", "1");

    const panel = await openActivityOverlay(page);
    await expect(panel).toHaveAttribute("data-sot-state", "error");
    await expect(panel).toContainText("1 项待处理");

    const item = panel.locator('[data-sot-activity-id="worker-unavailable"]');
    await expect(item).toBeVisible();
    await item.locator('[data-sot-control="dashboard-activity-dismiss"]').click();

    await expect(item).toHaveCount(0);
    await expect(panel).toHaveAttribute("data-sot-state", "empty");
    await expect(panel).toContainText("全部已处理");
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-empty"]'),
    ).toBeVisible();
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-empty-icon"]'),
    ).toBeVisible();
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-empty-title"]'),
    ).toContainText("没有新的动态");
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-empty-body"]'),
    ).toContainText("来源更新与转写任务都在正常运行");
    await expect(
        panel.locator('[data-sot-list="dashboard-activity-items"]'),
    ).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-label", "通知");
    await expect(trigger).toHaveAttribute("data-unread", "0");
    await expect(
        trigger.locator('[data-sot-part="dashboard-activity-badge"]'),
    ).toBeHidden();

    const closeButton = panel.locator(
        '[data-sot-control="dashboard-activity-close"]',
    );
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

    const trigger = sotControl(page, "dashboard-activity");
    const panel = sotPanel(page, "dashboard-activity");

    await openActivityOverlay(page);
    await expect(panel).toHaveAttribute("data-sot-state", "default");
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-title"]'),
    ).toHaveText("最近动态");
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-count"]'),
    ).toContainText("0 项待处理");
    const status = panel.locator(
        '[data-sot-part="dashboard-activity-status"]',
    );
    await expect(status).toHaveAttribute("data-sot-state", "idle");
    await expect(
        status.locator('[data-sot-part="dashboard-activity-status-line"]'),
    ).toBeVisible();
    await expect(
        status.locator('[data-sot-part="dashboard-activity-status-sub"]'),
    ).toContainText("上次更新于");
    const summaryItem = panel.locator(
        '[data-sot-activity-id="source-sync-summary"]',
    );
    await expect(summaryItem).toBeVisible();
    await expect(summaryItem).toHaveAttribute("data-kind", "success");
    await expect(summaryItem).toContainText("最近一次更新完成");
    await expect(summaryItem).toContainText("新增 0，更新 0，移除 0。");
    await expect(
        summaryItem.locator(
            '[data-sot-part="dashboard-activity-item-title"]',
        ),
    ).toContainText(
        "最近一次更新完成",
    );
    await expect(
        summaryItem.locator('[data-sot-part="dashboard-activity-item-body"]'),
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
    await expect(panel).toHaveAttribute("data-sot-state", "error");
    await expect(status).toHaveAttribute("data-sot-state", "error");
    await expect(
        status.locator('[data-sot-part="dashboard-activity-status-line"]'),
    ).toHaveText("部分来源更新失败");
    await expect(
        status.locator('[data-sot-part="dashboard-activity-status-sub"]'),
    ).toContainText("2 个来源更新失败，稍后可重试。");
    const partialSummaryItem = panel.locator(
        '[data-sot-activity-id="source-sync-summary"]',
    );
    await expect(partialSummaryItem).toBeVisible();
    await expect(partialSummaryItem).toHaveAttribute(
        "data-kind",
        "partial-failed",
    );
    await expect(partialSummaryItem).toHaveAttribute("data-sot-state", "warn");
    await expect(
        partialSummaryItem.locator(
            '[data-sot-part="dashboard-activity-item-title"]',
        ),
    ).toContainText(
        "部分来源更新失败",
    );
    await expect(
        partialSummaryItem.locator(
            '[data-sot-part="dashboard-activity-item-body"]',
        ),
    ).toContainText(
        "新增 3，更新 5，移除 1，失败 2。",
    );
    await expect(
        partialSummaryItem.locator(
            '[data-sot-control="dashboard-activity-action"]',
        ),
    ).toHaveText("重试");

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();

    statusMode = "syncing";
    await page.reload({ waitUntil: "domcontentloaded" });

    await openActivityOverlay(page);
    await expect(panel).toHaveAttribute("data-sot-state", "loading");
    await expect(
        panel.locator('[data-sot-part="dashboard-activity-status"]'),
    ).toHaveAttribute("data-sot-state", "running");
    await expect(
        panel.locator('[data-sot-item="dashboard-activity-item"]').first(),
    ).toContainText("正在更新来源");
    await expect(
        panel.locator('[data-sot-item="dashboard-activity-item"]').first(),
    ).toHaveAttribute("data-kind", "queued");
    await expectActivityPortalOverlay(page);

    await page.setViewportSize({ width: 390, height: 740 });
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await openActivityOverlay(page);
    await expectActivityMobileLayout(page);
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
            `[data-sot-activity-id="transcription-active-${ACTIVITY_RECORDING_ID}"]`,
        );
        await expect(item).toBeVisible();
        await expect(item).toHaveAttribute("data-clickable", "true");
        await item.locator('[data-sot-control="dashboard-activity-action"]').click();
        await expect(panel).toBeHidden();
        await expect(selectedRecordingTitle(page, /E2E activity transcription/)).toContainText(
            "E2E activity transcription",
        );

        await openActivityOverlay(page);
        const statusAction = sotControl(page, "dashboard-activity-sync");
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
            panel.locator('[data-sot-part="dashboard-activity-status"]'),
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
            `[data-sot-activity-id="transcription-active-${ACTIVITY_RECORDING_ID}"][role="button"]`,
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
            "data-sot-state",
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
            panel.locator('[data-sot-part="dashboard-activity-title"]'),
        ).toHaveText("Recent activity");
        await expect(panel).toContainText("Last update complete");
        await expect(
            panel.locator('[data-sot-part="dashboard-activity-status"]'),
        ).toContainText("Last updated");
        await expect(sotControl(page, "dashboard-activity-sync")).toHaveText(
            "Update",
        );
        await expect(panel).toContainText("Added 0, updated 0, removed 0.");
    } finally {
        await resetDisplaySettings(page);
    }
});
