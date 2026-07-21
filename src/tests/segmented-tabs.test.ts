import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getSegmentedTabsKeyboardActivationValue } from "@/components/ui/segmented-tabs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const items = [
    { value: "transcript", label: "Transcript" },
    { value: "speakers", label: "Speakers" },
    { value: "source", label: "Source" },
] as const;

describe("getSegmentedTabsKeyboardActivationValue", () => {
    it("activates the tab reached by horizontal arrow navigation", () => {
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowRight",
                orientation: "horizontal",
                value: "transcript",
            }),
        ).toBe("speakers");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowLeft",
                orientation: "horizontal",
                value: "speakers",
            }),
        ).toBe("transcript");
    });

    it("skips disabled tabs while preserving wrapping, home, and end behavior", () => {
        const itemsWithDisabledTab = [
            items[0],
            { value: "speakers", label: "Speakers", disabled: true },
            items[2],
        ] as const;

        expect(
            getSegmentedTabsKeyboardActivationValue({
                items: itemsWithDisabledTab,
                key: "ArrowRight",
                value: "transcript",
            }),
        ).toBe("source");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowRight",
                loop: true,
                value: "source",
            }),
        ).toBe("transcript");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowRight",
                loop: false,
                value: "source",
            }),
        ).toBeNull();
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "Home",
                value: "source",
            }),
        ).toBe("transcript");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "End",
                value: "transcript",
            }),
        ).toBe("source");
    });

    it("preserves orientation and right-to-left navigation semantics", () => {
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowDown",
                orientation: "horizontal",
                value: "transcript",
            }),
        ).toBeNull();
        expect(
            getSegmentedTabsKeyboardActivationValue({
                items,
                key: "ArrowDown",
                orientation: "vertical",
                value: "transcript",
            }),
        ).toBe("speakers");
        expect(
            getSegmentedTabsKeyboardActivationValue({
                dir: "rtl",
                items,
                key: "ArrowLeft",
                orientation: "horizontal",
                value: "transcript",
            }),
        ).toBe("speakers");
    });
});

describe("dashboard SegmentedTabs consumer", () => {
    it("uses detailTab as the controlled value and updates it through the primitive callback", () => {
        const workstation = readFileSync(
            path.join(ROOT, "features/dashboard/workstation.tsx"),
            "utf8",
        );

        expect(workstation).toContain('aria-label="详情标签"');
        expect(workstation).toContain("value={detailTab}");
        expect(workstation).toContain("onValueChange={(value) => {");
        expect(workstation).toContain("setDetailTab(value);");
        expect(workstation).toContain('hidden={detailTab !== "speakers"}');
    });
});
