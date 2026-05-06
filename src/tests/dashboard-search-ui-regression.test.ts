import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("dashboard search UI regression", () => {
    it("exposes a dashboard search entrypoint for the four library scopes", () => {
        const workstation = readFileSync(
            path.join(ROOT, "features/dashboard/workstation.tsx"),
            "utf8",
        );
        const searchComponent = readFileSync(
            path.join(ROOT, "features/dashboard/components/library-search.tsx"),
            "utf8",
        );

        expect(workstation).toContain("<LibrarySearch");
        expect(searchComponent).toContain("/api/search");
        expect(searchComponent).toContain('"recording"');
        expect(searchComponent).toContain('"transcript"');
        expect(searchComponent).toContain('"speaker"');
        expect(searchComponent).toContain('"tag"');
        expect(searchComponent).toContain(
            "Search recordings, transcripts, speakers, tags",
        );
        expect(searchComponent).toContain("搜索录音、逐字稿、说话人、标签");
    });

    it("keeps search collapsed next to the sync action until opened", () => {
        const workstation = readFileSync(
            path.join(ROOT, "features/dashboard/workstation.tsx"),
            "utf8",
        );
        const searchComponent = readFileSync(
            path.join(ROOT, "features/dashboard/components/library-search.tsx"),
            "utf8",
        );

        const syncActionIndex = workstation.indexOf("onClick={handleSync}");
        const searchIndex = workstation.indexOf("<LibrarySearch");
        const settingsIndex = workstation.indexOf(
            "onClick={() => setSettingsOpen(true)}",
        );

        expect(syncActionIndex).toBeGreaterThan(-1);
        expect(searchIndex).toBeGreaterThan(syncActionIndex);
        expect(searchIndex).toBeLessThan(settingsIndex);
        expect(workstation).not.toContain(
            "<>\n                            <LibrarySearch",
        );

        expect(searchComponent).toContain(
            "const [isOpen, setIsOpen] = useState(false)",
        );
        expect(searchComponent).toContain(
            'aria-label={isZh ? "打开搜索" : "Open search"}',
        );
        expect(searchComponent).toContain("ref={inputRef}");
        expect(searchComponent).toContain("{isOpen ? (");
    });

    it("does not show an empty-result count while a debounced search is pending", () => {
        const searchComponent = readFileSync(
            path.join(ROOT, "features/dashboard/components/library-search.tsx"),
            "utf8",
        );

        expect(searchComponent).toContain("if (loading) {");
        expect(searchComponent).toContain("setLoading(true);");
        expect(searchComponent).toContain("setResults([]);");
    });
});
