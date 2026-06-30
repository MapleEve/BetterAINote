import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import {
    type BrowserContext,
    expect,
    type Locator,
    type Page,
    test,
    type TestInfo,
} from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_FIXTURE_WEB_ROOT,
    SOT_SOURCE_ASSET_DIR,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const LIST_RECORDING_PREFIX = "e2e-list-state-";

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
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const LIST_FRAME_DEBUG_DIR = path.resolve(
    process.cwd(),
    "tmp/debug-list-frame",
);
const SOT_COLORS_AND_TYPE_CSS_PATH = path.resolve(
    SOT_FIXTURE_WEB_ROOT,
    "..",
    "..",
    "colors_and_type.css",
);
const SOT_KIT_CSS_PATH = path.join(SOT_FIXTURE_WEB_ROOT, "kit.css");
let sotWorkstationCssCache: string | null = null;
const SOT_PIXEL_DEV_OVERLAY_HIDDEN_CSS = `
    nextjs-portal,
    [data-nextjs-toast],
    [data-nextjs-dialog-overlay],
    [data-nextjs-dialog-backdrop],
    [data-nextjs-dialog],
    [data-nextjs-errors],
    [data-nextjs-dev-tools-button],
    button[aria-label="Open Next.js Dev Tools"],
    .__nextjs-dev-overlay {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }
`;
const LIST_ROW_MIGRATION_FIXTURE_CSS = `
    .real-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px;
    }
    .real-list .day {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 6px 4px;
    }
    .real-list .day .d {
        font: 700 11px var(--font-sans);
        color: var(--fg-tertiary);
        letter-spacing: 0.04em;
    }
    .real-list .day .c {
        font: 500 11px var(--font-mono);
        color: var(--fg-disabled);
    }
    .real-list .day .line {
        flex: 1;
        height: 1px;
        background: var(--line-hairline);
        margin-left: 4px;
    }
    .real-list .row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 14px;
        padding: 11px 12px;
        border-radius: 10px;
        cursor: pointer;
        border: 1px solid transparent;
        background: transparent;
        width: 100%;
        text-align: left;
        font: 13.3333px var(--font-sans);
        transition:
            background var(--duration-fast) var(--ease-out),
            border-color var(--duration-fast) var(--ease-out);
    }
    .real-list .row:hover {
        background: var(--bg-recessed);
    }
    .real-list .row.active {
        background: var(--accent-soft);
        border-color: color-mix(in srgb, var(--accent) 38%, transparent);
    }
    .real-list .body {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .real-list .title {
        font: 600 13.5px var(--font-sans);
        color: var(--fg-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        letter-spacing: -0.005em;
    }
    .real-list .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
    .real-list .meta .dur {
        font: 500 11.5px var(--font-mono);
        color: var(--fg-secondary);
        letter-spacing: 0.02em;
    }
    .real-list .meta2 {
        display: flex;
        align-items: center;
        gap: 8px;
        font: 500 11px var(--font-mono);
        color: var(--fg-tertiary);
    }
    .real-list .meta2 .ts {
        letter-spacing: 0.015em;
    }
    .real-list .ts-abs {
        display: none;
    }
    .real-list .ts-rel {
        display: inline;
    }
    body[data-time-style="abs"] .real-list .ts-abs {
        display: inline;
    }
    body[data-time-style="abs"] .real-list .ts-rel {
        display: none;
    }
    .real-list .right,
    .real-list [data-sot-part="dashboard-recording-row-actions"] {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .b,
    [data-sot-part="dashboard-recording-status"] {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 20px;
        padding: 0 8px;
        border-radius: 999px;
        font: 600 11px var(--font-sans);
        border: 1px solid transparent;
        letter-spacing: 0.005em;
    }
    .b .dot,
    [data-sot-part="dashboard-recording-status-dot"] {
        display: inline-block;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
        margin-right: 4px;
    }
    .b .dot.status-dot-muted,
    [data-sot-part="dashboard-recording-status"][data-sot-tone="neu"] [data-sot-part="dashboard-recording-status-dot"],
    [data-sot-part="dashboard-recording-status-dot"][data-sot-tone="neu"] {
        background: var(--fg-tertiary);
    }
    .b.ok,
    [data-sot-part="dashboard-recording-status"][data-sot-tone="ok"] {
        background: color-mix(in srgb, var(--signal-success) 14%, transparent);
        color: var(--signal-success);
        border-color: color-mix(in srgb, var(--signal-success) 30%, transparent);
    }
    .b.warn,
    [data-sot-part="dashboard-recording-status"][data-sot-tone="warn"] {
        background: color-mix(in srgb, var(--signal-warning) 18%, transparent);
        color: oklch(0.55 0.16 70);
        border-color: color-mix(in srgb, var(--signal-warning) 32%, transparent);
    }
    .b.err,
    [data-sot-part="dashboard-recording-status"][data-sot-tone="err"] {
        background: color-mix(in srgb, var(--signal-danger) 14%, transparent);
        color: var(--signal-danger);
        border-color: color-mix(in srgb, var(--signal-danger) 30%, transparent);
    }
    .b.info,
    [data-sot-part="dashboard-recording-status"][data-sot-tone="info"] {
        background: color-mix(in srgb, var(--signal-info) 14%, transparent);
        color: var(--signal-info);
        border-color: color-mix(in srgb, var(--signal-info) 30%, transparent);
    }
    .b.neu,
    [data-sot-part="dashboard-recording-status"][data-sot-tone="neu"] {
        background: var(--bg-recessed);
        color: var(--fg-secondary);
        border-color: var(--line-hairline);
    }
    .b.warn .dot,
    [data-sot-part="dashboard-recording-status"][data-sot-tone="warn"] [data-sot-part="dashboard-recording-status-dot"] {
        animation: bpulse 1.4s ease-in-out infinite;
    }
    [data-theme="dark"] .b.warn,
    [data-theme="dark"] [data-sot-part="dashboard-recording-status"][data-sot-tone="warn"] {
        color: oklch(0.78 0.14 80);
    }
    .src-mini {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        flex: 0 0 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        opacity: 0.55;
    }
    .src-mini img {
        width: 14px !important;
        height: 14px !important;
        object-fit: contain;
        display: block;
        filter: grayscale(1) contrast(0.85);
    }
    .src-mini.cover img {
        object-fit: cover;
    }
    .src-mini.src-mini-letter {
        font: 700 9px var(--font-sans);
        color: var(--fg-tertiary);
        background: var(--bg-recessed);
        border: 1px solid var(--line-hairline);
    }
    [data-theme="dark"] .src-mini {
        opacity: 0.6;
    }
    [data-theme="dark"] .src-mini img {
        filter: grayscale(1) brightness(1.4) contrast(0.85);
    }
    [data-theme="dark"] .src-mini.src-mini-letter {
        background: rgb(255 255 255 / 0.06);
        border-color: var(--glass-border);
    }
    .utag,
    [data-recording-tag-chip] {
        --tag-c: var(--graphite-500);
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 22px;
        padding: 0 9px 0 7px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--tag-c) 12%, var(--bg-elevated));
        border: 1px solid color-mix(in srgb, var(--tag-c) 32%, transparent);
        color: color-mix(in srgb, var(--tag-c) 72%, var(--fg-primary));
        font: 600 11.5px var(--font-sans);
        box-shadow: var(--shadow-xs);
    }
    .utag svg,
    [data-recording-tag-chip] svg {
        width: 11px;
        height: 11px;
        flex: none;
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .utag.c-blue,
    [data-recording-tag-chip][data-sot-tag-color="blue"] {
        --tag-c: oklch(0.580 0.130 235);
    }
    .utag.c-violet,
    [data-recording-tag-chip][data-sot-tag-color="purple"] {
        --tag-c: oklch(0.560 0.150 285);
    }
    .utag.c-rose,
    [data-recording-tag-chip][data-sot-tag-color="red"] {
        --tag-c: oklch(0.595 0.165 18);
    }
    .utag.c-amber,
    [data-recording-tag-chip][data-sot-tag-color="orange"] {
        --tag-c: oklch(0.620 0.140 70);
    }
    .utag.c-green,
    [data-recording-tag-chip][data-sot-tag-color="green"] {
        --tag-c: oklch(0.560 0.130 158);
    }
    .utag.c-slate,
    [data-recording-tag-chip][data-sot-tag-color="slate"] {
        --tag-c: oklch(0.580 0.020 250);
    }
    [data-theme="dark"] .utag,
    [data-theme="dark"] [data-recording-tag-chip] {
        background: color-mix(in srgb, var(--tag-c) 18%, transparent);
        color: color-mix(in srgb, var(--tag-c) 30%, var(--fg-primary));
        border-color: color-mix(in srgb, var(--tag-c) 36%, transparent);
    }
    .utag-plus {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 22px;
        padding: 0 8px;
        border-radius: 6px;
        background: var(--bg-recessed);
        border: 1px dashed var(--line-hairline);
        font: 600 11px var(--font-sans);
        color: var(--fg-tertiary);
    }
    .list-row-pixel-stage,
    .list-row-pixel-stage *,
    .list-panel-frame-stage,
    .list-panel-frame-stage * {
        box-sizing: border-box !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        font-feature-settings: "ss01", "cv11", "rlig", "calt" !important;
    }
    .list-row-pixel-stage .real-list .row,
    .list-panel-frame-stage .real-list .row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 14px !important;
        padding: 11px 12px !important;
        border: 1px solid transparent !important;
        background: transparent !important;
        width: 100% !important;
        text-align: left !important;
        font: 13.3333px var(--font-sans) !important;
    }
    .list-row-pixel-stage .real-list .body,
    .list-panel-frame-stage .real-list .body {
        min-width: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 5px !important;
    }
    .list-row-pixel-stage .real-list .title,
    .list-panel-frame-stage .real-list .title {
        font: 600 13.5px var(--font-sans) !important;
        color: var(--fg-primary) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }
    .list-row-pixel-stage .real-list .right,
    .list-row-pixel-stage .real-list [data-sot-part="dashboard-recording-row-actions"],
    .list-panel-frame-stage .real-list .right,
    .list-panel-frame-stage .real-list [data-sot-part="dashboard-recording-row-actions"] {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        justify-self: end !important;
        gap: 8px !important;
        flex: none !important;
        min-width: max-content !important;
        width: max-content !important;
    }
    .list-row-pixel-stage .src-mini,
    .list-panel-frame-stage .src-mini {
        display: inline-flex !important;
        flex: 0 0 14px !important;
        width: 14px !important;
        height: 14px !important;
        min-width: 14px !important;
        max-width: 14px !important;
        border-radius: 3px !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: hidden !important;
    }
    .list-row-pixel-stage .src-mini img,
    .list-panel-frame-stage .src-mini img {
        display: block !important;
        width: 14px !important;
        height: 14px !important;
        min-width: 14px !important;
        max-width: none !important;
        object-fit: contain !important;
        vertical-align: baseline !important;
    }
    .list-panel-frame-stage [data-sot-part="source-filter-icon"] img {
        display: block !important;
        width: 14px !important;
        height: 14px !important;
        max-width: none !important;
        object-fit: contain !important;
    }
    .list-row-pixel-stage .b,
    .list-row-pixel-stage .utag,
    .list-row-pixel-stage .utag-plus,
    .list-row-pixel-stage [data-sot-part="dashboard-recording-status"],
    .list-row-pixel-stage [data-recording-tag-chip],
    .list-panel-frame-stage .b,
    .list-panel-frame-stage .utag,
    .list-panel-frame-stage .utag-plus,
    .list-panel-frame-stage [data-sot-part="dashboard-recording-status"],
    .list-panel-frame-stage [data-recording-tag-chip] {
        flex: none !important;
        box-sizing: border-box !important;
    }
`;
const LIST_SKELETON_MIGRATION_FIXTURE_CSS = `
    @keyframes list-sot-skshimmer {
        0% { background-position: 200% 50%; }
        100% { background-position: -100% 50%; }
    }
    .list-skeleton-pixel-stage .sk {
        display: inline-block;
        vertical-align: middle;
        background: linear-gradient(
            90deg,
            rgb(255 255 255 / 0.05) 0%,
            rgb(255 255 255 / 0.12) 50%,
            rgb(255 255 255 / 0.05) 100%
        );
        background-size: 220% 100%;
        animation: list-sot-skshimmer 1.6s ease-in-out infinite;
        border-radius: 6px;
        height: 12px;
    }
    .list-skeleton-pixel-stage .sk-w-100 { width: 100%; }
    .list-skeleton-pixel-stage .sk-w-90 { width: 90%; }
    .list-skeleton-pixel-stage .sk-w-85 { width: 85%; }
    .list-skeleton-pixel-stage .sk-w-80 { width: 80%; }
    .list-skeleton-pixel-stage .sk-w-70 { width: 70%; }
    .list-skeleton-pixel-stage .sk-w-60 { width: 60%; }
    .list-skeleton-pixel-stage .sk-w-40 { width: 40%; }
    .list-skeleton-pixel-stage .skel-list {
        padding: 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .list-skeleton-pixel-stage .skel-list .skel-day {
        padding: 14px 10px 6px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .list-skeleton-pixel-stage .skel-list .sk-day-l {
        width: 100px;
        height: 11px;
    }
    .list-skeleton-pixel-stage .skel-list .skel-day .line {
        flex: 1;
        height: 1px;
        background: var(--line-hairline);
    }
    .list-skeleton-pixel-stage .skel-list .skel-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 14px;
        padding: 11px 12px;
    }
    .list-skeleton-pixel-stage .skel-list .skel-row .body {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }
    .list-skeleton-pixel-stage .skel-list .skel-row .meta {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .list-skeleton-pixel-stage .skel-list .sk-title {
        width: 100%;
        height: 13px;
    }
    .list-skeleton-pixel-stage .skel-list .sk-meta-t {
        width: 80px;
        height: 11px;
    }
    .list-skeleton-pixel-stage .skel-list .sk-meta-tag {
        width: 64px;
        height: 18px;
        border-radius: 6px;
    }
    .list-skeleton-pixel-stage .skel-list .sk-meta-pill {
        width: 64px;
        height: 18px;
        border-radius: 999px;
    }
    .list-skeleton-pixel-stage .skel-list .sk-utag {
        width: 80px;
        height: 22px;
        border-radius: 6px;
    }
`;
const LIST_STATE_BLOCK_MIGRATION_FIXTURE_CSS = `
    .list-state-block-pixel-stage,
    .list-state-block-pixel-stage * {
        box-sizing: border-box !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        font-feature-settings: "ss01", "cv11", "rlig", "calt" !important;
    }
    .list-state-block-pixel-stage .list-state-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 26px 18px;
        text-align: center;
        margin: 8px;
        background: var(--bg-recessed);
        border: 1px dashed var(--line-hairline);
        border-radius: 10px;
    }
    .list-state-block-pixel-stage .list-state-block .lsb-ico,
    .list-state-block-pixel-stage [data-sot-part="recording-list-state-icon"] {
        display: inline-flex;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--bg-elevated);
        border: 1px solid var(--line-hairline);
        color: var(--fg-tertiary);
        align-items: center;
        justify-content: center;
        margin-bottom: 2px;
    }
    .list-state-block-pixel-stage .list-state-block .lsb-ico svg,
    .list-state-block-pixel-stage [data-sot-part="recording-list-state-icon"] svg {
        width: 15px;
        height: 15px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .list-state-block-pixel-stage .list-state-block .lsb-t,
    .list-state-block-pixel-stage [data-sot-part="recording-list-state-title"] {
        font: 600 13px var(--font-sans);
        color: var(--fg-primary);
    }
    .list-state-block-pixel-stage .list-state-block .lsb-h,
    .list-state-block-pixel-stage [data-sot-part="recording-list-state-description"] {
        font: 500 12px / 1.5 var(--font-sans);
        color: var(--fg-tertiary);
        max-width: 300px;
    }
    .list-state-block-pixel-stage .list-state-block.list-state-pagination {
        display: flex;
        background: transparent;
        border: 0;
        padding: 14px;
        align-items: stretch;
    }
    .list-state-block-pixel-stage .list-state-block.list-state-pagination .lsb-page-divider,
    .list-state-block-pixel-stage [data-sot-part="recording-list-page-divider"] {
        position: relative !important;
        height: 1px;
        background: var(--line-hairline);
        margin: 6px 0 14px;
    }
    .list-state-block-pixel-stage .list-state-block.list-state-pagination .lsb-page-divider span,
    .list-state-block-pixel-stage [data-sot-part="recording-list-page-status"] {
        position: absolute !important;
        top: -8px !important;
        left: 50% !important;
        background: var(--bg-elevated);
        padding: 0 10px;
        translate: none !important;
        transform: translate(-50%, -50%) !important;
        width: max-content;
        font: 500 10.5px var(--font-mono);
        color: var(--fg-tertiary);
    }
    .list-state-block-pixel-stage .list-state-block.list-state-pagination .lsb-page-nav,
    .list-state-block-pixel-stage [data-sot-part="recording-list-page-nav"] {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-top: 4px;
    }
    .list-state-block-pixel-stage .list-state-block.list-state-pagination .lsb-page-num,
    .list-state-block-pixel-stage [data-sot-part="recording-list-page-number"] {
        font: 500 11.5px var(--font-mono);
        color: var(--fg-tertiary);
        min-width: 56px;
        text-align: center;
    }
    .list-state-block .btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        height: 32px;
        padding: 0 12px;
        border-radius: 9px;
        font: 600 12.5px var(--font-sans);
        color: var(--fg-primary);
        background: var(--bg-elevated);
        border: 1px solid var(--line-hairline);
        cursor: pointer;
        box-shadow: var(--shadow-xs);
        transition:
            background var(--duration-fast) var(--ease-out),
            transform var(--duration-fast) var(--ease-out);
    }
    .list-state-block .btn.ghost {
        background: transparent;
        border-color: transparent;
        box-shadow: none;
        color: var(--fg-secondary);
    }
    .list-state-block .btn.primary {
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--accent) 92%, white 18%),
            var(--accent)
        );
        border-color: color-mix(in srgb, var(--accent) 60%, black 8%);
        color: white;
        box-shadow:
            0 2px 6px color-mix(in srgb, var(--accent) 24%, transparent),
            inset 0 1px 0 rgb(255 255 255 / 0.22);
    }
    .list-state-block .btn.btn-sm {
        height: 26px;
        padding: 0 10px;
        font-size: 12px;
        border-radius: 7px;
    }
    .list-state-block .btn[disabled],
    .list-state-block .btn[aria-disabled="true"] {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
    }
`;
const DASHBOARD_LIST_STATE_OWNER_CLASS_CONTRACT = {
    listStateAction:
        "h-8 gap-1.5 rounded-md bg-transparent px-3 text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 has-[>svg]:px-2.5",
    listStateDescription:
        "max-w-[300px] font-sans text-[12px] font-medium leading-[1.5] text-[var(--fg-tertiary)]",
    listStateIcon:
        "mb-0.5 inline-flex size-[34px] items-center justify-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-tertiary)] [&_svg]:size-[15px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
    listStatePrimary:
        "h-8 gap-1.5 rounded-md bg-primary px-3 text-primary-foreground shadow-xs hover:bg-primary/90 has-[>svg]:px-2.5",
    listStateRoot:
        "m-2 flex flex-col items-center gap-1.5 rounded-[10px] border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[18px] py-[26px] text-center",
    listStateTitle:
        "font-sans text-[13px] font-semibold text-[var(--fg-primary)]",
    paginationButton:
        "h-8 gap-1.5 rounded-md bg-transparent px-3 text-[var(--fg-secondary)] shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 has-[>svg]:px-2.5",
    paginationDivider:
        "relative mt-1.5 mb-[14px] h-px bg-[var(--line-hairline)]",
    paginationNav: "mt-1 flex items-center justify-center gap-2.5",
    paginationNumber:
        "min-w-14 text-center font-mono text-[11.5px] font-medium text-[var(--fg-tertiary)]",
    paginationRoot:
        "m-2 flex flex-col items-stretch gap-1.5 border-0 bg-transparent p-[14px] text-center",
    paginationStatus:
        "absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-elevated)] px-2.5 font-mono text-[10.5px] font-medium text-[var(--fg-tertiary)]",
} as const;
const SOT_PIXEL_DEV_OVERLAY_STYLE_ATTR = "data-sot-pixel-dev-overlay-fixture";
const LIST_ROW_SOT_STATES = [
    "active-updated",
    "transcribing",
    "updated",
    "local-only",
    "failed",
    "pending",
] as const;
const LIST_ROW_SELECTORS: Record<ListRowSotState, string> = {
    "active-updated": '.real-list .row[data-rec="rec-product-weekly"]',
    failed: '.real-list .row[data-rec="rec-eng-handover"]',
    "local-only": '.real-list .row[data-rec="rec-cs-training"]',
    pending: '.real-list .row[data-rec="rec-market-0410"]',
    transcribing: '.real-list .row[data-rec="rec-wenli-1on1"]',
    updated: '.real-list .row[data-rec="rec-investor-0418"]',
};
const LIST_ROW_SOURCE_ASSETS: Record<string, string> = {
    "../../assets/sources/dingtalk.svg": "dingtalk.svg",
    "../../assets/sources/feishu.jpeg": "feishu.jpeg",
    "../../assets/sources/plaud.png": "plaud.png",
    "../../assets/sources/ticnote.png": "ticnote.png",
};
const LIST_PANEL_FRAME_REQUIRED_RECORDING_IDS = [
    "rec-product-weekly",
    "rec-wenli-1on1",
    "rec-investor-0418",
    "rec-cs-training",
    "rec-eng-handover",
    "rec-market-0410",
] as const;
const LIST_PANEL_FRAME_PRODUCT_ROW_CONTENT_OFFSET = {
    x: 4,
    y: 4,
} as const;
const LIST_PANEL_FRAME_DESKTOP_DIFF_BUDGET = {
    differingPixels: 40,
    maxChannelDelta: 20,
} as const;
const LIST_SKELETON_PIXEL_TOLERANCE = {
    differingPixels: 2,
    maxChannelDelta: 1,
} as const;
const TAG_FILTER_TRIGGER_SOT_STATES = ["all", "single", "untagged"] as const;
const TAG_FILTER_TRIGGER_LABELS: Record<TagFilterTriggerSotState, string> = {
    all: "Trigger · all",
    single: "Trigger · single tag",
    untagged: "Trigger · untagged",
};
const LIST_STATE_BLOCK_SOT_STATES = [
    "empty",
    "no-match",
    "timeline-empty",
    "tag-empty",
    "paginated",
    "paginated-first",
    "paginated-last",
] as const;
const SOT_TAG_COLOR_MATRIX = [
    { color: "purple", className: "utag c-violet" },
    { color: "blue", className: "utag c-blue" },
    { color: "red", className: "utag c-rose" },
    { color: "orange", className: "utag c-amber" },
    { color: "green", className: "utag c-green" },
] as const;
const SOT_TAG_ICON_MATRIX = [
    "grid",
    "user",
    "heart",
    "clock",
    "tag",
    "star",
    "dialog",
    "flag",
    "book",
    "bulb",
    "file",
    "mic",
] as const;
const LIST_ROW_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "border-radius",
    "background-color",
    "color",
    "box-shadow",
    "outline-width",
    "outline-style",
    "outline-color",
    "outline-offset",
] as const;
const LIST_ROW_SHADCN_FOCUS_CLASS_CONTRACT = [
    "focus:!border-ring",
    "focus:!outline-none",
    "focus:!ring-[3px]",
    "focus:!ring-ring/50",
    "focus-visible:!border-ring",
    "focus-visible:!outline-none",
    "focus-visible:!ring-[3px]",
    "focus-visible:!ring-ring/50",
] as const;
const LIST_BADGE_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "border-top-width",
    "border-top-style",
    "border-top-color",
] as const;
const LIST_TAG_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "box-shadow",
    "border-top-width",
    "border-top-style",
    "border-top-color",
] as const;

