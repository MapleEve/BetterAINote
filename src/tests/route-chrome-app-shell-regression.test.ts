import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname, "..");

function readSource(path: string) {
    return readFileSync(resolve(sourceRoot, path), "utf8");
}

describe("route chrome app shell", () => {
    it("uses semantic markup and existing shadcn primitives without SOT markers", () => {
        const routeChrome = readSource("app/(app)/route-chrome.tsx");

        expect(routeChrome).toContain(
            'import { Card } from "@/components/ui/card";',
        );
        expect(routeChrome).toContain('from "@/components/ui/empty";');
        expect(routeChrome).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(routeChrome).toContain("<aside");
        expect(routeChrome).toContain("<main");
        expect(routeChrome).toContain("<header");
        expect(routeChrome).toContain('aria-hidden="true"');
        expect(routeChrome).not.toMatch(/data-sot|\bsot\b/i);
    });

    it("keeps global styles limited to base and token responsibilities", () => {
        const layout = readSource("app/layout.tsx");
        const globals = readSource("app/globals.css");

        expect(layout).toContain("<ConfirmDialogProvider>");
        expect(layout).toContain("<DisplayPreferencesProvider");
        expect(layout).not.toMatch(/data-sot|\bsot\b/i);
        expect(globals).toContain("@theme inline");
        expect(globals).toContain("@custom-variant dark");
        expect(globals).not.toMatch(/data-sot|\bsot\b/i);
    });
});
