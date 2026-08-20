import { readFile } from "node:fs/promises";
import path from "node:path";
import {
    expect,
    type BrowserContext,
    type Page,
    type Response,
    test,
} from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    assertCanonicalSotReferenceUnchanged,
    resolveVerifiedCanonicalSotReference,
    snapshotCanonicalSotReference,
    type CanonicalSotReference,
    type CanonicalSotReferenceSnapshot,
} from "./helpers/canonical-sot-reference";
import {
    createRecordingListCompletionFixture,
    type CompletionSeed,
    type RecordingListCompletionFixture,
} from "./helpers/recording-list-completion-database";

type QueryPayload = {
    facets: {
        timeline: {
            all: number;
            earlier: number;
            last7: number;
            today: number;
            yesterday: number;
        };
        tags: {
            all: number;
            items: Array<{
                color: string;
                count: number;
                icon: string;
                id: string;
                name: string;
            }>;
            untagged: number;
        };
    };
    pagination: { page: number; pageSize: number; total: number };
    recordings: Array<{
        id: string;
        tags: Array<{
            color: string;
            icon: string;
            id: string;
            name: string;
        }>;
    }>;
};

type BrowserSnapshot = Parameters<
    RecordingListCompletionFixture["captureBrowserState"]
>[0];

const REQUIRED_LIBRARY_BUSY_TIMEOUT_MS = 1_000;

function assertManagedLibraryBusyTimeout() {
    if (
        process.env.BETTERAINOTE_LIBRARY_BUSY_TIMEOUT_MS !==
        String(REQUIRED_LIBRARY_BUSY_TIMEOUT_MS)
    ) {
        throw new Error(
            "Recording-list completion requires the managed library busy timeout",
        );
    }
}

const list = (page: Page) =>
    page.locator('[data-surface="dashboard-recording-list"]');
const listRows = (page: Page) =>
    list(page).locator('[data-control="dashboard-recording-row"]');
const row = (page: Page, id: string) =>
    list(page).locator(
        `[data-control="dashboard-recording-row"][data-recording-id="${id}"]`,
    );
const detail = (page: Page) => page.locator('[data-panel="dashboard-detail"]');
const nextPage = (page: Page) =>
    page.locator('[data-control="recording-list-next-page"]');
const previousPage = (page: Page) =>
    page.locator('[data-control="recording-list-prev-page"]');
const listStateTitle = (page: Page) =>
    list(page).locator('[data-part="recording-list-state-title"]');
const DETAIL_TABBABLE_SELECTOR = [
    'button:not([disabled]):visible',
    'a[href]:visible',
    'input:not([disabled]):visible',
    'select:not([disabled]):visible',
    'textarea:not([disabled]):visible',
    '[contenteditable="true"]:visible',
    '[tabindex]:not([tabindex="-1"]):not([disabled]):visible',
].join(", ");

let fixture: RecordingListCompletionFixture | null = null;
let seed: CompletionSeed | null = null;
let browserSnapshot: BrowserSnapshot | null = null;
let canonical: CanonicalSotReference;
let canonicalBefore: CanonicalSotReferenceSnapshot;

async function browserStorageSession(page: Page, context: BrowserContext) {
    const session = await context.newCDPSession(page);
    return {
        origin: new URL(page.url()).origin,
        session,
    };
}

async function captureBrowserState(page: Page, context: BrowserContext) {
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    const { origin, session } = await browserStorageSession(page, context);
    try {
        const result = (await session.send("DOMStorage.getDOMStorageItems", {
            storageId: { isLocalStorage: true, securityOrigin: origin },
        })) as { entries: Array<[string, string]> };
        return {
            cookies: await context.cookies(),
            storage: Object.fromEntries(result.entries),
        } satisfies BrowserSnapshot;
    } finally {
        await session.detach();
    }
}

async function readBrowserState(page: Page, context: BrowserContext) {
    const { origin, session } = await browserStorageSession(page, context);
    try {
        const result = (await session.send("DOMStorage.getDOMStorageItems", {
            storageId: { isLocalStorage: true, securityOrigin: origin },
        })) as { entries: Array<[string, string]> };
        return {
            cookies: await context.cookies(),
            storage: Object.fromEntries(result.entries),
        } satisfies BrowserSnapshot;
    } finally {
        await session.detach();
    }
}

async function restoreBrowserState(
    page: Page,
    context: BrowserContext,
    snapshot: BrowserSnapshot,
) {
    if (!page.url().startsWith("http")) {
        await page.goto("/register", { waitUntil: "domcontentloaded" });
    }
    const { origin, session } = await browserStorageSession(page, context);
    try {
        const storageId = { isLocalStorage: true, securityOrigin: origin };
        await session.send("DOMStorage.clear", { storageId });
        for (const [key, value] of Object.entries(snapshot.storage)) {
            await session.send("DOMStorage.setDOMStorageItem", {
                key,
                storageId,
                value,
            });
        }
    } finally {
        await session.detach();
    }
    await context.clearCookies();
    if (snapshot.cookies.length > 0) {
        await context.addCookies(snapshot.cookies);
    }
    expect(await readBrowserState(page, context)).toEqual(snapshot);
}