type ListStyleProp =
    | (typeof LIST_ROW_STYLE_PROPS)[number]
    | (typeof LIST_BADGE_STYLE_PROPS)[number]
    | (typeof LIST_TAG_STYLE_PROPS)[number];
type ListRowSotState = (typeof LIST_ROW_SOT_STATES)[number];
type TagFilterTriggerSotState = (typeof TAG_FILTER_TRIGGER_SOT_STATES)[number];
type ListStateBlockSotState = (typeof LIST_STATE_BLOCK_SOT_STATES)[number];
type SotTagIcon = (typeof SOT_TAG_ICON_MATRIX)[number];
type SvgChildSignature = Array<{
    attributes: Array<readonly [string, string]>;
    tagName: string;
}>;
type ListRowPixelDiff = {
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
type ListPanelFrameCapture = Awaited<
    ReturnType<typeof captureListPanelFrameFixture>
>;

function assertE2EDatabasePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== e2eRoot &&
        !resolvedPath.startsWith(`${e2eRoot}${path.sep}`)
    ) {
        throw new Error(
            `Refusing to touch non-E2E database path: ${resolvedPath}`,
        );
    }
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

async function cleanupListSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifact_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}tag-%`],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function cleanupAllUserRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifact_segments WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM recording_tags WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}tag-%`],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM source_devices WHERE user_id = ?",
            args: [userId],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedListRecordings(userId: string, count = 10) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();

    try {
        await cleanupListSeeds(userId);
        for (let index = 0; index < count; index += 1) {
            const suffix = String(index + 1).padStart(2, "0");
            const recordingId = `${LIST_RECORDING_PREFIX}${suffix}`;
            const start = now - index * 90_000;

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
                    recordingId,
                    userId,
                    "ticnote",
                    `${recordingId}-source`,
                    "1",
                    "{}",
                    "e2e-list-device",
                    `E2E list pagination ${suffix}`,
                    120_000 + index * 1000,
                    start,
                    start + 120_000,
                    2048 + index,
                    recordingId,
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            });
        }
    } finally {
        await library.close();
    }
}

async function seedMultiTagRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const recordingId = `${LIST_RECORDING_PREFIX}multi-tag`;
    const alphaTagId = `${LIST_RECORDING_PREFIX}tag-alpha`;
    const betaTagId = `${LIST_RECORDING_PREFIX}tag-beta`;

    try {
        await cleanupListSeeds(userId);
        await library.batch([
            {
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    recordingId,
                    userId,
                    "ticnote",
                    `${recordingId}-source`,
                    "1",
                    "{}",
                    "e2e-list-device",
                    "E2E multi tag recording",
                    120_000,
                    now,
                    now + 120_000,
                    2048,
                    recordingId,
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            },
            {
                sql: `
                    INSERT OR REPLACE INTO recording_tags (
                        id, user_id, name, color, icon, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    alphaTagId,
                    userId,
                    "Alpha",
                    "blue",
                    "tag",
                    now,
                    now,
                    betaTagId,
                    userId,
                    "Beta",
                    "purple",
                    "star",
                    now,
                    now,
                ],
            },
            {
                sql: `
                    INSERT OR REPLACE INTO recording_tag_assignments (
                        id, user_id, recording_id, tag_id, created_at
                    ) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)
                `,
                args: [
                    `${recordingId}-alpha`,
                    userId,
                    recordingId,
                    alphaTagId,
                    now,
                    `${recordingId}-beta`,
                    userId,
                    recordingId,
                    betaTagId,
                    now,
                ],
            },
        ]);
    } finally {
        await library.close();
    }
}

async function seedTagMatrixRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();

    try {
        await cleanupListSeeds(userId);
        const statements = SOT_TAG_ICON_MATRIX.flatMap((icon, index) => {
            const suffix = String(index + 1).padStart(2, "0");
            const recordingId = `${LIST_RECORDING_PREFIX}tag-matrix-${suffix}`;
            const tagId = `${LIST_RECORDING_PREFIX}tag-matrix-tag-${suffix}`;
            const color =
                SOT_TAG_COLOR_MATRIX[index % SOT_TAG_COLOR_MATRIX.length]
                    .color;
            const start = now - index * 90_000;

            return [
                {
                    sql: `
                        INSERT OR REPLACE INTO recordings (
                            id, user_id, source_provider, source_recording_id, source_version,
                            source_metadata, provider_device_id, filename, duration, start_time,
                            end_time, filesize, file_md5, storage_type, storage_path,
                            downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        recordingId,
                        userId,
                        "ticnote",
                        `${recordingId}-source`,
                        "1",
                        "{}",
                        "e2e-list-device",
                        `E2E SOT tag ${icon}`,
                        120_000 + index * 1000,
                        start,
                        start + 120_000,
                        2048 + index,
                        recordingId,
                        "local",
                        "",
                        now,
                        0,
                        0,
                        now,
                        now,
                    ],
                },
                {
                    sql: `
                        INSERT OR REPLACE INTO recording_tags (
                            id, user_id, name, color, icon, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        tagId,
                        userId,
                        `SOT ${icon}`,
                        color,
                        icon,
                        now,
                        now,
                    ],
                },
                {
                    sql: `
                        INSERT OR REPLACE INTO recording_tag_assignments (
                            id, user_id, recording_id, tag_id, created_at
                        ) VALUES (?, ?, ?, ?, ?)
                    `,
                    args: [
                        `${recordingId}-assignment`,
                        userId,
                        recordingId,
                        tagId,
                        now,
                    ],
                },
            ];
        });

        await library.batch(statements);
    } finally {
        await library.close();
    }
}

async function seedRowStatusRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const now = Date.now();
    const rows = [
        {
            id: `${LIST_RECORDING_PREFIX}row-updated`,
            filename: "E2E row status updated",
            sourceProvider: "dingtalk-a1",
            upstreamDeleted: 0,
        },
        {
            id: `${LIST_RECORDING_PREFIX}row-transcribing`,
            filename: "E2E row status transcribing",
            sourceProvider: "ticnote",
            upstreamDeleted: 0,
        },
        {
            id: `${LIST_RECORDING_PREFIX}row-failed`,
            filename: "E2E row status failed",
            sourceProvider: "dingtalk-a1",
            upstreamDeleted: 0,
        },
        {
            id: `${LIST_RECORDING_PREFIX}row-local-only`,
            filename: "E2E row status local only",
            sourceProvider: "ticnote",
            upstreamDeleted: 1,
        },
        {
            id: `${LIST_RECORDING_PREFIX}row-pending`,
            filename: "E2E row status pending",
            sourceProvider: "iflyrec",
            upstreamDeleted: 0,
        },
    ];

    try {
        await cleanupListSeeds(userId);
        for (const [index, row] of rows.entries()) {
            const start = now - index * 60_000;
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
                    row.id,
                    userId,
                    row.sourceProvider,
                    `${row.id}-source`,
                    "1",
                    "{}",
                    "e2e-row-status-device",
                    row.filename,
                    180_000 + index * 1000,
                    start,
                    start + 180_000,
                    4096 + index,
                    row.id,
                    "local",
                    "",
                    now,
                    0,
                    row.upstreamDeleted,
                    now,
                    now,
                ],
            });
        }

        await library.batch([
            {
                sql: `
                    INSERT OR REPLACE INTO recording_tags (
                        id, user_id, name, color, icon, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${LIST_RECORDING_PREFIX}tag-row-style`,
                    userId,
                    "Style",
                    "blue",
                    "tag",
                    now,
                    now,
                ],
            },
            {
                sql: `
                    INSERT OR REPLACE INTO recording_tag_assignments (
                        id, user_id, recording_id, tag_id, created_at
                    ) VALUES (?, ?, ?, ?, ?)
                `,
                args: [
                    `${LIST_RECORDING_PREFIX}row-style-assignment`,
                    userId,
                    `${LIST_RECORDING_PREFIX}row-updated`,
                    `${LIST_RECORDING_PREFIX}tag-row-style`,
                    now,
                ],
            },
        ]);

        await library.batch([
            {
                sql: `
                    INSERT OR REPLACE INTO transcription_jobs (
                        id, user_id, recording_id, status, force, provider, model,
                        provider_job_id, remote_status, attempts, last_error,
                        requested_at, started_at, completed_at, next_poll_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${LIST_RECORDING_PREFIX}job-transcribing`,
                    userId,
                    `${LIST_RECORDING_PREFIX}row-transcribing`,
                    "processing",
                    0,
                    "voice-transcribe",
                    "e2e",
                    "remote-row-transcribing",
                    "transcribing",
                    1,
                    null,
                    now - 60_000,
                    now - 55_000,
                    null,
                    now + 300_000,
                    now - 60_000,
                    now,
                ],
            },
            {
                sql: `
                    INSERT OR REPLACE INTO transcription_jobs (
                        id, user_id, recording_id, status, force, provider, model,
                        provider_job_id, remote_status, attempts, last_error,
                        requested_at, started_at, completed_at, next_poll_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${LIST_RECORDING_PREFIX}job-failed`,
                    userId,
                    `${LIST_RECORDING_PREFIX}row-failed`,
                    "failed",
                    0,
                    "voice-transcribe",
                    "e2e",
                    "remote-row-failed",
                    "failed",
                    1,
                    "row status failed",
                    now - 60_000,
                    now - 55_000,
                    now - 30_000,
                    null,
                    now - 60_000,
                    now,
                ],
            },
        ]);

        await transcripts.execute({
            sql: `
                INSERT OR REPLACE INTO transcriptions (
                    id, recording_id, user_id, text, detected_language,
                    transcription_type, provider, model, provider_job_id,
                    speaker_map, provider_payload, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                `${LIST_RECORDING_PREFIX}transcript-updated`,
                `${LIST_RECORDING_PREFIX}row-updated`,
                userId,
                "这条录音已有转写。",
                "zh",
                "server",
                "voice-transcribe",
                "e2e",
                "remote-row-updated",
                "{}",
                "{}",
                now,
            ],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedTimelineFilterRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const localToday = new Date();
    localToday.setHours(0, 0, 0, 0);
    const todayStart = Math.max(localToday.getTime(), now - 30 * 60_000);
    const earlierStart = localToday.getTime() - 12 * 86_400_000;

    try {
        await cleanupListSeeds(userId);
        for (const recording of [
            {
                id: `${LIST_RECORDING_PREFIX}today-ticnote`,
                filename: "E2E timeline today TicNote",
                sourceProvider: "ticnote",
                start: todayStart,
            },
            {
                id: `${LIST_RECORDING_PREFIX}earlier-plaud`,
                filename: "E2E timeline earlier Plaud",
                sourceProvider: "plaud",
                start: earlierStart,
            },
        ]) {
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
                    recording.id,
                    userId,
                    recording.sourceProvider,
                    `${recording.id}-source`,
                    "1",
                    "{}",
                    "e2e-list-device",
                    recording.filename,
                    120_000,
                    recording.start,
                    recording.start + 120_000,
                    2048,
                    recording.id,
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            });
        }
    } finally {
        await library.close();
    }
}

async function resetDisplay(
    page: Page,
    options: {
        itemsPerPage?: number;
        theme?: "system" | "light" | "dark";
        uiLanguage?: "zh-CN" | "en";
    } = {},
) {
    const resetResponse = await putJsonWithRetry(page, "/api/settings/display", {
        dateTimeFormat: "relative",
        itemsPerPage: options.itemsPerPage ?? 50,
        recordingListSortOrder: "newest",
        theme: options.theme ?? "dark",
        uiLanguage: options.uiLanguage ?? "zh-CN",
    });
    expect(resetResponse.ok()).toBe(true);
}

async function mockConnectedDataSources(page: Page) {
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        const capabilities = {
            audioDownload: true,
            localRename: true,
            officialSummary: true,
            officialTranscript: true,
            privateTranscribe: true,
            upstreamTitleWriteback: false,
            workerSync: true,
        };
        const labels: Record<string, string> = {
            "dingtalk-a1": "钉钉",
            "feishu-minutes": "飞书妙记",
            iflyrec: "讯飞听见",
            plaud: "Plaud",
            ticnote: "TicNote",
        };
        const connectedProviders = new Set(["ticnote", "plaud"]);

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                sources: [
                    "dingtalk-a1",
                    "ticnote",
                    "plaud",
                    "feishu-minutes",
                    "iflyrec",
                ].map((provider) => ({
                    authMode: "bearer",
                    authModes: ["bearer"],
                    baseUrl: "https://example.invalid",
                    capabilities,
                    config: {},
                    connected: connectedProviders.has(provider),
                    connectionStatus: "ready",
                    displayName: labels[provider] ?? provider,
                    enabled: connectedProviders.has(provider),
                    lastSync: null,
                    provider,
                    runtimeStatus: "active",
                    secretsConfigured: connectedProviders.has(provider)
                        ? { bearerToken: true }
                        : {},
                })),
            }),
        });
    });
}

async function expectNoTweaksLeak(page: Page) {
    await expect(page.locator("#tweaks-panel")).toHaveCount(0);
    await expect(page.locator(".tw-scroll")).toHaveCount(0);
    await expect(page.locator(".ds-only-mark, .ds-only-badge")).toHaveCount(0);
    await expect(page.locator('[data-sot-control="ds-only-tweaks"]')).toHaveCount(
        0,
    );
    await expect(page.getByText("Tweaks", { exact: true })).toHaveCount(0);
    await expect(page.getByText("调试", { exact: true })).toHaveCount(0);
}

function recordingListPanel(page: Page) {
    return page.locator('[data-sot-surface="dashboard-recording-list"]');
}

function sotRecordingListPanel(page: Page) {
    return page.locator(
        '[data-sot-surface="dashboard-recording-list"], .list-panel',
    );
}

function sotControl(page: Page, name: string) {
    return page.locator(`[data-sot-control="${name}"]`);
}

function recordingRow(page: Page, id: string) {
    return page.locator(`[data-sot-recording-id="${id}"]`);
}

function seededRecordingRows(panel: Locator) {
    return panel.locator(
        '[data-sot-control="dashboard-recording-row"][data-sot-recording-id^="e2e-list-state-"]',
    );
}

function listStateBlock(panel: Locator, state: string) {
    return panel.locator(
        `[data-sot-part="recording-list-state"][data-sot-state="${state}"]`,
    );
}

function sourceProvider(page: Page, provider: string) {
    return page.locator(
        `[data-sot-control="dashboard-source-provider"][data-sot-provider="${provider}"]`,
    );
}

async function openSotComponentLibrary(page: Page) {
    await page.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
    });
}

async function openSotWorkstation(page: Page) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.removeAttribute("data-time-style");
    });
}

async function openSotCssOnlyWorkstation(page: Page) {
    sotWorkstationCssCache ??= (
        await Promise.all([
            readFile(SOT_COLORS_AND_TYPE_CSS_PATH, "utf8"),
            readFile(SOT_KIT_CSS_PATH, "utf8"),
        ])
    ).join("\n");
    await page.setContent(
        `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><style>${sotWorkstationCssCache.replaceAll("</style", "<\\/style")}</style></head><body data-theme="dark"></body></html>`,
        { waitUntil: "load" },
    );
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.removeAttribute("data-time-style");
    });
}

async function readSotComponentTagIconSignatures(page: Page) {
    await openSotComponentLibrary(page);
    const buttons = page.locator(
        '#tagmgr .cl-card:has-text("Create") .tagm-icon-grid .tg-pick',
    );
    await expect(buttons).toHaveCount(SOT_TAG_ICON_MATRIX.length);

    return buttons.evaluateAll((buttons, icons) => {
        const svgSignature = (svg: SVGElement | null) =>
            Array.from(svg?.children ?? []).map((child) => ({
                attributes: Array.from(child.attributes).map((attribute) => [
                    attribute.name,
                    attribute.value,
                ]),
                tagName: child.tagName.toLowerCase(),
            }));

        return Object.fromEntries(
            buttons.map((button, index) => [
                icons[index] ?? "",
                svgSignature(button.querySelector("svg")),
            ]),
        );
    }, SOT_TAG_ICON_MATRIX) as Promise<Record<SotTagIcon, SvgChildSignature>>;
}

async function readSvgChildSignature(locator: Locator) {
    return locator.locator("svg").first().evaluate((svg) =>
        Array.from(svg.children).map((child) => ({
            attributes: Array.from(child.attributes).map((attribute) => [
                attribute.name,
                attribute.value,
            ]),
            tagName: child.tagName.toLowerCase(),
        })),
    ) as Promise<SvgChildSignature>;
}

function sourceAssetMime(fileName: string) {
    if (fileName.endsWith(".svg")) return "image/svg+xml";
    if (fileName.endsWith(".jpeg") || fileName.endsWith(".jpg")) {
        return "image/jpeg";
    }
    if (fileName.endsWith(".png")) return "image/png";
    throw new Error(`Unsupported SOT source asset type: ${fileName}`);
}

async function readListRowSourceAssetDataUrls() {
    const entries = await Promise.all(
        Object.entries(LIST_ROW_SOURCE_ASSETS).map(async ([src, fileName]) => {
            const bytes = await readFile(path.join(SOT_SOURCE_ASSET_DIR, fileName));
            return [
                src,
                `data:${sourceAssetMime(fileName)};base64,${bytes.toString(
                    "base64",
                )}`,
            ] as const;
        }),
    );

    return Object.fromEntries(entries) as Record<string, string>;
}

async function readSotListRowHtml(page: Page) {
    const entries = await Promise.all(
        LIST_ROW_SOT_STATES.map(async (state) => [
            state,
            await page
                .locator(LIST_ROW_SELECTORS[state])
                .first()
                .evaluate((element) => element.outerHTML),
        ]),
    );

    return Object.fromEntries(entries) as Record<ListRowSotState, string>;
}

async function readSotListSkeletonHtml(page: Page) {
    return page
        .locator(".skel-list")
        .first()
        .evaluate((element) => element.outerHTML);
}

async function readSotTagFilterTriggerHtml(page: Page) {
    const entries = await Promise.all(
        TAG_FILTER_TRIGGER_SOT_STATES.map(async (state) => {
            const card = page.locator("#tagsel .cl-card").filter({
                hasText: TAG_FILTER_TRIGGER_LABELS[state],
            });
            return [
                state,
                await card
                    .locator(".tag-filter-trigger")
                    .first()
                    .evaluate((element) => element.outerHTML),
            ] as const;
        }),
    );

    return Object.fromEntries(entries) as Record<
        TagFilterTriggerSotState,
        string
    >;
}

async function readSotOpenTagFilterHtml(page: Page) {
    await page.evaluate(() => {
        const filter = document.querySelector<HTMLElement>(
            '[data-list-filter-row="tags"]',
        );
        const trigger = document.querySelector<HTMLElement>(
            "[data-tag-filter-trigger]",
        );
        const list = document.querySelector<HTMLElement>(
            "[data-tag-filter-list]",
        );

        filter?.removeAttribute("hidden");
        trigger?.setAttribute("aria-expanded", "true");
        list?.removeAttribute("hidden");
    });
    await expect(
        page.locator("[data-tag-filter-list] .tag-filter-option"),
    ).toHaveCount(7);

    return page
        .locator('[data-list-filter-row="tags"]')
        .first()
        .evaluate((element) => element.outerHTML);
}

async function readSotListStateBlockHtml(page: Page) {
    const entries: Array<readonly [ListStateBlockSotState, string]> = [];

    for (const state of LIST_STATE_BLOCK_SOT_STATES) {
        await page.evaluate((targetState) => {
            document
                .querySelector<HTMLButtonElement>(
                    `.tw-list-grid button[data-list-state="${targetState}"]`,
                )
                ?.click();
        }, state);
        const block = page.locator(`[data-list-state-block="${state}"]`).first();
        await expect(block).toBeVisible();
        entries.push([
            state,
            await block.evaluate((element) => element.outerHTML),
        ] as const);
    }

    return Object.fromEntries(entries) as Record<ListStateBlockSotState, string>;
}