async function query(page: Page, search: string) {
    const response = await page.request.get(`/api/recordings/query?${search}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private, no-store");
    return (await response.json()) as QueryPayload;
}

async function queryAllIds(page: Page, sort: "newest" | "oldest" | "name") {
    const ids: string[] = [];
    for (const pageNumber of [1, 2, 3]) {
        const payload = await query(
            page,
            new URLSearchParams({
                includeTranscript: "1",
                page: String(pageNumber),
                pageSize: "10",
                sort,
            }).toString(),
        );
        ids.push(...payload.recordings.map((recording) => recording.id));
    }
    return ids;
}

function recordingQueryResponse(
    page: Page,
    predicate: (url: URL) => boolean,
    timeout?: number,
) {
    return page.waitForResponse(
        (response: Response) => {
            const url = new URL(response.url());
            return (
                response.request().method() === "GET" &&
                url.pathname === "/api/recordings/query" &&
                predicate(url)
            );
        },
        timeout === undefined ? undefined : { timeout },
    );
}

async function saveDisplay(
    page: Page,
    update: Record<string, string | number>,
) {
    const response = await page.request.put("/api/settings/display", {
        data: update,
    });
    expect(response.ok()).toBe(true);
}

async function openDashboard(page: Page) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");
    await expect(listRows(page)).toHaveCount(10);
}

async function readComputedMaterial(
    page: Page,
    selector: string,
    properties: readonly string[],
) {
    const session = await page.context().newCDPSession(page);
    try {
        await session.send("DOM.enable");
        await session.send("CSS.enable");
        const document = (await session.send("DOM.getDocument")) as {
            root: { nodeId: number };
        };
        const match = (await session.send("DOM.querySelector", {
            nodeId: document.root.nodeId,
            selector,
        })) as { nodeId: number };
        if (match.nodeId === 0) {
            throw new Error("Recording-list material selector was not found");
        }
        const result = (await session.send("CSS.getComputedStyleForNode", {
            nodeId: match.nodeId,
        })) as { computedStyle: Array<{ name: string; value: string }> };
        const values = new Map(
            result.computedStyle.map(({ name, value }) => [name, value]),
        );
        return Object.fromEntries(
            properties.map((property) => [property, values.get(property)]),
        );
    } finally {
        await session.detach();
    }
}

async function strictPixelAt(page: Page, locator: ReturnType<typeof row>) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("Recording-list pixel oracle is not visible");
    return page.screenshot({
        clip: { height: 1, width: 1, x: box.x + 2, y: box.y + 2 },
    });
}

function pngWidth(image: Buffer) {
    if (image.subarray(1, 4).toString("ascii") !== "PNG") {
        throw new Error("Recording-list overflow oracle requires PNG output");
    }
    return image.readUInt32BE(16);
}

async function canonicalPaginatedFirstTemplate() {
    const source = await readFile(
        path.join(canonical.root, "ui_kits/web/index.html"),
        "utf8",
    );
    const startMarker =
        '<div class="list-state-block list-state-pagination" data-list-state-block="paginated-first" hidden>';
    const endMarker =
        '<div class="list-state-block list-state-pagination" data-list-state-block="paginated-last" hidden>';
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    if (start < 0 || end < 0) {
        throw new Error(
            "Verified canonical SOT is missing the paginated-first template",
        );
    }
    return source.slice(start, end);
}

test.beforeAll(async () => {
    assertManagedLibraryBusyTimeout();
    const resolved = await resolveVerifiedCanonicalSotReference();
    if (!resolved.available) {
        throw new Error(resolved.reason);
    }
    canonical = resolved.reference;
    canonicalBefore = resolved.snapshot;
});

test.afterAll(async () => {
    assertCanonicalSotReferenceUnchanged(
        canonicalBefore,
        await snapshotCanonicalSotReference(canonical),
    );
});

test.beforeEach(async ({ context, page }) => {
    fixture = await createRecordingListCompletionFixture();
    browserSnapshot = await captureBrowserState(page, context);
    fixture.captureBrowserState(browserSnapshot);
    await ensureSignedIn(page);
    seed = await fixture.seed(await fixture.getUserId());
    await saveDisplay(page, {
        dateTimeFormat: "relative",
        itemsPerPage: 10,
        recordingListSortOrder: "newest",
        theme: "light",
        uiLanguage: "zh-CN",
    });
});

test.afterEach(async ({ context, page }) => {
    const cleanupErrors: unknown[] = [];
    if (fixture) {
        try {
            await fixture.dispose();
        } catch (error) {
            cleanupErrors.push(error);
        }
    }
    if (browserSnapshot) {
        try {
            await restoreBrowserState(page, context, browserSnapshot);
        } catch (error) {
            cleanupErrors.push(error);
        }
    }
    fixture = null;
    seed = null;
    browserSnapshot = null;
    if (cleanupErrors.length > 0) {
        throw new AggregateError(
            cleanupErrors,
            "Recording-list completion browser/database cleanup failed",
        );
    }
});

test("real query API keeps stable sorting, pagination, last7, and global facets", async ({
    page,
}) => {
    if (!seed) throw new Error("Completion seed is unavailable");

    expect(await queryAllIds(page, "newest")).toEqual(
        seed.expectedNewestOrder,
    );
    expect(await queryAllIds(page, "oldest")).toEqual(
        seed.expectedOldestOrder,
    );
    expect(await queryAllIds(page, "name")).toEqual(seed.expectedNameOrder);

    const defaultPayload = await query(
        page,
        "includeTranscript=1&page=1&pageSize=10",
    );
    expect(defaultPayload.recordings.map((recording) => recording.id)).toEqual(
        seed.expectedNewestOrder.slice(0, 10),
    );
    expect(defaultPayload.pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 24,
    });
    expect(defaultPayload.facets.timeline).toEqual({
        all: 24,
        earlier: 6,
        last7: 6,
        today: 8,
        yesterday: 4,
    });
    expect(defaultPayload.facets.tags).toEqual({
        all: 24,
        items: [
            { color: "blue", count: 5, icon: "grid", ...seed.tags.alpha },
            { color: "purple", count: 4, icon: "star", ...seed.tags.beta },
        ],
        untagged: 16,
    });

    const last7 = await query(
        page,
        "includeTranscript=1&page=1&pageSize=10&timeline=last7",
    );
    expect(last7.pagination.total).toBe(6);
    expect(last7.facets.timeline.all).toBe(24);
    const alpha = await query(
        page,
        `includeTranscript=1&page=1&pageSize=10&tagId=${encodeURIComponent(seed.tags.alpha.id)}`,
    );
    expect(alpha.pagination.total).toBe(5);
    expect(alpha.facets.tags.all).toBe(24);
    expect(alpha.facets.timeline.all).toBe(5);

    const taggedFavorite = await query(
        page,
        "includeTranscript=1&page=1&pageSize=10&favorite=tags",
    );
    expect(taggedFavorite.pagination.total).toBe(8);
    expect(taggedFavorite.facets.timeline.all).toBe(8);
    expect(taggedFavorite.facets.tags.all).toBe(24);
    expect(taggedFavorite.facets.tags.untagged).toBe(16);

    const untagged = await query(
        page,
        "includeTranscript=1&page=1&pageSize=20&untagged=1",
    );
    expect(untagged.pagination.total).toBe(16);
    expect(untagged.facets.timeline.all).toBe(16);
    expect(untagged.facets.tags.all).toBe(24);
    expect(untagged.facets.tags.untagged).toBe(16);

    const combined = await query(
        page,
        `includeTranscript=1&page=1&pageSize=10&timeline=today&tagId=${encodeURIComponent(seed.tags.alpha.id)}`,
    );
    expect(combined.pagination.total).toBe(5);
    expect(combined.facets.timeline.all).toBe(5);
    expect(combined.facets.tags.all).toBe(8);

    await page.reload({ waitUntil: "domcontentloaded" });
    expect(
        (await query(page, "includeTranscript=1&page=3&pageSize=10&sort=newest"))
            .recordings.map((recording) => recording.id),
    ).toEqual(seed.expectedNewestOrder.slice(20));
});

test("pointer and keyboard selection restore URL history, reload, close, and focus", async ({
    page,
}) => {
    if (!seed) throw new Error("Completion seed is unavailable");
    await page.setViewportSize({ height: 900, width: 1366 });
    await openDashboard(page);

    const target = row(page, seed.expectedNewestOrder[1]);
    await target.hover();
    await target.focus();
    await expect(target).toBeFocused();
    await target.press("Enter");
    await expect(target).toHaveAttribute("data-state", "selected");
    await expect(page).toHaveURL(/recording=/);
    await expect(detail(page)).toBeVisible();
    await expect(
        page.locator('[data-control="dashboard-detail-scrim"]'),
    ).toBeHidden();
    expect((await list(page).boundingBox())?.width).toBe(320);

    const selectedUrl = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(selectedUrl);
    await expect(target).toHaveAttribute("data-state", "selected");

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/recording=/);
    await expect(detail(page)).toBeHidden();
    await page.goForward({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/recording=/);
    await expect(detail(page)).toBeVisible();

    const close = page.locator('[data-control="dashboard-detail-close"]');
    await close.click();
    await expect(page).not.toHaveURL(/recording=/);
    await expect(target).toBeFocused();
    const pendingId = seed.expectedNewestOrder[20];
    await page.goto(
        `/dashboard?recording=${encodeURIComponent(pendingId)}`,
        { waitUntil: "domcontentloaded" },
    );
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");
    await expect(page).toHaveURL(
        new RegExp(`recording=${encodeURIComponent(pendingId)}`),
    );
    await expect(detail(page)).toHaveAttribute("data-empty", "true");

    await page.goto(
        `/dashboard?page=3&recording=${encodeURIComponent(pendingId)}`,
        { waitUntil: "domcontentloaded" },
    );
    await expect(row(page, pendingId)).toHaveAttribute(
        "data-state",
        "selected",
    );
    await expect(detail(page)).toHaveAttribute("data-empty", "false");
});

test("real tag data preserves SOT color, icon, untagged, grouping, and reload semantics", async ({
    context,
    page,
}) => {
    if (!seed) throw new Error("Completion seed is unavailable");
    const payload = await query(
        page,
        "includeTranscript=1&page=1&pageSize=10&sort=newest",
    );
    const multiTagged = payload.recordings.find(
        (recording) => recording.id === seed?.ids[0],
    );
    expect(multiTagged?.tags).toEqual([
        { color: "blue", icon: "grid", ...seed.tags.alpha },
        { color: "purple", icon: "star", ...seed.tags.beta },
    ]);

    await page.setViewportSize({ height: 900, width: 1440 });
    await openDashboard(page);
    const timelineChip = row(page, seed.ids[0]).locator(
        "[data-recording-tag-chip]",
    );
    await expect(timelineChip).toHaveCount(1);
    await expect(timelineChip).toHaveAttribute("data-tag-color", "blue");
    await expect(timelineChip).toHaveAttribute("data-tag-icon", "grid");
    await expect(timelineChip.locator("[data-tag-icon-glyph]")).toHaveCount(1);

    await page.getByRole("tab", { name: /^(标签|Tags)$/ }).click();
    await expect(list(page)).toHaveAttribute("data-list-mode", "tags");
    await expect(row(page, seed.ids[0])).toHaveCount(2);

    const alphaChip = list(page)
        .locator(`[data-group-id="${seed.tags.alpha.id}"]`)
        .locator(
            `[data-control="dashboard-recording-row"][data-recording-id="${seed.ids[0]}"] [data-recording-tag-chip]`,
        );
    const betaChip = list(page)
        .locator(`[data-group-id="${seed.tags.beta.id}"]`)
        .locator(
            `[data-control="dashboard-recording-row"][data-recording-id="${seed.ids[0]}"] [data-recording-tag-chip]`,
        );
    await expect(alphaChip).toHaveAttribute("data-tag-color", "blue");
    await expect(alphaChip).toHaveAttribute("data-tag-icon", "grid");
    await expect(betaChip).toHaveAttribute("data-tag-color", "purple");
    await expect(betaChip).toHaveAttribute("data-tag-icon", "star");
    await expect(alphaChip.locator("[data-tag-icon-glyph]")).toHaveCount(1);
    await expect(betaChip.locator("[data-tag-icon-glyph]")).toHaveCount(1);

    const untaggedRow = list(page)
        .locator('[data-group-id="untagged"]')
        .locator(
            `[data-control="dashboard-recording-row"][data-recording-id="${seed.ids[8]}"]`,
        );
    await expect(untaggedRow).toHaveCount(1);
    await expect(untaggedRow.locator("[data-recording-tag-chip]")).toHaveCount(
        0,
    );
    await expect(untaggedRow.locator("[data-tag-icon-glyph]")).toHaveCount(0);

    const tagMaterialProperties = [
        "background-color",
        "border-top-color",
        "border-top-left-radius",
        "color",
        "height",
        "padding-left",
        "padding-right",
    ] as const;
    const productBlueMaterial = await readComputedMaterial(
        page,
        `[data-group-id="${seed.tags.alpha.id}"] [data-recording-id="${seed.ids[0]}"] [data-recording-tag-chip]`,
        tagMaterialProperties,
    );
    const productVioletMaterial = await readComputedMaterial(
        page,
        `[data-group-id="${seed.tags.beta.id}"] [data-recording-id="${seed.ids[0]}"] [data-recording-tag-chip]`,
        tagMaterialProperties,
    );

    const sotPage = await context.newPage();
    try {
        await sotPage.setViewportSize({ height: 900, width: 1440 });
        await sotPage.goto(canonical.webIndexUrl, { waitUntil: "load" });
        const sotBlueChip = sotPage.locator(
            '[data-rec="rec-wenli-1on1"] .utag.c-blue',
        );
        const sotVioletChip = sotPage.locator(
            '[data-rec="rec-product-weekly"] .utag.c-violet',
        );
        await expect(sotBlueChip.locator("svg")).toHaveCount(1);
        await expect(sotVioletChip.locator("svg")).toHaveCount(1);
        const sotBlueMaterial = await readComputedMaterial(
            sotPage,
            '[data-rec="rec-wenli-1on1"] .utag.c-blue',
            tagMaterialProperties,
        );
        const sotVioletMaterial = await readComputedMaterial(
            sotPage,
            '[data-rec="rec-product-weekly"] .utag.c-violet',
            tagMaterialProperties,
        );

        for (const property of [
            "background-color",
            "border-top-color",
            "color",
        ] as const) {
            expect(sotBlueMaterial[property]).not.toBe(
                sotVioletMaterial[property],
            );
            expect(productBlueMaterial[property]).not.toBe(
                productVioletMaterial[property],
            );
        }
        for (const property of [
            "border-top-left-radius",
            "height",
            "padding-left",
            "padding-right",
        ] as const) {
            expect(productBlueMaterial[property]).toBe(
                sotBlueMaterial[property],
            );
            expect(productVioletMaterial[property]).toBe(
                sotVioletMaterial[property],
            );
        }
    } finally {
        await sotPage.close();
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");
    await expect(list(page)).toHaveAttribute("data-list-mode", "tags");
    await expect(row(page, seed.ids[0])).toHaveCount(2);
    await expect(
        list(page).locator(
            `[data-group-id="${seed.tags.alpha.id}"] [data-recording-id="${seed.ids[0]}"] [data-recording-tag-chip]`,
        ),
    ).toHaveAttribute("data-tag-color", "blue");
    await expect(
        list(page).locator(
            `[data-group-id="${seed.tags.beta.id}"] [data-recording-id="${seed.ids[0]}"] [data-recording-tag-chip]`,
        ),
    ).toHaveAttribute("data-tag-icon", "star");
});

test("immutable SOT and the real UI preserve the full recording-list matrix", async ({
    context,
    page,
}, testInfo) => {
    if (!seed) throw new Error("Completion seed is unavailable");
    const paginatedFirstTemplate = await canonicalPaginatedFirstTemplate();
    const canonicalPrevious = paginatedFirstTemplate.match(
        /<button\b[^>]*\bdata-page-prev\b[^>]*>/,
    )?.[0];
    const canonicalNext = paginatedFirstTemplate.match(
        /<button\b[^>]*\bdata-page-next\b[^>]*>/,
    )?.[0];
    expect(paginatedFirstTemplate).toContain(
        'data-list-state-block="paginated-first"',
    );
    expect(paginatedFirstTemplate).toContain("已加载 50 / 247 条 · 第 1 页");
    expect(paginatedFirstTemplate).toMatch(
        /<span class="lsb-page-num mono">\s*1 \/ 5\s*<\/span>/,
    );
    expect(canonicalPrevious).toMatch(/\sdisabled(?:\s|>)/);
    expect(canonicalPrevious).toContain('aria-disabled="true"');
    expect(canonicalNext).toBeDefined();
    expect(canonicalNext).not.toMatch(/\sdisabled(?:\s|>)/);
    expect(canonicalNext).not.toContain('aria-disabled="true"');
    const sotPage = await context.newPage();
    try {
        await sotPage.setViewportSize({ height: 900, width: 1440 });
        await sotPage.goto(canonical.webIndexUrl, { waitUntil: "load" });
        const sotList = sotPage.locator(".list-panel");
        const sotRow = sotPage.locator(".real-list .row.active");
        const sotTimeline = sotPage.locator(
            '[data-list-filter-row="timeline"]',
        );
        const sotTagTrigger = sotPage.locator("[data-tag-filter-trigger]");
        const sotDetail = sotPage.locator(".detail");
        const referenceGeometry = {
            detail: await sotDetail.boundingBox(),
            list: await sotList.boundingBox(),
            row: await sotRow.boundingBox(),
            tagAria: await sotTagTrigger.getAttribute("aria-haspopup"),
            timelineButtons: await sotTimeline.locator("button").count(),
        };
        expect(referenceGeometry.list?.width).toBe(380);
        expect(referenceGeometry.row?.height).toBeGreaterThan(40);
        expect(referenceGeometry.timelineButtons).toBeGreaterThanOrEqual(4);
        expect(referenceGeometry.tagAria).toBe("listbox");
        expect(referenceGeometry.detail?.width).toBeGreaterThan(
            referenceGeometry.list?.width ?? 0,
        );

        const rowMaterialProperties = [
            "background-color",
            "border-bottom-color",
            "border-bottom-left-radius",
            "border-bottom-right-radius",
            "border-left-color",
            "border-right-color",
            "border-top-color",
            "border-top-left-radius",
            "border-top-right-radius",
            "cursor",
            "padding-bottom",
            "padding-left",
            "padding-right",
            "padding-top",
        ] as const;
        const referenceRowMaterial = await readComputedMaterial(
            sotPage,
            ".real-list .row.active",
            rowMaterialProperties,
        );

        for (const frame of [
            { height: 900, name: "wide", width: 1440 },
            { height: 900, name: "desktop", width: 1366 },
            { height: 900, name: "narrow", width: 1024 },
            { height: 1024, name: "tablet", width: 768 },
            { height: 844, name: "mobile", width: 390 },
        ] as const) {
            for (const theme of ["light", "dark"] as const) {
                for (const language of ["zh-CN", "en"] as const) {
                    await saveDisplay(page, {
                        dateTimeFormat:
                            language === "zh-CN" ? "relative" : "absolute",
                        theme,
                        uiLanguage: language,
                    });
                    await page.setViewportSize({
                        height: frame.height,
                        width: frame.width,
                    });
                    await openDashboard(page);

                    const first = row(page, seed.expectedNewestOrder[0]);
                    const firstGroup = list(page)
                        .locator('[data-group="recording-list"]')
                        .first();
                    const initialListBox = await list(page).boundingBox();
                    await expect(page.locator("html")).toHaveAttribute(
                        "data-theme",
                        theme,
                    );
                    await expect(firstGroup).toContainText(
                        language === "zh-CN" ? "今天" : "Today",
                    );
                    await expect(first).toContainText(
                        language === "zh-CN" ? /前|内/ : /\d{4}/,
                    );
                    await expect(first).toHaveCSS("border-radius", "10px");
                    await expect(first).toHaveCSS("cursor", "pointer");
                    await expect(
                        page.locator(
                            '[data-panel="dashboard-recording-time-filter"]',
                        ),
                    ).toContainText(
                        language === "zh-CN" ? "今天" : "Today",
                    );
                    await page.getByRole("tab", {
                        name: language === "zh-CN" ? "标签" : "Tags",
                    }).click();
                    await expect(
                        page.locator(
                            '[data-control="recording-list-tag-filter-trigger"]',
                        ),
                    ).toHaveAttribute("aria-haspopup", "listbox");
                    await page.getByRole("tab", {
                        name: language === "zh-CN" ? "时间" : "Time",
                    }).click();
                    await expect(
                        page.locator('[data-panel="recording-list-pagination"]'),
                    ).toHaveAttribute("data-state", "paginated-first");
                    const productPagination = page.locator(
                        '[data-panel="recording-list-pagination"]',
                    );
                    await expect(productPagination).toContainText("10 / 24");
                    await expect(productPagination).toContainText("1 / 3");
                    await expect(previousPage(page)).toBeDisabled();
                    await expect(previousPage(page)).toHaveAttribute(
                        "aria-disabled",
                        "true",
                    );
                    await expect(nextPage(page)).toBeEnabled();
                    expect(
                        await nextPage(page).getAttribute("aria-disabled"),
                    ).toBeNull();

                    if (theme === "dark") {
                        const productMaterial = await readComputedMaterial(
                            page,
                            `[data-control="dashboard-recording-row"][data-recording-id="${seed.expectedNewestOrder[0]}"]`,
                            rowMaterialProperties,
                        );
                        expect(productMaterial).toEqual(referenceRowMaterial);
                        expect(await strictPixelAt(page, first)).toEqual(
                            await strictPixelAt(sotPage, sotRow),
                        );
                    }

                    if (frame.width >= 1440) {
                        await expect(
                            page.locator('[data-panel="dashboard-sidebar"]'),
                        ).toBeVisible();
                        await expect(detail(page)).toBeVisible();
                        expect(initialListBox?.width).toBe(
                            referenceGeometry.list?.width,
                        );
                    } else {
                        await expect(detail(page)).toBeHidden();
                        if (frame.width >= 1024) {
                            expect(initialListBox?.width).toBeGreaterThan(320);
                        }
                    }

                    await first.hover();
                    await first.focus();
                    await expect(first).toBeFocused();
                    await first.press("Enter");
                    await expect(first).toHaveAttribute("data-state", "selected");
                    await expect(detail(page)).toBeVisible();

                    if (frame.width >= 1024 && frame.width < 1440) {
                        expect((await list(page).boundingBox())?.width).toBe(320);
                        await expect(
                            page.locator(
                                '[data-control="dashboard-detail-scrim"]',
                            ),
                        ).toBeHidden();
                        await page
                            .locator('[data-control="dashboard-detail-close"]')
                            .click();
                        await expect(first).toBeFocused();
                    } else if (frame.width <= 1023) {
                        const back = page.locator(
                            '[data-control="dashboard-detail-back"]',
                        );
                        const scrim = page.locator(
                            '[data-control="dashboard-detail-scrim"]',
                        );
                        await expect(back).toBeVisible();
                        await expect(scrim).toBeVisible();
                        await expect(back).toBeFocused();
                        const detailBox = await detail(page).boundingBox();
                        expect(detailBox?.x).toBe(8);
                        expect(detailBox?.width).toBe(frame.width - 16);

                        if (theme === "dark" && language === "en") {
                            const focusable = detail(page).locator(
                                DETAIL_TABBABLE_SELECTOR,
                            );
                            const firstFocusable = focusable.first();
                            const lastFocusable = focusable.last();
                            await firstFocusable.focus();
                            await page.keyboard.press("Shift+Tab");
                            await expect(lastFocusable).toBeFocused();
                            await lastFocusable.focus();
                            await page.keyboard.press("Tab");
                            await expect(firstFocusable).toBeFocused();
                        }

                        if (theme === "light" && language === "zh-CN") {
                            await back.click();
                        } else if (theme === "light" && language === "en") {
                            await scrim.click({ position: { x: 1, y: 1 } });
                        } else {
                            await page.keyboard.press("Escape");
                        }
                        await expect(detail(page)).toBeHidden();
                        await expect(first).toBeFocused();

                        if (frame.width === 390) {
                            const fullPage = await page.screenshot({
                                fullPage: true,
                            });
                            expect(pngWidth(fullPage)).toBe(390);
                        }
                    }

                    await testInfo.attach(
                        `recording-list-${frame.name}-${theme}-${language}`,
                        {
                            body: await list(page).screenshot(),
                            contentType: "image/png",
                        },
                    );
                }
            }
        }
    } finally {
        await sotPage.close();
    }
});



test("real UI exposes statuses, filter-empty recovery, Data Sources, groups, and pagination", async ({
    page,
}) => {
    if (!fixture || !seed) throw new Error("Completion fixture is unavailable");
    await page.setViewportSize({ height: 900, width: 1440 });
    await openDashboard(page);
    await expect(previousPage(page)).toBeDisabled();
    await expect(nextPage(page)).toBeEnabled();
    await expect(list(page)).toContainText(/(已更新|Updated)/);
    await expect(list(page)).toContainText(/(正在转写|Transcribing)/);
    await expect(list(page)).toContainText(/(更新失败|Update failed)/);
    await expect(list(page)).toContainText(/(仅本地|Local only)/);
    await expect(list(page)).toContainText(/(待处理|Pending)/);

    await page.getByRole("tab", { name: /^(标签|Tags)$/ }).click();
    await page
        .locator('[data-control="recording-list-tag-filter-trigger"]')
        .click();
    await page
        .locator(
            '[data-control="recording-list-tag-filter"][data-tag-value="all"]',
        )
        .click();
    await expect(row(page, seed.ids[0])).toHaveCount(2);

    await page.getByRole("tab", { name: /^(时间|Time)$/ }).click();
    const noMatchQuery = `no-match-${fixture.runId}`;
    await page.locator('[data-control="dashboard-search"]').click();
    const noMatchResponse = recordingQueryResponse(
        page,
        (url) => url.searchParams.get("query") === noMatchQuery,
    );
    await page
        .locator('[data-control="library-search-input"]')
        .fill(noMatchQuery);
    expect((await noMatchResponse).status()).toBe(200);
    await page.keyboard.press("Escape");
    await expect(list(page)).toHaveAttribute("data-list-state", "no-match");
    await expect(listStateTitle(page)).toContainText(
        /(当前筛选下没有录音|No recordings match these filters)/,
    );
    const clearNoMatchResponse = recordingQueryResponse(
        page,
        (url) => !url.searchParams.has("query"),
    );
    await page
        .locator('[data-control="recording-list-clear-filters"]')
        .click();
    expect((await clearNoMatchResponse).status()).toBe(200);
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");

    const earlierResponse = recordingQueryResponse(
        page,
        (url) => url.searchParams.get("timeline") === "earlier",
    );
    await page
        .locator(
            '[data-control="dashboard-recording-time-filter"][data-filter="earlier"]',
        )
        .click();
    expect((await earlierResponse).status()).toBe(200);
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");
    const timelineEmptyResponse = recordingQueryResponse(
        page,
        (url) =>
            url.searchParams.get("favorite") === "tags" &&
            url.searchParams.get("timeline") === "earlier",
    );
    await page
        .locator(
            '[data-control="dashboard-favorite"][data-filter="tags"]',
        )
        .click();
    expect((await timelineEmptyResponse).status()).toBe(200);
    await expect(list(page)).toHaveAttribute(
        "data-list-state",
        "timeline-empty",
    );
    await expect(listStateTitle(page)).toContainText(
        /(所选时间段内没有录音|No recordings in this timeline)/,
    );
    const clearTimelineResponse = recordingQueryResponse(
        page,
        (url) =>
            url.searchParams.get("favorite") === "tags" &&
            !url.searchParams.has("timeline"),
    );
    await page
        .locator('[data-control="recording-list-clear-timeline"]')
        .click();
    expect((await clearTimelineResponse).status()).toBe(200);
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");

    const tagOverflow = await query(
        page,
        new URLSearchParams({
            favorite: "tags",
            includeTranscript: "1",
            page: "2",
            pageSize: "10",
            tagId: seed.tags.beta.id,
        }).toString(),
    );
    expect(tagOverflow.pagination).toEqual({ page: 1, pageSize: 10, total: 4 });
    const betaIds = new Set([
        seed.ids[0],
        seed.ids[5],
        seed.ids[6],
        seed.ids[7],
    ]);
    expect(tagOverflow.recordings.map((recording) => recording.id)).toEqual(
        seed.expectedNewestOrder.filter((id) => betaIds.has(id)),
    );
    const overflowUiResponse = recordingQueryResponse(
        page,
        (url) =>
            url.searchParams.get("page") === "2" &&
            url.searchParams.get("favorite") === "tags" &&
            url.searchParams.get("tagId") === seed?.tags.beta.id,
    );
    await page.goto(
        `/dashboard?page=2&favorite=tags&mode=tags&tagId=${encodeURIComponent(seed.tags.beta.id)}`,
        { waitUntil: "domcontentloaded" },
    );
    const overflowResponse = await overflowUiResponse;
    expect(overflowResponse.status()).toBe(200);
    expect(
        ((await overflowResponse.json()) as QueryPayload).pagination,
    ).toEqual({ page: 1, pageSize: 10, total: 4 });
    await expect(page).toHaveURL((url) => {
        return (
            url.pathname === "/dashboard" &&
            !url.searchParams.has("page") &&
            url.searchParams.get("favorite") === "tags" &&
            url.searchParams.get("mode") === "tags" &&
            url.searchParams.get("tagId") === seed?.tags.beta.id
        );
    });
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");
    await expect(listRows(page)).toHaveCount(4);
    await expect(
        page.locator('[data-panel="recording-list-pagination"]'),
    ).toHaveCount(0);

    const tagEmpty = await query(
        page,
        "includeTranscript=1&page=1&pageSize=10&favorite=tags&untagged=1",
    );
    expect(tagEmpty.pagination).toEqual({ page: 1, pageSize: 10, total: 0 });
    expect(tagEmpty.recordings).toEqual([]);
    expect(tagEmpty.facets.tags).toEqual({
        all: 24,
        items: [
            { color: "blue", count: 5, icon: "grid", ...seed.tags.alpha },
            { color: "purple", count: 4, icon: "star", ...seed.tags.beta },
        ],
        untagged: 16,
    });
    const tagEmptyUiResponse = recordingQueryResponse(
        page,
        (url) =>
            url.searchParams.get("page") === "1" &&
            url.searchParams.get("favorite") === "tags" &&
            url.searchParams.get("untagged") === "1",
    );
    await page.goto(
        "/dashboard?favorite=tags&mode=tags&untagged=1",
        { waitUntil: "domcontentloaded" },
    );
    const emptyResponse = await tagEmptyUiResponse;
    expect(emptyResponse.status()).toBe(200);
    expect(((await emptyResponse.json()) as QueryPayload).pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 0,
    });
    await expect(list(page)).toHaveAttribute("data-list-state", "tag-empty");
    await expect(
        page.locator('[data-panel="recording-list-pagination"]'),
    ).toHaveCount(0);
    await expect(listStateTitle(page)).toContainText(
        /(该标签下还没有录音|No recordings for this tag)/,
    );
    const clearTagResponse = recordingQueryResponse(
        page,
        (url) =>
            url.searchParams.get("page") === "1" &&
            !url.searchParams.has("favorite") &&
            !url.searchParams.has("tagId") &&
            !url.searchParams.has("untagged"),
    );
    await page.locator('[data-control="recording-list-clear-tag"]').click();
    const clearedResponse = await clearTagResponse;
    expect(clearedResponse.status()).toBe(200);
    expect(((await clearedResponse.json()) as QueryPayload).pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 24,
    });
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");
    await expect(
        page.locator('[data-panel="recording-list-pagination"]'),
    ).toHaveAttribute("data-state", "paginated-first");
    await expect(previousPage(page)).toBeDisabled();
    await expect(nextPage(page)).toBeEnabled();

    await fixture.clearSeed();
    await expect.poll(() => fixture?.readOwnedState()).toEqual({
        recordings: [],
        tags: [],
    });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(list(page)).toHaveAttribute("data-list-state", "empty");
    await expect(
        listStateTitle(page),
    ).toContainText(/(还没有录音|No recordings yet)/);
    await page
        .locator('[data-control="recording-list-open-data-sources"]')
        .click();
    const settingsDialog = page.getByRole("dialog", {
        name: /^(设置|Settings)$/,
    });
    await expect(settingsDialog).toBeVisible();
    await expect(
        settingsDialog.getByRole("button", { name: /^(数据源|Data Sources)$/ }),
    ).toHaveAttribute("aria-current", "page");
    await settingsDialog
        .getByRole("button", { name: /^(关闭设置|Close settings)$/ })
        .click();
    await expect(settingsDialog).toBeHidden();
});

test("detail a11y lifecycle follows live crossings of the 1023px breakpoint", async ({
    page,
}) => {
    if (!seed) throw new Error("Completion seed is unavailable");
    const target = row(page, seed.expectedNewestOrder[0]);
    const body = page.locator("body");
    const scrim = page.locator('[data-control="dashboard-detail-scrim"]');
    const back = page.locator('[data-control="dashboard-detail-back"]');
    const close = page.locator('[data-control="dashboard-detail-close"]');

    await page.setViewportSize({ height: 900, width: 1024 });
    await openDashboard(page);
    await target.focus();
    await target.press("Enter");
    await expect(detail(page)).toBeVisible();
    await expect(scrim).toBeHidden();
    await expect(body).not.toHaveCSS("overflow", "hidden");

    await page.setViewportSize({ height: 900, width: 1023 });
    await expect(scrim).toBeVisible();
    await expect(back).toBeVisible();
    await expect(back).toBeFocused();
    await expect(body).toHaveCSS("overflow", "hidden");
    const mobileDetailBox = await detail(page).boundingBox();
    expect(mobileDetailBox?.x).toBe(8);
    expect(mobileDetailBox?.width).toBe(1007);
    const mobileFocusable = detail(page).locator(DETAIL_TABBABLE_SELECTOR);
    await mobileFocusable.last().focus();
    await page.keyboard.press("Tab");
    await expect(mobileFocusable.first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(detail(page)).toBeHidden();
    await expect(body).not.toHaveCSS("overflow", "hidden");
    await expect(target).toBeFocused();

    await target.press("Enter");
    await expect(back).toBeFocused();
    await expect(body).toHaveCSS("overflow", "hidden");
    await page.setViewportSize({ height: 900, width: 1024 });
    await expect(scrim).toBeHidden();
    await expect(back).toBeHidden();
    await expect(close).toBeVisible();
    await expect(close).toBeFocused();
    await expect(body).not.toHaveCSS("overflow", "hidden");
    await page.keyboard.press("Escape");
    await expect(detail(page)).toBeVisible();
    await close.click();
    await expect(detail(page)).toBeHidden();
    await expect(target).toBeFocused();
});

test("a short real database lock stays loading and the same request naturally succeeds", async ({
    page,
}) => {
    if (!fixture) throw new Error("Completion fixture is unavailable");
    await page.setViewportSize({ height: 900, width: 1440 });
    await openDashboard(page);

    const release = await fixture.holdLibraryWriteLock();
    let released = false;
    try {
        const pageTwoResponse = recordingQueryResponse(
            page,
            (url) => url.searchParams.get("page") === "2",
        );
        await nextPage(page).click();

        let loadingObservations = 0;
        await expect
            .poll(
                async () => {
                    loadingObservations += 1;
                    const state = await list(page).getAttribute(
                        "data-list-state",
                    );
                    return loadingObservations >= 3 ? state : "sampling";
                },
                {
                    intervals: [50, 100, 150],
                    timeout: REQUIRED_LIBRARY_BUSY_TIMEOUT_MS - 100,
                },
            )
            .toBe("loading");

        await release();
        released = true;
        expect((await pageTwoResponse).status()).toBe(200);
        await expect(list(page)).toHaveAttribute("data-list-state", "ready");
        await expect(previousPage(page)).toBeEnabled();
    } finally {
        if (!released) await release();
    }
});

test("a recoverable SQLite schema outage returns generic 500 and Retry recovers", async ({
    page,
}) => {
    if (!fixture) throw new Error("Completion fixture is unavailable");
    await page.setViewportSize({ height: 900, width: 1440 });
    await openDashboard(page);

    const callbackFailure = new Error(
        "Recording-list completion synthetic outage callback failure",
    );
    await expect(
        fixture.withLibrarySchemaOutage(async () => {
            throw callbackFailure;
        }),
    ).rejects.toBe(callbackFailure);
    expect(
        (
            await query(
                page,
                "includeTranscript=1&page=1&pageSize=10&sort=newest",
            )
        ).pagination,
    ).toEqual({ page: 1, pageSize: 10, total: 24 });

    await fixture.withLibrarySchemaOutage(async () => {
        const outageQuery = new URLSearchParams({
            includeTranscript: "1",
            page: "2",
            pageSize: "10",
            sort: "newest",
        });
        const directResponse = await page.request.get(
            `/api/recordings/query?${outageQuery.toString()}`,
            { timeout: REQUIRED_LIBRARY_BUSY_TIMEOUT_MS + 4_000 },
        );
        expect(directResponse.status()).toBe(500);
        expect(directResponse.headers()["cache-control"]).toContain(
            "private, no-store",
        );
        expect(directResponse.headers()["content-type"]).toContain(
            "application/json",
        );
        const directBody = await directResponse.text();
        expect(directBody).toBe(
            JSON.stringify({ error: "Failed to query recordings" }),
        );
        expect(directBody).not.toMatch(
            /SQLITE|no such table|betterainote-library|file:|\.db\b|\/Users\/|\/tmp\//i,
        );

        const failedResponse = recordingQueryResponse(
            page,
            (url) =>
                url.searchParams.get("includeTranscript") === "1" &&
                url.searchParams.get("page") === "2" &&
                url.searchParams.get("pageSize") === "10" &&
                url.searchParams.get("sort") === "newest",
            REQUIRED_LIBRARY_BUSY_TIMEOUT_MS + 4_000,
        );
        await nextPage(page).click();
        const response = await failedResponse;
        expect(response.status()).toBe(500);
        expect(response.headers()["cache-control"]).toContain(
            "private, no-store",
        );
        expect(response.headers()["content-type"]).toContain(
            "application/json",
        );
        await expect(list(page)).toHaveAttribute("data-list-state", "error");
    });
    await expect(list(page)).toHaveAttribute("data-list-state", "error");

    const retryResponse = recordingQueryResponse(
        page,
        (url) => url.searchParams.get("page") === "2",
    );
    const retry = page.locator('[data-control="recording-list-retry"]');
    await retry.focus();
    await retry.press("Enter");
    const response = await retryResponse;
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private, no-store");
    await expect(list(page)).toHaveAttribute("data-list-state", "ready");
    await expect(previousPage(page)).toBeEnabled();
});