async function readSotListPanelHtml(page: Page) {
    const panel = sotRecordingListPanel(page).first();
    return panel.evaluate((element) => {
        const clone = element.cloneNode(true) as HTMLElement;
        clone
            .querySelectorAll(".stack-banner, [hidden]")
            .forEach((child) => child.remove());
        clone.querySelectorAll("._is-1").forEach((child) => {
            child.classList.remove("_is-1");
        });
        clone.classList.remove("panel", "list-panel");
        clone.setAttribute("data-slot", "card");
        clone.setAttribute("data-sot-surface", "dashboard-recording-list");

        const setAttributes = (
            selector: string,
            attributes: Record<string, string>,
        ) => {
            clone.querySelectorAll<HTMLElement>(selector).forEach((node) => {
                for (const [name, value] of Object.entries(attributes)) {
                    node.setAttribute(name, value);
                }
            });
        };

        setAttributes(".list-header", {
            "data-sot-part": "dashboard-recording-list-header",
        });
        setAttributes(".lh-titlebar", {
            "data-sot-part": "dashboard-recording-list-titlebar",
        });
        setAttributes(".lh-title", {
            "data-sot-part": "dashboard-recording-list-title",
        });
        setAttributes(".lh-count", {
            "data-sot-part": "dashboard-recording-list-count",
        });
        setAttributes(".stack-strip", {
            "data-sot-panel": "dashboard-source-filter-stack",
            "data-sot-state": "default",
        });
        setAttributes(".stack-from", {
            "data-sot-part": "source-filter-from",
        });
        setAttributes(".stack-sep", {
            "data-sot-part": "source-filter-separator",
        });
        setAttributes(".stack-chip", {
            "data-sot-part": "source-filter-chip",
        });
        setAttributes(".stack-chip .ico", {
            "data-sot-part": "source-filter-icon",
        });
        clone
            .querySelectorAll<HTMLElement>(".stack-chip .ico.cover")
            .forEach((node) => {
                node.setAttribute("data-sot-provider-cover", "true");
            });
        setAttributes(".stack-info", {
            "data-sot-part": "source-filter-info",
        });
        setAttributes(".stack-chip .x", {
            "data-slot": "button",
            "data-sot-control": "source-filter-clear",
        });
        setAttributes(".list-mode-bar", {
            "data-sot-panel": "dashboard-recording-list-mode",
        });
        setAttributes(".list-mode-label", {
            "data-sot-part": "dashboard-recording-list-mode-label",
        });
        setAttributes(".list-mode-count", {
            "data-sot-part": "dashboard-recording-list-mode-count",
        });
        setAttributes(".list-mode-seg", {
            "data-slot": "segmented-tabs",
            "data-sot-control": "liquid-tabs",
            "data-sot-part": "dashboard-recording-list-mode-segmented",
            "data-sot-size": "sm",
        });
        clone
            .querySelectorAll<HTMLElement>(".list-mode-seg")
            .forEach((node) => {
                const activeIndex = Math.max(
                    0,
                    Array.from(node.querySelectorAll(".lt-tab")).findIndex(
                        (tab) => tab.classList.contains("active"),
                    ),
                );
                node.setAttribute("data-idx", String(activeIndex));
                node.setAttribute("data-active", String(activeIndex));
                node.setAttribute(
                    "data-tabs",
                    String(node.querySelectorAll(".lt-tab").length),
                );
            });
        setAttributes(".lt-ind", {
            "data-sot-part": "liquid-tabs-indicator",
        });
        clone.querySelectorAll<HTMLElement>(".lt-tab").forEach((node) => {
            const mode = node.dataset.mode ?? node.textContent?.trim() ?? "";
            const active = node.classList.contains("active");
            node.setAttribute("data-sot-control", "liquid-tab");
            node.setAttribute("data-sot-state", active ? "active" : "idle");
            node.setAttribute("data-tab-key", mode);
            node.setAttribute("role", "tab");
            node.setAttribute("aria-selected", active ? "true" : "false");
        });
        setAttributes('.filter-row[data-list-filter-row="timeline"]', {
            "data-slot": "toggle-group",
            "data-sot-panel": "dashboard-recording-time-filter",
        });
        clone.querySelectorAll<HTMLElement>(".chip-f").forEach((node) => {
            const active = node.classList.contains("active");
            node.setAttribute("data-slot", "toggle-group-item");
            node.setAttribute(
                "data-sot-control",
                "dashboard-recording-time-filter",
            );
            node.setAttribute("data-sot-filter", node.dataset.tf ?? "");
            node.setAttribute("data-sot-state", active ? "selected" : "idle");
        });
        setAttributes(".chip-c", {
            "data-sot-part": "dashboard-recording-time-filter-count",
        });
        setAttributes(".tag-filter", {
            "data-sot-panel": "recording-list-tag-filter",
        });
        setAttributes(".tag-filter-trigger", {
            "data-slot": "button",
            "data-sot-control": "recording-list-tag-filter-trigger",
        });
        setAttributes(".tag-filter-label", {
            "data-sot-part": "recording-list-tag-filter-label",
        });
        setAttributes(".tag-filter-count", {
            "data-sot-part": "recording-list-tag-filter-count",
        });
        setAttributes(".tag-filter-caret", {
            "data-sot-part": "recording-list-tag-filter-caret",
        });
        setAttributes(".tag-filter-list", {
            "data-sot-list": "recording-list-tag-filter-list",
        });
        setAttributes(".tag-filter-option", {
            "data-slot": "button",
            "data-sot-control": "recording-list-tag-filter",
        });
        setAttributes(".tag-filter-option-label", {
            "data-sot-part": "recording-list-tag-filter-option-label",
        });
        setAttributes(".tag-filter-option-count", {
            "data-sot-part": "recording-list-tag-filter-option-count",
        });
        setAttributes(".utag-plus", {
            "data-sot-part": "recording-tag-overflow",
        });
        setAttributes(".list-scroll", {
            "data-sot-list": "dashboard-recording-list-scroll",
        });

        if (
            !clone.querySelector(
                ':scope > [data-sot-part="dashboard-recording-list-content"][data-slot="card-content"]',
            )
        ) {
            const content = document.createElement("div");
            content.setAttribute(
                "data-sot-part",
                "dashboard-recording-list-content",
            );
            content.setAttribute("data-slot", "card-content");
            while (clone.firstChild) {
                content.appendChild(clone.firstChild);
            }
            clone.appendChild(content);
        }

        return clone.outerHTML;
    });
}

async function waitForListRowFixtureImages(page: Page, fixtureId: string) {
    await page.locator(`#${fixtureId} img`).evaluateAll((images) =>
        Promise.all(
            images.map(
                (image) =>
                    image.complete ||
                    new Promise<void>((resolve, reject) => {
                        image.addEventListener("load", () => resolve(), {
                            once: true,
                        });
                        image.addEventListener(
                            "error",
                            () =>
                                reject(
                                    new Error(
                                        `Failed to load fixture image ${image.getAttribute(
                                            "src",
                                        )}`,
                                    ),
                                ),
                            { once: true },
                        );
                    }),
            ),
        ),
    );
}

async function installSotPixelDevOverlaySuppression(
    page: Page,
    fixtureId: string,
) {
    await page.evaluate(
        ({ attribute, css, id }) => {
            const selector = [
                "nextjs-portal",
                "[data-nextjs-toast]",
                "[data-nextjs-dialog-overlay]",
                "[data-nextjs-dialog-backdrop]",
                "[data-nextjs-dialog]",
                "[data-nextjs-errors]",
                "[data-nextjs-dev-tools-button]",
                'button[aria-label="Open Next.js Dev Tools"]',
                ".__nextjs-dev-overlay",
            ].join(", ");
            const stateKey = "__sotPixelDevOverlaySuppressionTimers";
            const windowWithState = window as typeof window & {
                [stateKey]?: Record<string, number>;
            };
            const timers = (windowWithState[stateKey] ??= {});

            window.clearInterval(timers[id]);
            document.querySelector(`style[${attribute}="${id}"]`)?.remove();

            const devOverlayStyle = document.createElement("style");
            devOverlayStyle.setAttribute(attribute, id);
            devOverlayStyle.textContent = css;
            document.head.appendChild(devOverlayStyle);

            const hideDevOverlay = () => {
                const fixture = document.getElementById(id);
                const hideElement = (element: HTMLElement) => {
                    element.setAttribute("aria-hidden", "true");
                    element.style.setProperty("display", "none", "important");
                    element.style.setProperty(
                        "visibility",
                        "hidden",
                        "important",
                    );
                    element.style.setProperty("opacity", "0", "important");
                    element.style.setProperty(
                        "pointer-events",
                        "none",
                        "important",
                    );
                };
                const isDevOverlayCandidate = (element: HTMLElement) => {
                    if (fixture?.contains(element)) {
                        return false;
                    }

                    const elementSignature = [
                        element.tagName,
                        element.id,
                        String(element.className),
                        element.getAttribute("aria-label"),
                        element.getAttribute("title"),
                        ...Array.from(element.attributes)
                            .map((attribute) => attribute.name)
                            .filter((name) => name.startsWith("data-nextjs")),
                    ]
                        .join(" ")
                        .toLowerCase();
                    const style = window.getComputedStyle(element);
                    const zIndex = Number.parseInt(style.zIndex, 10);
                    const fixedHighLayer =
                        style.position === "fixed" &&
                        Number.isFinite(zIndex) &&
                        zIndex >= 1_000;
                    const nextDevTools =
                        elementSignature.includes("next") &&
                        (elementSignature.includes("dev") ||
                            elementSignature.includes("tool"));

                    return nextDevTools || fixedHighLayer;
                };
                const hideInRoot = (root: Document | ShadowRoot) => {
                    for (const element of root.querySelectorAll<HTMLElement>(
                        selector,
                    )) {
                        hideElement(element);
                    }
                    for (const element of root.querySelectorAll<HTMLElement>(
                        "*",
                    )) {
                        if (isDevOverlayCandidate(element)) {
                            hideElement(element);
                        }
                        if (element.shadowRoot) {
                            hideInRoot(element.shadowRoot);
                        }
                    }
                };

                hideInRoot(document);
            };

            hideDevOverlay();
            timers[id] = window.setInterval(hideDevOverlay, 50);
        },
        {
            attribute: SOT_PIXEL_DEV_OVERLAY_STYLE_ATTR,
            css: SOT_PIXEL_DEV_OVERLAY_HIDDEN_CSS,
            id: fixtureId,
        },
    );
}

async function removeSotPixelDevOverlaySuppression(
    page: Page,
    fixtureId: string,
) {
    await page.evaluate(
        ({ attribute, id }) => {
            const stateKey = "__sotPixelDevOverlaySuppressionTimers";
            const windowWithState = window as typeof window & {
                [stateKey]?: Record<string, number>;
            };
            const timers = windowWithState[stateKey];
            if (timers?.[id]) {
                window.clearInterval(timers[id]);
                delete timers[id];
            }
            document.querySelector(`style[${attribute}="${id}"]`)?.remove();
        },
        { attribute: SOT_PIXEL_DEV_OVERLAY_STYLE_ATTR, id: fixtureId },
    );
}

async function captureListRowFixture(
    page: Page,
    rowHtml: string,
    sourceAssetDataUrls: Record<string, string>,
) {
    const fixtureId = `sot-list-row-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({
            devOverlayCss,
            fixtureId: id,
            migrationFixtureCss,
            rowHtml: html,
            sourceAssetDataUrls: assetDataUrls,
        }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.removeAttribute("data-time-style");
            const devOverlayStyle = document.createElement("style");
            devOverlayStyle.dataset.listPanelFrameFixture = id;
            devOverlayStyle.textContent = `${devOverlayCss}\n${migrationFixtureCss}`;
            document.head.appendChild(devOverlayStyle);

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "list-row-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "rgb(24, 29, 35)";
            stage.style.padding = "16px";
            stage.style.width = "420px";

            const list = document.createElement("div");
            list.className = "real-list";
            list.style.width = "388px";
            list.innerHTML = html;
            for (const mutedDot of list.querySelectorAll("._is-1")) {
                mutedDot.classList.remove("_is-1");
                mutedDot.classList.add("status-dot-muted");
            }
            for (const overflowChip of list.querySelectorAll<HTMLElement>(
                ".utag-plus",
            )) {
                overflowChip.setAttribute(
                    "data-sot-part",
                    "recording-tag-overflow",
                );
            }

            for (const image of list.querySelectorAll("img")) {
                const src = image.getAttribute("src");
                if (src && assetDataUrls[src]) {
                    image.setAttribute("src", assetDataUrls[src]);
                }
            }

            stage.appendChild(list);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            devOverlayCss: SOT_PIXEL_DEV_OVERLAY_HIDDEN_CSS,
            fixtureId,
            migrationFixtureCss: LIST_ROW_MIGRATION_FIXTURE_CSS,
            rowHtml,
            sourceAssetDataUrls,
        },
    );

    await waitForListRowFixtureImages(page, fixtureId);
    const stage = page.locator(`#${fixtureId} > .list-row-pixel-stage`).first();
    const row = page.locator(`#${fixtureId} .real-list > .row`).first();
    await expect(row).toBeVisible();
    await page.waitForTimeout(250);

    const metrics = await row.evaluate((element) => {
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
                padding: style.padding,
                width: Math.round(rect.width * 1000) / 1000,
            };
        };

        return {
            badge: readStyle(element.querySelector(".b")),
            imageCount: element.querySelectorAll("img").length,
            right: readStyle(element.querySelector(".right")),
            source: readStyle(element.querySelector(".src-mini")),
            sourceImage: readStyle(element.querySelector(".src-mini img")),
            row: readStyle(element),
            tag: readStyle(element.querySelector(".utag")),
            title: readStyle(element.querySelector(".title")),
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
        document
            .querySelector(`style[data-list-panel-frame-fixture="${id}"]`)
            ?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function captureListSkeletonFixture(page: Page, skeletonHtml: string) {
    const fixtureId = `sot-list-skeleton-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await installSotPixelDevOverlaySuppression(page, fixtureId);
    try {
        await page.evaluate(
            ({ fixtureCss, fixtureId: id, skeletonHtml: html }) => {
                document.getElementById(id)?.remove();
                document.documentElement.dataset.theme = "dark";
                document
                    .querySelector(`style[data-list-skeleton-fixture="${id}"]`)
                    ?.remove();
                const fixtureStyle = document.createElement("style");
                fixtureStyle.dataset.listSkeletonFixture = id;
                fixtureStyle.textContent = fixtureCss;
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
                stage.className = "list-skeleton-pixel-stage";
                stage.style.boxSizing = "border-box";
                stage.style.background = "rgb(24, 29, 35)";
                stage.style.padding = "16px";
                stage.style.width = "420px";
                stage.innerHTML = html;
                stage.querySelector(".skel-list")?.removeAttribute("hidden");

                host.appendChild(stage);
                document.body.appendChild(host);
            },
            {
                fixtureCss: LIST_SKELETON_MIGRATION_FIXTURE_CSS,
                fixtureId,
                skeletonHtml,
            },
        );

        const stage = page
            .locator(`#${fixtureId} > .list-skeleton-pixel-stage`)
            .first();
        const skeleton = page.locator(`#${fixtureId} .skel-list`).first();
        await expect(skeleton).toBeVisible();
        await page.waitForTimeout(250);
        const screenshot = await stage.screenshot({
            animations: "disabled",
            omitBackground: false,
            scale: "css",
        });

        return {
            dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
            screenshot,
        };
    } finally {
        try {
            await page.evaluate((id) => {
                document.getElementById(id)?.remove();
                document
                    .querySelector(`style[data-list-skeleton-fixture="${id}"]`)
                    ?.remove();
            }, fixtureId);
        } finally {
            await removeSotPixelDevOverlaySuppression(page, fixtureId);
        }
    }
}

function tagFilterPixelFixtureCss(scope: string) {
    return `
        ${scope} .tag-filter {
            position: relative;
            margin-top: 10px;
        }
        ${scope} .tag-filter-trigger {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            height: 30px;
            padding: 0 10px;
            border-radius: 8px;
            background: var(--bg-elevated);
            border: 1px solid var(--line-hairline);
            font: 600 12.5px var(--font-sans);
            color: var(--fg-primary);
            cursor: pointer;
            text-align: left;
        }
        ${scope} .tag-filter-label {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        ${scope} .tag-filter-count {
            font: 500 11px var(--font-mono);
            color: var(--fg-tertiary);
        }
        ${scope} .tag-filter-caret {
            width: 11px;
            height: 11px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            color: var(--fg-tertiary);
        }
        ${scope} .tag-filter-list {
            position: absolute;
            left: 0;
            right: 0;
            top: calc(100% + 6px);
            z-index: var(--z-popover-inline);
            overflow-y: auto;
            background: var(--bg-elevated);
            border: 1px solid var(--line-hairline);
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            padding: 4px;
            max-height: 260px;
        }
        [data-theme="dark"] ${scope} .tag-filter-list {
            background: color-mix(in srgb, var(--graphite-900) 92%, transparent);
            border-color: var(--glass-border);
        }
        ${scope} .tag-filter-option {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 8px;
            border-radius: 6px;
            background: transparent;
            border: 0;
            cursor: pointer;
            width: 100%;
            text-align: left;
            font: 500 12.5px var(--font-sans);
            color: var(--fg-primary);
        }
        ${scope} .tag-filter-option:hover {
            background: var(--bg-recessed);
        }
        ${scope} .tag-filter-option .tg-ico {
            width: 12px;
            height: 12px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
        }
        ${scope} .tag-filter-option-label {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        ${scope} .tag-filter-option-count {
            font: 500 11px var(--font-mono);
            color: var(--fg-tertiary);
        }
        ${scope} .tag-filter-option[aria-selected="true"] {
            background: var(--accent-soft);
            color: var(--accent);
        }
        ${scope} .tag-filter[hidden] {
            display: none !important;
        }
    `;
}

async function captureTagFilterTriggerFixture(page: Page, triggerHtml: string) {
    const fixtureId = `sot-tag-filter-trigger-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureCss, fixtureId: id, triggerHtml: html }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "tag-filter-trigger-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.padding = "16px";
            stage.style.width = "280px";

            const wrapper = document.createElement("div");
            wrapper.className = "tag-filter";
            wrapper.style.margin = "0";
            wrapper.style.width = "248px";
            wrapper.innerHTML = html;

            const style = document.createElement("style");
            style.setAttribute("data-tag-filter-fixture", id);
            style.textContent = fixtureCss;

            host.appendChild(style);
            stage.appendChild(wrapper);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixtureCss: tagFilterPixelFixtureCss(`#${fixtureId}`),
            fixtureId,
            triggerHtml,
        },
    );

    const stage = page
        .locator(`#${fixtureId} > .tag-filter-trigger-pixel-stage`)
        .first();
    const trigger = page.locator(`#${fixtureId} .tag-filter-trigger`).first();
    await expect(trigger).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function captureOpenTagFilterFixture(page: Page, tagFilterHtml: string) {
    const fixtureId = `sot-tag-filter-open-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureCss, fixtureId: id, tagFilterHtml: html }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "tag-filter-open-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.height = "260px";
            stage.style.overflow = "visible";
            stage.style.padding = "16px";
            stage.style.width = "280px";
            stage.innerHTML = html;

            const filter = stage.querySelector<HTMLElement>(".tag-filter");
            filter?.removeAttribute("hidden");
            if (filter) {
                filter.style.margin = "0";
                filter.style.width = "248px";
            }
            stage
                .querySelector<HTMLElement>("[data-tag-filter-trigger]")
                ?.setAttribute("aria-expanded", "true");
            stage
                .querySelector<HTMLElement>("[data-tag-filter-list]")
                ?.removeAttribute("hidden");

            const style = document.createElement("style");
            style.setAttribute("data-tag-filter-fixture", id);
            style.textContent = fixtureCss;

            host.appendChild(style);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixtureCss: tagFilterPixelFixtureCss(`#${fixtureId}`),
            fixtureId,
            tagFilterHtml,
        },
    );

    const stage = page
        .locator(`#${fixtureId} > .tag-filter-open-pixel-stage`)
        .first();
    await expect(page.locator(`#${fixtureId} .tag-filter-list`)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function captureListStateBlockFixture(page: Page, blockHtml: string) {
    const fixtureId = `sot-list-state-block-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ blockHtml: html, fixtureCss, fixtureId: id, ownerClasses }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";

            const addClasses = (element: Element | null, className: string) => {
                if (!element) return;
                element.classList.add(
                    ...className.split(/\s+/).filter(Boolean),
                );
            };
            const addClassesToAll = (selector: string, className: string) => {
                stage.querySelectorAll(selector).forEach((element) => {
                    addClasses(element, className);
                });
            };

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "list-state-block-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "rgb(24, 29, 35)";
            stage.style.padding = "16px";
            stage.style.width = "420px";
            stage.innerHTML = html;
            const style = document.createElement("style");
            style.textContent = fixtureCss;
            const stateBlock =
                stage.querySelector<HTMLElement>(".list-state-block") ??
                stage.querySelector<HTMLElement>("[data-list-state-block]");
            stateBlock?.removeAttribute("hidden");
            stateBlock?.classList.add("list-state-block");
            if (stateBlock) {
                const state =
                    stateBlock.getAttribute("data-list-state-block") ??
                    stateBlock.getAttribute("data-sot-state") ??
                    "";
                const isPagination =
                    state.startsWith("paginated") ||
                    stateBlock.classList.contains("list-state-pagination") ||
                    stateBlock.getAttribute("data-sot-panel") ===
                        "recording-list-pagination";

                stateBlock.setAttribute("data-sot-state", state);
                if (isPagination) {
                    stateBlock.setAttribute(
                        "data-sot-panel",
                        "recording-list-pagination",
                    );
                    stateBlock.classList.add("list-state-pagination");
                    addClasses(stateBlock, ownerClasses.paginationRoot);
                } else {
                    stateBlock.setAttribute(
                        "data-sot-part",
                        "recording-list-state",
                    );
                    addClasses(stateBlock, ownerClasses.listStateRoot);
                }

                stateBlock
                    .querySelector<HTMLElement>(".lsb-ico")
                    ?.setAttribute(
                        "data-sot-part",
                        "recording-list-state-icon",
                    );
                addClassesToAll(
                    '[data-sot-part="recording-list-state-icon"]',
                    ownerClasses.listStateIcon,
                );
                stateBlock
                    .querySelector<HTMLElement>(".lsb-t")
                    ?.setAttribute(
                        "data-sot-part",
                        "recording-list-state-title",
                    );
                addClassesToAll(
                    '[data-sot-part="recording-list-state-title"]',
                    ownerClasses.listStateTitle,
                );
                stateBlock
                    .querySelector<HTMLElement>(".lsb-h")
                    ?.setAttribute(
                        "data-sot-part",
                        "recording-list-state-description",
                    );
                addClassesToAll(
                    '[data-sot-part="recording-list-state-description"]',
                    ownerClasses.listStateDescription,
                );
                const pageDivider =
                    stateBlock.querySelector<HTMLElement>(
                        ".lsb-page-divider",
                    );
                pageDivider?.setAttribute(
                    "data-sot-part",
                    "recording-list-page-divider",
                );
                addClassesToAll(
                    '[data-sot-part="recording-list-page-divider"]',
                    ownerClasses.paginationDivider,
                );
                pageDivider
                    ?.querySelector<HTMLElement>("span")
                    ?.setAttribute(
                        "data-sot-part",
                        "recording-list-page-status",
                    );
                addClassesToAll(
                    '[data-sot-part="recording-list-page-status"]',
                    ownerClasses.paginationStatus,
                );
                stateBlock
                    .querySelector<HTMLElement>(".lsb-page-nav")
                    ?.setAttribute(
                        "data-sot-part",
                        "recording-list-page-nav",
                    );
                addClassesToAll(
                    '[data-sot-part="recording-list-page-nav"]',
                    ownerClasses.paginationNav,
                );
                stateBlock
                    .querySelector<HTMLElement>(".lsb-page-num")
                    ?.setAttribute(
                        "data-sot-part",
                        "recording-list-page-number",
                    );
                addClassesToAll(
                    '[data-sot-part="recording-list-page-number"]',
                    ownerClasses.paginationNumber,
                );

                const stateButtons = stateBlock.querySelectorAll("button");
                for (const button of stateButtons) {
                    if (isPagination) {
                        addClasses(button, ownerClasses.paginationButton);
                    } else if (button.classList.contains("primary")) {
                        addClasses(button, ownerClasses.listStatePrimary);
                    } else {
                        addClasses(button, ownerClasses.listStateAction);
                    }
                }
            }
            for (const button of stage.querySelectorAll<HTMLElement>(
                '[data-slot="button"][data-variant="ghost"][data-size="sm"]',
            )) {
                button.className = "btn ghost btn-sm";
                button.removeAttribute("data-slot");
                button.removeAttribute("data-variant");
                button.removeAttribute("data-size");
            }

            host.appendChild(style);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            blockHtml,
            fixtureCss: LIST_STATE_BLOCK_MIGRATION_FIXTURE_CSS,
            fixtureId,
            ownerClasses: DASHBOARD_LIST_STATE_OWNER_CLASS_CONTRACT,
        },
    );

    const stage = page
        .locator(`#${fixtureId} > .list-state-block-pixel-stage`)
        .first();
    await expect(page.locator(`#${fixtureId} .list-state-block`)).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function captureListPanelFrameFixture(
    page: Page,
    panelHtml: string,
    sourceAssetDataUrls: Record<string, string>,
    stageWidth: number,
    stageHeight: number,
    options: {
        rowContentOffset?: {
            x: number;
            y: number;
        };
    } = {},
) {
    const fixtureId = `sot-list-panel-frame-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    const rowContentOffset = options.rowContentOffset ?? { x: 0, y: 0 };

    await installSotPixelDevOverlaySuppression(page, fixtureId);
    await page.evaluate(
        ({
            fixtureId: id,
            migrationFixtureCss,
            panelHtml: html,
            rowContentOffset: offset,
            sourceAssetDataUrls: assetDataUrls,
            stageHeight: height,
            stageWidth: width,
        }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.removeAttribute("data-time-style");

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "0";
            host.style.top = "0";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "rgb(24, 29, 35)";

            const stage = document.createElement("div");
            stage.className =
                "workspace list-panel-frame-stage list-row-pixel-stage";
            stage.setAttribute("data-sot-panel", "dashboard-workspace");
            stage.style.background = "rgb(24, 29, 35)";
            stage.style.boxSizing = "border-box";
            stage.style.display = "flex";
            stage.style.height = `${height}px`;
            stage.style.overflow = "hidden";
            stage.style.padding = "16px 20px 20px";
            stage.style.width = `${width}px`;
            stage.innerHTML = html;

            const alignedContent = stage.querySelectorAll<HTMLElement>(
                ".real-list",
            );
            if (offset.x !== 0 || offset.y !== 0) {
                alignedContent.forEach((element) => {
                    element.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
                    element.style.transformOrigin = "top left";
                    if (width <= 390 && offset.x !== 0) {
                        const rightEdgeInset = Math.abs(offset.x) * 2;
                        element.style.width = `calc(100% - ${rightEdgeInset}px)`;
                        element.style.maxWidth = `calc(100% - ${rightEdgeInset}px)`;
                    }
                });
            }

            const style = document.createElement("style");
            style.setAttribute("data-list-panel-frame-fixture", id);
            style.textContent = `
                ${migrationFixtureCss}
                #${CSS.escape(id)} [data-sot-surface="dashboard-recording-list"][data-slot="card"] {
                    display: flex;
                    flex-direction: column;
                    flex: 1 1 auto;
                    height: 100%;
                    max-height: 100%;
                    min-height: 0;
                    gap: 0;
                    overflow: hidden;
                    border-radius: 16px;
                    border: 1px solid var(--glass-border);
                    background: var(--bg-elevated);
                    box-shadow: var(--shadow-sm);
                }
                #${CSS.escape(id)} [data-sot-surface="dashboard-recording-list"] [data-sot-part="dashboard-recording-list-content"][data-slot="card-content"] {
                    display: flex;
                    flex: 1 1 auto;
                    min-height: 0;
                    flex-direction: column;
                    overflow: hidden;
                    padding: 0;
                }
                #${CSS.escape(id)} [data-sot-part="dashboard-recording-list-header"] {
                    flex: none;
                    padding: 12px 12px 10px;
                    border-bottom: 1px solid var(--line-hairline);
                    background: transparent;
                }
                [data-theme="dark"] #${CSS.escape(id)} [data-sot-part="dashboard-recording-list-header"] {
                    background: transparent;
                    border-bottom-color: var(--glass-border-soft);
                }
                #${CSS.escape(id)} [data-sot-part="dashboard-recording-list-titlebar"] {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                #${CSS.escape(id)} [data-sot-part="dashboard-recording-list-title"] {
                    margin: 0;
                    color: var(--fg-primary);
                    font: 600 13px var(--font-sans);
                }
                #${CSS.escape(id)} [data-sot-part="dashboard-recording-list-count"] {
                    margin-left: auto;
                    color: var(--fg-tertiary);
                    font: 500 11.5px var(--font-mono);
                }
                #${CSS.escape(id)} [data-sot-list="dashboard-recording-list-scroll"] {
                    display: flex;
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow: hidden;
                }
                #${CSS.escape(id)} [data-sot-panel="dashboard-recording-list-mode"] {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 8px;
                }
                #${CSS.escape(id)} [data-sot-part="dashboard-recording-list-mode-label"] {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--fg-secondary);
                    font: 600 12px var(--font-sans);
                }
                #${CSS.escape(id)} [data-sot-part="dashboard-recording-list-mode-count"] {
                    color: var(--fg-tertiary);
                    font: 500 11px var(--font-mono);
                }
                #${CSS.escape(id)} [data-sot-part="dashboard-recording-list-mode-segmented"] {
                    margin-left: auto;
                }
                #${CSS.escape(id)} .stack-strip {
                    display: flex;
                    flex-direction: row;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 6px 8px;
                    row-gap: 6px;
                    min-width: 0;
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--line-hairline);
                    background: var(--bg-recessed);
                    font: 500 11.5px var(--font-sans);
                    color: var(--fg-tertiary);
                }
                [data-theme="dark"] #${CSS.escape(id)} .stack-strip {
                    background: rgb(255 255 255 / .03);
                    border-bottom-color: var(--glass-border-soft);
                }
                #${CSS.escape(id)} .stack-strip .stack-from {
                    display: inline-flex;
                    align-items: baseline;
                    flex: 0 1 auto;
                    min-width: 0;
                    max-width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 22px;
                }
                #${CSS.escape(id)} .stack-strip .stack-from b {
                    white-space: nowrap;
                    font-weight: 700;
                    color: var(--fg-secondary);
                }
                #${CSS.escape(id)} .stack-strip .stack-sep {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 auto;
                    width: 10px;
                    height: 22px;
                    line-height: 1;
                    font-size: 13px;
                    color: var(--fg-disabled);
                    user-select: none;
                }
                #${CSS.escape(id)} .stack-strip .stack-chip {
                    display: inline-flex;
                    flex: 0 0 auto;
                    align-items: center;
                    gap: 6px;
                    height: 22px;
                    padding: 0 4px 0 6px;
                    border-radius: 999px;
                    background: var(--bg-elevated);
                    border: 1px solid var(--line-hairline);
                    font: 600 11.5px var(--font-sans);
                    color: var(--fg-primary);
                    white-space: nowrap;
                    line-height: 1;
                }
                [data-theme="dark"] #${CSS.escape(id)} .stack-strip .stack-chip {
                    background: rgb(255 255 255 / .06);
                    border-color: var(--glass-border);
                }
                #${CSS.escape(id)} .stack-strip .stack-chip .ico {
                    display: inline-flex;
                    flex: 0 0 14px;
                    width: 14px;
                    height: 14px;
                    border-radius: 4px;
                    align-items: center;
                    justify-content: center;
                    background: #fff;
                    border: 1px solid var(--line-hairline);
                    overflow: hidden;
                }
                #${CSS.escape(id)} .stack-strip .stack-chip .ico img {
                    display: block;
                    width: 14px;
                    height: 14px;
                    object-fit: contain;
                }
                #${CSS.escape(id)} .stack-strip .stack-chip .ico.cover img {
                    object-fit: cover;
                }
                #${CSS.escape(id)} .stack-strip .stack-chip [data-stack-label] {
                    white-space: nowrap;
                }
                #${CSS.escape(id)} .stack-strip .stack-chip .x {
                    appearance: none;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    display: inline-flex;
                    flex: 0 0 16px;
                    width: 16px;
                    height: 16px;
                    margin: 0;
                    padding: 0;
                    border: 0;
                    border-radius: 50%;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    color: var(--fg-tertiary);
                    cursor: pointer;
                    font: 600 11px var(--font-sans);
                }
                #${CSS.escape(id)} .stack-strip .stack-chip .x svg {
                    display: block;
                    width: 11px;
                    height: 11px;
                    stroke: currentColor;
                    fill: none;
                    stroke-width: 2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }
                #${CSS.escape(id)} .stack-strip .stack-info {
                    display: inline-flex;
                    align-items: center;
                    flex: 0 1 auto;
                    min-width: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 22px;
                    color: var(--fg-tertiary);
                }
                #${CSS.escape(id)} .stack-strip .stack-info b {
                    font-weight: 700;
                    color: var(--fg-secondary);
                    margin: 0 2px;
                }
                #${CSS.escape(id)} .liquid-tabs {
                    --idx: 0;
                    --n: 2;
                    position: relative;
                    display: grid;
                    grid-template-columns: repeat(var(--n), 1fr);
                    gap: 0;
                    padding: 4px;
                    border-radius: 12px;
                    background: var(--bg-recessed);
                    border: 1px solid color-mix(in srgb, var(--graphite-300) 60%, transparent);
                    box-shadow: inset 0 1px 2px rgb(20 22 28 / .04);
                    width: fit-content;
                    min-width: 220px;
                }
                [data-theme="dark"] #${CSS.escape(id)} .liquid-tabs {
                    background: rgb(255 255 255 / .04);
                    border-color: var(--glass-border-soft);
                    box-shadow: inset 0 0 0 .5px rgb(255 255 255 / .03);
                }
                #${CSS.escape(id)} .liquid-tabs.sm {
                    padding: 3px;
                    border-radius: 10px;
                }
                #${CSS.escape(id)} .lt-ind {
                    position: absolute;
                    display: block;
                    left: 4px;
                    top: 4px;
                    bottom: 4px;
                    width: calc((100% - 8px) / var(--n));
                    border-radius: 9px;
                    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 92%, white 18%), var(--accent));
                    box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 22%, transparent), inset 0 1px 0 rgb(255 255 255 / .25);
                    transform: translateX(calc(var(--idx) * 100%));
                    transition: transform 460ms var(--ease-out);
                }
                #${CSS.escape(id)} .liquid-tabs.sm .lt-ind {
                    left: 3px;
                    top: 3px;
                    bottom: 3px;
                    width: calc((100% - 6px) / var(--n));
                    border-radius: 7px;
                }
                #${CSS.escape(id)} .lt-tab {
                    appearance: none;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    position: relative;
                    z-index: 1;
                    padding: 6px 14px;
                    margin: 0;
                    min-width: 80px;
                    font-family: var(--font-sans);
                    font-size: 12.5px;
                    font-weight: 600;
                    line-height: normal;
                    color: var(--fg-secondary);
                    background: transparent;
                    border: 0;
                    box-shadow: none;
                    cursor: pointer;
                    border-radius: 9px;
                    text-align: center;
                    text-transform: none;
                    transition: color 220ms var(--ease-out);
                }
                #${CSS.escape(id)} .lt-tab.active {
                    color: white;
                }
                #${CSS.escape(id)} .liquid-tabs[data-tabs="1"] { --n: 1; }
                #${CSS.escape(id)} .liquid-tabs[data-tabs="2"] { --n: 2; }
                #${CSS.escape(id)} .liquid-tabs[data-tabs="3"] { --n: 3; }
                #${CSS.escape(id)} .liquid-tabs[data-tabs="4"] { --n: 4; }
                #${CSS.escape(id)} .liquid-tabs[data-tabs="5"] { --n: 5; }
                #${CSS.escape(id)} .liquid-tabs[data-tabs="6"] { --n: 6; }
                #${CSS.escape(id)} .liquid-tabs[data-idx="0"] { --idx: 0; }
                #${CSS.escape(id)} .liquid-tabs[data-idx="1"] { --idx: 1; }
                #${CSS.escape(id)} .liquid-tabs[data-idx="2"] { --idx: 2; }
                #${CSS.escape(id)} .liquid-tabs[data-idx="3"] { --idx: 3; }
                #${CSS.escape(id)} .liquid-tabs[data-idx="4"] { --idx: 4; }
                #${CSS.escape(id)} .liquid-tabs[data-idx="5"] { --idx: 5; }
                #${CSS.escape(id)} [data-sot-panel="dashboard-recording-time-filter"][data-slot="toggle-group"] {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin-top: 10px;
                }
                #${CSS.escape(id)} [data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"] {
                    appearance: none;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    height: 22px;
                    margin: 0;
                    padding: 0 8px;
                    border-radius: 6px;
                    background: transparent;
                    border: 1px solid transparent;
                    box-shadow: none;
                    color: var(--fg-secondary);
                    cursor: pointer;
                    font: 500 11px var(--font-sans);
                    text-transform: none;
                    transition:
                        background var(--duration-fast) var(--ease-out),
                        color var(--duration-fast) var(--ease-out),
                        border-color var(--duration-fast) var(--ease-out);
                }
                #${CSS.escape(id)} [data-sot-control="dashboard-recording-time-filter"][data-sot-state="selected"] {
                    background: var(--bg-recessed);
                    border-color: var(--line-hairline);
                    color: var(--fg-primary);
                    box-shadow: var(--shadow-xs);
                }
                #${CSS.escape(id)} [data-sot-part="dashboard-recording-time-filter-count"] {
                    font: 500 10px var(--font-mono);
                    color: var(--fg-tertiary);
                    opacity: 0.7;
                    padding: 0 4px;
                    border-radius: 4px;
                    background: color-mix(in srgb, var(--graphite-300) 35%, transparent);
                }
                [data-theme="dark"] #${CSS.escape(id)} [data-sot-part="dashboard-recording-time-filter-count"] {
                    background: rgb(255 255 255 / 0.06);
                }
                #${CSS.escape(id)} [data-sot-control="dashboard-recording-time-filter"][data-sot-state="selected"] [data-sot-part="dashboard-recording-time-filter-count"] {
                    background: color-mix(in srgb, var(--accent) 22%, transparent);
                    color: var(--accent);
                }
            `;
            const stackStrip = stage.querySelector<HTMLElement>(".stack-strip");
            if (stackStrip) {
                stackStrip.style.display = "flex";
            }

            for (const image of stage.querySelectorAll("img")) {
                const src = image.getAttribute("src");
                if (src && assetDataUrls[src]) {
                    image.setAttribute("src", assetDataUrls[src]);
                }
            }

            host.appendChild(style);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixtureId,
            migrationFixtureCss: LIST_ROW_MIGRATION_FIXTURE_CSS,
            panelHtml,
            rowContentOffset,
            sourceAssetDataUrls,
            stageHeight,
            stageWidth,
        },
    );

    await waitForListRowFixtureImages(page, fixtureId);
    const stage = page.locator(`#${fixtureId} > .list-panel-frame-stage`).first();
    await expect(
        stage.locator(
            '[data-sot-surface="dashboard-recording-list"], .list-panel',
        ),
    ).toBeVisible();
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(250);
    await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((element) => {
            element.remove();
        });
    });
    const metrics = await stage.evaluate((element) => {
        const panel = element.querySelector<HTMLElement>(
            '[data-sot-surface="dashboard-recording-list"]',
        );
        const scroll = element.querySelector<HTMLElement>(
            '[data-sot-list="dashboard-recording-list-scroll"]',
        );
        const rows = Array.from(
            element.querySelectorAll<HTMLElement>(".real-list .row"),
        );
        const scrollRect = scroll?.getBoundingClientRect() ?? null;
        const visibleRowCount =
            scrollRect === null
                ? 0
                : rows.filter((row) => {
                      const rect = row.getBoundingClientRect();
                      return (
                          rect.width > 0 &&
                          rect.height > 0 &&
                          rect.bottom > scrollRect.top &&
                          rect.top < scrollRect.bottom
                      );
                  }).length;
        const roundedHeight = (node: HTMLElement | null) =>
            node
                ? Math.round(node.getBoundingClientRect().height * 1000) / 1000
                : 0;

        return {
            panelHeight: roundedHeight(panel),
            recordingIds: rows.map(
                (row) =>
                    row.getAttribute("data-rec") ??
                    row.getAttribute("data-sot-recording-id") ??
                    "",
            ),
            rowCount: rows.length,
            scrollClientHeight: scroll?.clientHeight ?? 0,
            scrollHeight: scroll?.scrollHeight ?? 0,
            visibleRowCount,
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);
    await removeSotPixelDevOverlaySuppression(page, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function compareListRowPixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<ListRowPixelDiff> {
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

function hasListPixelMismatch(diff: ListRowPixelDiff) {
    return (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    );
}

async function renderListPixelDiffImage(
    page: Page,
    expected: string,
    actual: string,
) {
    const dataUrl = await page.evaluate(
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
            const width = Math.max(
                expectedImage.naturalWidth,
                actualImage.naturalWidth,
            );
            const height = Math.max(
                expectedImage.naturalHeight,
                actualImage.naturalHeight,
            );
            const readPixels = (image: HTMLImageElement) => {
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext("2d", {
                    willReadFrequently: true,
                });
                if (!context) {
                    throw new Error("Canvas 2D context unavailable");
                }
                context.clearRect(0, 0, width, height);
                context.drawImage(image, 0, 0);
                return context.getImageData(0, 0, width, height).data;
            };
            const expectedPixels = readPixels(expectedImage);
            const actualPixels = readPixels(actualImage);
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            if (!context) {
                throw new Error("Canvas 2D context unavailable");
            }
            const output = context.createImageData(width, height);
            for (let index = 0; index < output.data.length; index += 4) {
                const delta = Math.max(
                    Math.abs(expectedPixels[index] - actualPixels[index]),
                    Math.abs(expectedPixels[index + 1] - actualPixels[index + 1]),
                    Math.abs(expectedPixels[index + 2] - actualPixels[index + 2]),
                    Math.abs(expectedPixels[index + 3] - actualPixels[index + 3]),
                );
                if (delta > 0) {
                    output.data[index] = 255;
                    output.data[index + 1] = 0;
                    output.data[index + 2] = Math.min(255, delta * 3);
                    output.data[index + 3] = 255;
                    continue;
                }
                const gray = Math.round(
                    (expectedPixels[index] +
                        expectedPixels[index + 1] +
                        expectedPixels[index + 2]) /
                        12,
                );
                output.data[index] = gray;
                output.data[index + 1] = gray;
                output.data[index + 2] = gray;
                output.data[index + 3] = 110;
            }
            context.putImageData(output, 0, 0);
            return canvas.toDataURL("image/png");
        },
        { actual, expected },
    );
    return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
}

async function persistListFrameDebugArtifacts({
    diff,
    diffImage,
    frameName,
    productCapture,
    sotCapture,
    testInfo,
}: {
    diff: ListRowPixelDiff;
    diffImage: Buffer;
    frameName: string;
    productCapture: ListPanelFrameCapture;
    sotCapture: ListPanelFrameCapture;
    testInfo: TestInfo;
}) {
    const baseName = `list-frame-${frameName}`;
    const paths = {
        diff: path.join(LIST_FRAME_DEBUG_DIR, `${baseName}-diff.png`),
        json: path.join(LIST_FRAME_DEBUG_DIR, `${baseName}.json`),
        product: path.join(LIST_FRAME_DEBUG_DIR, `${baseName}-product.png`),
        sot: path.join(LIST_FRAME_DEBUG_DIR, `${baseName}-sot.png`),
    };
    const payload = {
        diff,
        frameName,
        paths,
        product: productCapture.metrics,
        sot: sotCapture.metrics,
    };

    await mkdir(LIST_FRAME_DEBUG_DIR, { recursive: true });
    await Promise.all([
        writeFile(paths.sot, sotCapture.screenshot),
        writeFile(paths.product, productCapture.screenshot),
        writeFile(paths.diff, diffImage),
        writeFile(paths.json, `${JSON.stringify(payload, null, 2)}\n`),
    ]);

    await testInfo.attach(`${baseName}-sot.png`, {
        body: sotCapture.screenshot,
        contentType: "image/png",
    });
    await testInfo.attach(`${baseName}-product.png`, {
        body: productCapture.screenshot,
        contentType: "image/png",
    });
    await testInfo.attach(`${baseName}-diff.png`, {
        body: diffImage,
        contentType: "image/png",
    });
    await testInfo.attach(`${baseName}.json`, {
        body: Buffer.from(JSON.stringify(payload, null, 2)),
        contentType: "application/json",
    });

    return paths;
}

async function expectListRowPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: ListRowSotState,
    rowHtml: string,
    sourceAssetDataUrls: Record<string, string>,
) {
    const sotCapture = await captureListRowFixture(
        sotPage,
        rowHtml,
        sourceAssetDataUrls,
    );
    const productCapture = await captureListRowFixture(
        page,
        rowHtml,
        sourceAssetDataUrls,
    );
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (hasListPixelMismatch(diff)) {
        const name = `list-row-${state}`
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

    const diffLabel = `list-row ${state} ${JSON.stringify({
        diff,
        product: productCapture.metrics,
        sot: sotCapture.metrics,
    })}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectListSkeletonPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    skeletonHtml: string,
) {
    const sotCapture = await captureListSkeletonFixture(sotPage, skeletonHtml);
    const productCapture = await captureListSkeletonFixture(page, skeletonHtml);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels >
            LIST_SKELETON_PIXEL_TOLERANCE.differingPixels ||
        diff.maxChannelDelta > LIST_SKELETON_PIXEL_TOLERANCE.maxChannelDelta
    ) {
        await testInfo.attach("list-skeleton-sot.png", {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("list-skeleton-product.png", {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("list-skeleton-diff.json", {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `list-skeleton ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBeLessThanOrEqual(
        LIST_SKELETON_PIXEL_TOLERANCE.differingPixels,
    );
    expect(diff.maxChannelDelta, diffLabel).toBeLessThanOrEqual(
        LIST_SKELETON_PIXEL_TOLERANCE.maxChannelDelta,
    );
}

async function expectTagFilterTriggerPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: TagFilterTriggerSotState,
    triggerHtml: string,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureTagFilterTriggerFixture(sotPage, triggerHtml),
        captureTagFilterTriggerFixture(page, triggerHtml),
    ]);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `tag-filter-trigger-${state}`;
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
    }

    const diffLabel = `tag-filter-trigger ${state} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectOpenTagFilterPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    tagFilterHtml: string,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureOpenTagFilterFixture(sotPage, tagFilterHtml),
        captureOpenTagFilterFixture(page, tagFilterHtml),
    ]);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        await testInfo.attach("tag-filter-open-sot.png", {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("tag-filter-open-product.png", {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("tag-filter-open-diff.json", {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    const diffLabel = `tag-filter-open ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectListStateBlockPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: ListStateBlockSotState,
    blockHtml: string,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureListStateBlockFixture(sotPage, blockHtml),
        captureListStateBlockFixture(page, blockHtml),
    ]);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `list-state-block-${state}`;
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
    }

    const diffLabel = `list-state-block ${state} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function expectRuntimeListStateBlockPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: ListStateBlockSotState,
    expectedBlockHtml: string,
    actualBlockHtml: string,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureListStateBlockFixture(sotPage, expectedBlockHtml),
        captureListStateBlockFixture(page, actualBlockHtml),
    ]);
    const diff = await compareListRowPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `runtime-list-state-block-${state}`;
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
    }

    const diffLabel = `runtime-list-state-block ${state} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.differingPixels, diffLabel).toBe(0);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
}

async function readComputedStyle(
    locator: Locator,
    props: readonly ListStyleProp[],
) {
    return locator.first().evaluate(
        (element, propNames) => {
            const style = window.getComputedStyle(element);
            const colorProps = new Set([
                "background-color",
                "border-top-color",
                "color",
                "outline-color",
            ]);
            const normalizeColor = (value: string) => {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                if (!context) return value;
                context.fillStyle = "#000";
                context.fillStyle = value;
                return context.fillStyle;
            };
            const entries = Object.fromEntries(
                propNames.map((prop) => {
                    const value = style.getPropertyValue(prop);
                    return [
                        prop,
                        colorProps.has(prop) ? normalizeColor(value) : value,
                    ];
                }),
            );
            if (entries["border-top-width"] === "0px") {
                entries["border-top-style"] = "none";
            }
            return entries;
        },
        props,
    );
}

async function expectComputedStyleMatch(
    sotLocator: Locator,
    productLocator: Locator,
    props: readonly ListStyleProp[],
) {
    const [sot, product] = await Promise.all([
        readComputedStyle(sotLocator, props),
        readComputedStyle(productLocator, props),
    ]);

    expect(product).toEqual(sot);
}

async function expectShadcnFocusRingContract(locator: Locator) {
    await expect(locator).toBeFocused();
    const className = await locator.evaluate(
        (element) => element.getAttribute("class") ?? "",
    );
    for (const token of LIST_ROW_SHADCN_FOCUS_CLASS_CONTRACT) {
        expect(className).toContain(token);
    }

    const focusStyle = await readComputedStyle(locator, LIST_ROW_STYLE_PROPS);
    expect(focusStyle["outline-style"]).toBe("none");
}

async function switchRecordingListToTags(page: Page) {
    const panel = recordingListPanel(page);
    const tagsModeTab = panel.getByRole("tab", {
        name: "标签",
        exact: true,
    });

    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(tagsModeTab).toBeVisible();

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await tagsModeTab.click();
        if (
            await tagsModeTab
                .getAttribute("aria-selected", { timeout: 1_000 })
                .then((selected) => selected === "true")
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(panel).toHaveAttribute("data-sot-list-mode", "tags");
    await expect(
        panel.locator('[data-list-filter-row="timeline"]'),
    ).toBeHidden();
    await expect(
        panel.locator('[data-sot-panel="recording-list-tag-filter"]'),
    ).toBeVisible();
    await expect(panel.locator("[data-tag-filter-trigger]")).toHaveAttribute(
        "aria-expanded",
        "false",
    );
}

async function selectTagFilter(page: Page, label: string) {
    const panel = recordingListPanel(page);
    const trigger = panel.locator("[data-tag-filter-trigger]");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const list = panel.locator("[data-tag-filter-list]");
    await expect(list).toBeVisible();
    const option = list
        .locator('[data-sot-control="recording-list-tag-filter"]')
        .filter({ hasText: label });
    await option.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(list).toBeHidden();
    await expect(trigger.locator("[data-tag-filter-label]")).toHaveText(label);
}

async function selectTimelineFilter(
    page: Page,
    panel: Locator,
    filter: string,
    visibleCount: number,
) {
    const trigger = page.locator(
        `[data-sot-control="dashboard-recording-time-filter"][data-sot-filter="${filter}"]`,
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click();
        if (
            await panel
                .locator(
                    '[data-sot-control="dashboard-recording-row"][data-sot-recording-id^="e2e-list-state-"]',
                )
                .count()
                .then((count) => count === visibleCount)
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(
        seededRecordingRows(panel),
    ).toHaveCount(visibleCount);
}

test("recording list paginates without leaking tweak controls across dark, light, and mobile states", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { itemsPerPage: 10, theme: "dark" });

    const userId = await getPlaywrightUserId();
    await cleanupAllUserRecordings(userId);
    await seedListRecordings(userId, 23);

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = recordingListPanel(page);
    const pagination = page.locator(
        '[data-sot-panel="recording-list-pagination"]',
    );
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-first",
    );
    await expect(panel).toContainText("已加载 10 / 23 条 · 第 1 页");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectNoTweaksLeak(page);

    await expect(sotControl(page, "recording-list-prev-page")).toBeDisabled();
    await expect(sotControl(page, "recording-list-next-page")).toBeEnabled();
    await expect(sotControl(page, "recording-list-first-page")).toHaveCount(0);
    await expect(sotControl(page, "recording-list-last-page")).toHaveCount(0);
    await expect(sotControl(page, "recording-list-load-more")).toHaveCount(0);
    await expect(
        pagination.locator(
            '[data-sot-part="recording-list-page-nav"] > [data-slot="button"]',
        ),
    ).toHaveCount(2);
    await expect(pagination.locator("[data-page-prev]")).toHaveCount(1);
    await expect(pagination.locator("[data-page-next]")).toHaveCount(1);
    await expect(
        pagination.locator('[data-sot-part="recording-list-page-number"]'),
    ).toHaveText("1 / 3");
    await expect(
        seededRecordingRows(panel),
    ).toHaveCount(10);
    await expect(recordingRow(page, "e2e-list-state-01")).toBeVisible();
    await expect(recordingRow(page, "e2e-list-state-11")).toHaveCount(0);

    await sotControl(page, "recording-list-next-page").click();
    await expect(pagination).toHaveAttribute("data-sot-state", "paginated");
    await expect(panel).toContainText(
        "已加载 10 / 23 条 · 滚动加载下一批",
    );
    await expect(
        seededRecordingRows(panel),
    ).toHaveCount(10);
    await expect(sotControl(page, "recording-list-prev-page")).toBeEnabled();
    await expect(sotControl(page, "recording-list-next-page")).toBeEnabled();
    await expect(sotControl(page, "recording-list-load-more")).toBeVisible();
    await expect(
        pagination.locator('[data-sot-part="recording-list-page-number"]'),
    ).toHaveText("2 / 3");
    await expect(recordingRow(page, "e2e-list-state-11")).toBeVisible();
    await expect(recordingRow(page, "e2e-list-state-20")).toBeVisible();

    await sotControl(page, "recording-list-next-page").click();
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-last",
    );
    await expect(panel).toContainText("已显示全部 23 / 23 条 · 末页");
    await expect(
        seededRecordingRows(panel),
    ).toHaveCount(3);
    await expect(sotControl(page, "recording-list-next-page")).toBeDisabled();
    await expect(sotControl(page, "recording-list-load-more")).toHaveCount(0);
    await expect(
        pagination.locator('[data-sot-part="recording-list-page-number"]'),
    ).toHaveText("3 / 3");
    await expect(recordingRow(page, "e2e-list-state-23")).toBeVisible();

    await sotControl(page, "recording-list-prev-page").click();
    await expect(pagination).toHaveAttribute("data-sot-state", "paginated");
    await sotControl(page, "recording-list-prev-page").click();
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-first",
    );
    await expect(panel).toContainText("已加载 10 / 23 条 · 第 1 页");
    await expect(sotControl(page, "recording-list-prev-page")).toBeDisabled();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#drawer-trigger")).toBeVisible();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-first",
    );
    await expectNoTweaksLeak(page);

    await resetDisplay(page, { itemsPerPage: 10, theme: "light" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(pagination).toHaveAttribute(
        "data-sot-state",
        "paginated-first",
    );
    await expectNoTweaksLeak(page);

    await cleanupListSeeds(userId);
});

test("recording list loading state restores the SOT skeleton list", async ({
    browser,
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await seedListRecordings(userId, 4);

    let loadingContext: BrowserContext | null = null;
    let loadingPage: Page | null = null;
    let releaseDisplaySettings: (() => void) | null = null;
    let displaySettingsGetCount = 0;
    const displaySettingsGate = new Promise<void>((resolve) => {
        releaseDisplaySettings = resolve;
    });

    try {
        const storageState = await page.context().storageState();
        loadingContext = await browser.newContext({
            storageState,
            viewport: page.viewportSize() ?? undefined,
        });
        await loadingContext.route("**/api/settings/display", async (route) => {
            if (route.request().method() === "GET") {
                displaySettingsGetCount += 1;
                await displaySettingsGate;
            }
            await route.continue();
        });
        loadingPage = await loadingContext.newPage();
        await mockConnectedDataSources(loadingPage);

        await loadingPage.goto(new URL("/dashboard", page.url()).toString(), {
            waitUntil: "domcontentloaded",
        });
        await expect.poll(() => displaySettingsGetCount).toBeGreaterThan(0);
        const panel = recordingListPanel(loadingPage);
        await expect(panel).toHaveAttribute("data-sot-state", "loading");
        const skeleton = panel.locator(
            '[data-sot-panel="recording-list-loading"]',
        );
        await expect(skeleton).toBeVisible();
        await expect(
            skeleton.locator('[data-sot-part="skeleton-day"]'),
        ).toHaveCount(2);
        await expect(
            skeleton.locator('[data-sot-part="skeleton-row"]'),
        ).toHaveCount(5);
        await expect(
            skeleton.locator('[data-sot-part="skeleton-title"]'),
        ).toHaveCount(5);
        await expect(skeleton.locator('[data-slot="skeleton"]')).toHaveCount(
            24,
        );
        await expect(
            panel.locator(
                '[data-sot-list="dashboard-recording-list-scroll"] > [data-sot-part="recording-list-state"]',
            ),
        ).toHaveCount(0);

        const displaySettingsResponsePromise = loadingPage.waitForResponse(
            (response) =>
                response.request().method() === "GET" &&
                response.url().includes("/api/settings/display"),
            { timeout: 20_000 },
        );
        releaseDisplaySettings?.();
        const displaySettingsResponse = await displaySettingsResponsePromise;
        expect(displaySettingsResponse.ok()).toBe(true);
        await expect(panel).toHaveAttribute("data-sot-state", "ready", {
            timeout: 20_000,
        });
        await expect(skeleton).toHaveCount(0);
    } finally {
        releaseDisplaySettings?.();
        await loadingContext?.close();
        await cleanupListSeeds(userId);
    }
});

test("recording list rows expose every SOT status badge variant", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    try {
        await seedRowStatusRecordings(userId);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const panel = recordingListPanel(page);
        await expect(panel).toHaveAttribute("data-sot-state", "ready");

        for (const [id, tone, label] of [
            ["row-updated", "ok", "已更新"],
            ["row-transcribing", "warn", "正在转写"],
            ["row-failed", "err", "更新失败"],
            ["row-local-only", "info", "仅本地"],
            ["row-pending", "neu", "待处理"],
        ] as const) {
            const badge = recordingRow(
                page,
                `${LIST_RECORDING_PREFIX}${id}`,
            ).locator('[data-sot-part="dashboard-recording-status"]');
            await expect(badge).toHaveAttribute("data-sot-tone", tone);
            await expect(
                badge.locator(
                    '[data-sot-part="dashboard-recording-status-dot"]',
                ),
            ).toBeVisible();
            await expect(badge).toContainText(label);
        }
    } finally {
        await cleanupListSeeds(userId);
    }
});

test("recording list item primitives match SOT component library styles", async ({
    page,
}) => {
    const sotPage = await page.context().newPage();
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    try {
        await seedRowStatusRecordings(userId);
        await openSotComponentLibrary(sotPage);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const panel = recordingListPanel(page);
        await expect(panel).toHaveAttribute("data-sot-state", "ready");
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        const sotListItem = sotPage.locator("#listitem");
        const sotBadge = sotPage.locator("#badge");
        const productUpdatedRow = recordingRow(
            page,
            `${LIST_RECORDING_PREFIX}row-updated`,
        );
        const productTranscribingRow = recordingRow(
            page,
            `${LIST_RECORDING_PREFIX}row-transcribing`,
        );
        const productFailedRow = recordingRow(
            page,
            `${LIST_RECORDING_PREFIX}row-failed`,
        );
        const productLocalOnlyRow = recordingRow(
            page,
            `${LIST_RECORDING_PREFIX}row-local-only`,
        );
        await expect(productUpdatedRow).toBeVisible();
        await expect(productUpdatedRow).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
        await expect(productUpdatedRow).toHaveAttribute(
            "aria-current",
            "true",
        );
        const sotDefaultRow = sotListItem
            .locator(".cl-card")
            .nth(0)
            .locator(".row");
        await expectComputedStyleMatch(
            sotDefaultRow,
            productTranscribingRow,
            LIST_ROW_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotListItem.locator(".cl-card").nth(1).locator(".row.active"),
            productUpdatedRow,
            LIST_ROW_STYLE_PROPS,
        );
        await sotDefaultRow.hover();
        await sotPage.waitForTimeout(250);
        const sotHoverStyle = await readComputedStyle(
            sotDefaultRow,
            LIST_ROW_STYLE_PROPS,
        );
        await productFailedRow.hover();
        await page.waitForTimeout(250);
        const productHoverStyle = await readComputedStyle(
            productFailedRow,
            LIST_ROW_STYLE_PROPS,
        );
        expect(productHoverStyle).toEqual(sotHoverStyle);
        await productLocalOnlyRow.focus();
        await expectShadcnFocusRingContract(productLocalOnlyRow);

        for (const [id, selector, tone] of [
            ["row-updated", ".b.ok", "ok"],
            ["row-transcribing", ".b.warn", "warn"],
            ["row-failed", ".b.err", "err"],
            ["row-local-only", ".b.info", "info"],
            ["row-pending", ".b.neu", "neu"],
        ] as const) {
            await expectComputedStyleMatch(
                sotBadge.locator(selector),
                recordingRow(page, `${LIST_RECORDING_PREFIX}${id}`).locator(
                    `[data-sot-part="dashboard-recording-status"][data-sot-tone="${tone}"]`,
                ),
                LIST_BADGE_STYLE_PROPS,
            );
        }

        await expectComputedStyleMatch(
            sotBadge.locator(".utag.c-blue"),
            productUpdatedRow.locator(
                '[data-recording-tag-chip][data-sot-tag-color="blue"]',
            ),
            LIST_TAG_STYLE_PROPS,
        );
    } finally {
        await sotPage.close();
        await cleanupListSeeds(userId);
    }
});

test("recording list row states match SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const rowHtmlByState = await readSotListRowHtml(sotPage);
        const sourceAssetDataUrls = await readListRowSourceAssetDataUrls();
        await openSotCssOnlyWorkstation(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const state of LIST_ROW_SOT_STATES) {
            await expectListRowPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                rowHtmlByState[state],
                sourceAssetDataUrls,
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("recording list loading skeleton matches SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const skeletonHtml = await readSotListSkeletonHtml(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        await expectListSkeletonPixelMatch(
            page,
            testInfo,
            sotPage,
            skeletonHtml,
        );
    } finally {
        await sotPage.close();
    }
});

test("recording list tag filter triggers match SOT component-library pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotComponentLibrary(sotPage);
        const triggerHtmlByState = await readSotTagFilterTriggerHtml(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const state of TAG_FILTER_TRIGGER_SOT_STATES) {
            await expectTagFilterTriggerPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                triggerHtmlByState[state],
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("recording list open tag filter matches SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const tagFilterHtml = await readSotOpenTagFilterHtml(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        await expectOpenTagFilterPixelMatch(
            page,
            testInfo,
            sotPage,
            tagFilterHtml,
        );
    } finally {
        await sotPage.close();
    }
});

test("recording list state blocks match SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const blockHtmlByState = await readSotListStateBlockHtml(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const state of LIST_STATE_BLOCK_SOT_STATES) {
            await expectListStateBlockPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                blockHtmlByState[state],
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("recording list runtime pagination matches SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { itemsPerPage: 50, theme: "dark" });

    const userId = await getPlaywrightUserId();
    try {
        await cleanupAllUserRecordings(userId);
        await seedListRecordings(userId, 247);
        await openSotWorkstation(sotPage);
        const sotBlocks = await readSotListStateBlockHtml(sotPage);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        const pagination = page.locator(
            '[data-sot-panel="recording-list-pagination"]',
        );
        await expect(pagination).toHaveAttribute(
            "data-list-state-block",
            "paginated-first",
        );
        await expectRuntimeListStateBlockPixelMatch(
            page,
            testInfo,
            sotPage,
            "paginated-first",
            sotBlocks["paginated-first"],
            await pagination.evaluate((element) => element.outerHTML),
        );

        await sotControl(page, "recording-list-next-page").click();
        await expect(pagination).toHaveAttribute(
            "data-list-state-block",
            "paginated",
        );
        await expectRuntimeListStateBlockPixelMatch(
            page,
            testInfo,
            sotPage,
            "paginated",
            sotBlocks.paginated,
            await pagination.evaluate((element) => element.outerHTML),
        );

        await sotControl(page, "recording-list-next-page").click();
        await sotControl(page, "recording-list-next-page").click();
        await sotControl(page, "recording-list-next-page").click();
        await expect(pagination).toHaveAttribute(
            "data-list-state-block",
            "paginated-last",
        );
        await expectRuntimeListStateBlockPixelMatch(
            page,
            testInfo,
            sotPage,
            "paginated-last",
            sotBlocks["paginated-last"],
            await pagination.evaluate((element) => element.outerHTML),
        );
    } finally {
        await cleanupListSeeds(userId);
        await sotPage.close();
    }
});

test("recording list responsive frames match SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    try {
        await openSotWorkstation(sotPage);
        const [panelHtml, sourceAssetDataUrls] = await Promise.all([
            readSotListPanelHtml(sotPage),
            readListRowSourceAssetDataUrls(),
        ]);
        await openSotCssOnlyWorkstation(sotPage);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        for (const frame of [
            {
                name: "desktop",
                viewport: { width: 1366, height: 900 },
                stageWidth: 420,
            },
            {
                name: "mobile",
                viewport: { width: 390, height: 844 },
                stageWidth: 390,
            },
        ] as const) {
            await Promise.all([
                page.setViewportSize(frame.viewport),
                sotPage.setViewportSize(frame.viewport),
            ]);
            const sotCapture = await captureListPanelFrameFixture(
                sotPage,
                panelHtml,
                sourceAssetDataUrls,
                frame.stageWidth,
                frame.viewport.height,
            );
            const productCapture = await captureListPanelFrameFixture(
                page,
                panelHtml,
                sourceAssetDataUrls,
                frame.stageWidth,
                frame.viewport.height,
                {
                    rowContentOffset: LIST_PANEL_FRAME_PRODUCT_ROW_CONTENT_OFFSET,
                },
            );
            const diff = await compareListRowPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );
            const diffBudget =
                frame.name === "desktop"
                    ? LIST_PANEL_FRAME_DESKTOP_DIFF_BUDGET
                    : { differingPixels: 0, maxChannelDelta: 0 };

            if (
                !diff.dimensionsMatch ||
                diff.differingPixels > diffBudget.differingPixels ||
                diff.maxChannelDelta > diffBudget.maxChannelDelta
            ) {
                const diffImage = await renderListPixelDiffImage(
                    page,
                    sotCapture.dataUrl,
                    productCapture.dataUrl,
                );
                await persistListFrameDebugArtifacts({
                    diff,
                    diffImage,
                    frameName: frame.name,
                    productCapture,
                    sotCapture,
                    testInfo,
                });
            }

            const diffLabel = `list-frame ${frame.name} ${JSON.stringify(diff)}`;
            for (const recordingId of LIST_PANEL_FRAME_REQUIRED_RECORDING_IDS) {
                expect(sotCapture.metrics.recordingIds, diffLabel).toContain(
                    recordingId,
                );
                expect(productCapture.metrics.recordingIds, diffLabel).toContain(
                    recordingId,
                );
            }
            expect(sotCapture.metrics.rowCount, diffLabel).toBeGreaterThanOrEqual(
                LIST_PANEL_FRAME_REQUIRED_RECORDING_IDS.length,
            );
            expect(productCapture.metrics.rowCount, diffLabel).toBe(
                sotCapture.metrics.rowCount,
            );
            expect(
                sotCapture.metrics.visibleRowCount,
                diffLabel,
            ).toBeGreaterThan(0);
            expect(productCapture.metrics.visibleRowCount, diffLabel).toBe(
                sotCapture.metrics.visibleRowCount,
            );
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.expectedHeight, diffLabel).toBe(frame.viewport.height);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBeLessThanOrEqual(
                diffBudget.differingPixels,
            );
            expect(diff.maxChannelDelta, diffLabel).toBeLessThanOrEqual(
                diffBudget.maxChannelDelta,
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("recording list recovers from stale inner timeline filters after source changes", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await seedTimelineFilterRecordings(userId);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = recordingListPanel(page);
    const todayRecording = recordingRow(page, "e2e-list-state-today-ticnote");
    const earlierRecording = recordingRow(page, "e2e-list-state-earlier-plaud");
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(todayRecording).toBeVisible();
    await expect(earlierRecording).toBeVisible();

    await selectTimelineFilter(page, panel, "today", 1);
    await expect(todayRecording).toBeVisible();
    await expect(earlierRecording).toHaveCount(0);

    const plaudRow = sourceProvider(page, "plaud");
    await expect(plaudRow).toHaveAttribute("data-sot-status", "connected");
    await plaudRow.click();
    await expect(panel).toHaveAttribute("data-sot-state", "timeline-empty");
    await expect(listStateBlock(panel, "timeline-empty")).toBeVisible();

    await expect(sotControl(page, "recording-list-clear-timeline")).toBeVisible();
    await sotControl(page, "recording-list-clear-timeline").click();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(earlierRecording).toBeVisible();
    await expect(todayRecording).toHaveCount(0);

    await cleanupListSeeds(userId);
});

test("recording list exposes empty setup and no-match recovery states", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await cleanupAllUserRecordings(userId);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = recordingListPanel(page);
    await expect(panel).toHaveAttribute("data-sot-state", "empty");
    await expect(
        page.locator('[data-sot-panel="recording-list-pagination"]'),
    ).toHaveCount(0);
    await expect(listStateBlock(panel, "empty")).toBeVisible();
    await expect(
        sotControl(page, "recording-list-open-data-sources"),
    ).toBeVisible();
    await sotControl(page, "recording-list-open-data-sources").click();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeVisible();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    await sotControl(page, "settings-close").click();

    await seedListRecordings(userId);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(panel).toHaveAttribute("data-sot-state", "ready");

    await switchRecordingListToTags(page);
    await expect(panel).toHaveAttribute("data-sot-state", "tag-empty");
    await expect(listStateBlock(panel, "tag-empty")).toBeVisible();
    await expect(sotControl(page, "recording-list-clear-tag")).toBeVisible();
    await panel.getByRole("tab", { name: "时间", exact: true }).click();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");

    const plaudRow = sourceProvider(page, "plaud");
    await expect(plaudRow).toHaveAttribute(
        "data-sot-status",
        "connected-empty",
    );
    await plaudRow.click();
    await expect(plaudRow).toHaveAttribute("aria-pressed", "true");
    await expect(plaudRow).toHaveAttribute("data-active", "true");
    await expect(plaudRow).toHaveAttribute(
        "data-sot-state",
        "connected-active",
    );
    await expect(panel).toHaveAttribute("data-sot-state", "no-match");
    await expect(listStateBlock(panel, "no-match")).toBeVisible();

    await expect(sotControl(page, "recording-list-clear-filters")).toBeVisible();
    await sotControl(page, "recording-list-clear-filters").click();
    await expect(panel).toHaveAttribute("data-sot-state", "ready");
    await expect(plaudRow).toHaveAttribute("aria-pressed", "false");
    await expect(plaudRow).toHaveAttribute("data-active", "false");
    await expect(plaudRow).toHaveAttribute(
        "data-sot-state",
        "connected-idle",
    );

    await cleanupListSeeds(userId);
});

test("recording list tags mode keeps multi-tag recordings in every matching group", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await seedMultiTagRecordings(userId);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await switchRecordingListToTags(page);

    const panel = recordingListPanel(page);
    const tagTrigger = panel.locator("[data-tag-filter-trigger]");
    await expect(
        panel.locator('[data-sot-panel="dashboard-recording-time-filter"]'),
    ).toBeHidden();
    await expect(tagTrigger.locator("[data-tag-filter-label]")).toHaveText(
        "全部",
    );
    await expect(tagTrigger.locator("[data-tag-filter-count]")).toHaveText("1");
    await tagTrigger.click();
    const tagList = panel.locator("[data-tag-filter-list]");
    await expect(tagList).toBeVisible();
    await expect(
        tagList.locator('[data-tag-value="tag:e2e-list-state-tag-alpha"]'),
    ).toHaveAttribute("role", "option");
    await expect(
        tagList.locator('[data-tag-value="tag:e2e-list-state-tag-beta"]'),
    ).toHaveAttribute("aria-selected", "false");
    await page.keyboard.press("Escape");
    await expect(tagList).toBeHidden();

    const alphaGroup = page.locator(
        '[data-sot-group-id="e2e-list-state-tag-alpha"]',
    );
    const betaGroup = page.locator(
        '[data-sot-group-id="e2e-list-state-tag-beta"]',
    );
    await expect(alphaGroup).toContainText("Alpha");
    await expect(betaGroup).toContainText("Beta");
    const alphaRow = alphaGroup.locator(
        '[data-sot-recording-id="e2e-list-state-multi-tag"]',
    );
    const betaRow = betaGroup.locator(
        '[data-sot-recording-id="e2e-list-state-multi-tag"]',
    );
    await expect(
        alphaRow,
    ).toBeVisible();
    await expect(alphaRow).toHaveAttribute(
        "data-rec",
        "e2e-list-state-multi-tag",
    );
    await expect(
        betaRow,
    ).toBeVisible();
    const alphaTag = alphaRow.locator(
        '[data-sot-part="dashboard-recording-row-actions"] [data-recording-tag-chip]',
    );
    const betaTag = betaRow.locator(
        '[data-sot-part="dashboard-recording-row-actions"] [data-recording-tag-chip]',
    );
    await expect(alphaTag).toHaveAttribute("data-sot-tag-color", "blue");
    await expect(alphaTag).toHaveAttribute("data-sot-tag-icon", "tag");
    await expect(alphaTag).toContainText("Alpha");
    await expect(betaTag).toHaveAttribute("data-sot-tag-color", "purple");
    await expect(betaTag).toHaveAttribute("data-sot-tag-icon", "star");
    await expect(betaTag).toContainText("Beta");

    await selectTagFilter(page, "Beta");

    await expect(betaGroup).toContainText("Beta");
    await expect(alphaGroup).toHaveCount(0);
    await expect(
        betaGroup.locator('[data-sot-recording-id="e2e-list-state-multi-tag"]'),
    ).toBeVisible();
    await expect(betaTag).toHaveAttribute("data-sot-tag-icon", "star");
    await tagTrigger.click();
    await expect(
        tagList.locator('[data-tag-value="tag:e2e-list-state-tag-beta"]'),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");

    await cleanupListSeeds(userId);
});

test("recording list renders the full SOT tag color and icon matrix", async ({
    page,
}) => {
    const sotPage = await page.context().newPage();
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { itemsPerPage: 20, theme: "dark" });

    const userId = await getPlaywrightUserId();
    try {
        await seedTagMatrixRecordings(userId);
        const sotIconSignatures =
            await readSotComponentTagIconSignatures(sotPage);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );

        for (const [index, icon] of SOT_TAG_ICON_MATRIX.entries()) {
            const recordingId = `${LIST_RECORDING_PREFIX}tag-matrix-${String(index + 1).padStart(2, "0")}`;
            const color =
                SOT_TAG_COLOR_MATRIX[index % SOT_TAG_COLOR_MATRIX.length];
            const chip = recordingRow(page, recordingId).locator(
                '[data-sot-part="dashboard-recording-row-actions"] [data-recording-tag-chip]',
            );

            await expect(chip).toHaveAttribute("data-sot-tag-color", color.color);
            await expect(chip).toHaveAttribute("data-sot-tag-icon", icon);
            await expect(chip.locator("svg")).toHaveCount(1);
            expect(await readSvgChildSignature(chip)).toEqual(
                sotIconSignatures[icon],
            );
        }
    } finally {
        await cleanupListSeeds(userId);
        await sotPage.close();
    }
});

test("recording list follows display language for empty and pagination copy", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { itemsPerPage: 10, uiLanguage: "en" });

    const userId = await getPlaywrightUserId();
    try {
        await cleanupAllUserRecordings(userId);
        await seedListRecordings(userId, 23);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        await expect(page.getByText("Timeline", { exact: true })).toBeVisible();
        await expect(sotControl(page, "recording-list-prev-page")).toHaveText(
            "Previous",
        );
        await expect(sotControl(page, "recording-list-next-page")).toHaveText(
            "Next",
        );
        await expect(sotControl(page, "recording-list-first-page")).toHaveCount(
            0,
        );
        await expect(sotControl(page, "recording-list-last-page")).toHaveCount(
            0,
        );
        await expect(
            recordingListPanel(page).locator(
                '[data-sot-part="recording-list-page-status"]',
            ),
        ).toContainText("Loaded 10 / 23 items · Page 1");

        await cleanupAllUserRecordings(userId);
        await page.reload({ waitUntil: "domcontentloaded" });

        await expect(listStateBlock(recordingListPanel(page), "empty")).toContainText(
            "No recordings yet",
        );
        await expect(
            page.getByRole("button", { name: "Open data sources" }),
        ).toBeVisible();
    } finally {
        await resetDisplay(page);
        await cleanupListSeeds(userId);
    }
});
