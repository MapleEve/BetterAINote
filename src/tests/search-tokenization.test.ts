import { describe, expect, it } from "vitest";
import {
    buildFtsIndexText,
    buildFtsMatchQuery,
    buildSearchTerms,
} from "@/lib/search/tokenization";

describe("search tokenization", () => {
    it("sanitizes FTS operators instead of letting user input control the query parser", () => {
        expect(
            buildSearchTerms('  meeting OR "payload"* NEAR source  '),
        ).toEqual(["meeting", "payload", "source"]);
        expect(
            buildFtsMatchQuery('  meeting OR "payload"* NEAR source  '),
        ).toBe("meeting payload source");
    });

    it("adds deterministic CJK n-gram fallback terms for local SQLite builds without a tokenizer extension", () => {
        expect(buildSearchTerms("动画音频")).toEqual([
            "动画音频",
            "动画",
            "画音",
            "音频",
        ]);
    });

    it("stores CJK fallback terms alongside the original index text", () => {
        expect(buildFtsIndexText("动画音频")).toBe("动画音频 动画 画音 音频");
    });

    it("stores mixed Latin and CJK terms so tags like E2E发布 can be found", () => {
        expect(buildSearchTerms("E2E发布")).toEqual(["e2e", "发布"]);
        expect(buildFtsMatchQuery("E2E发布")).toBe("e2e 发布");
        expect(buildFtsIndexText("E2E发布")).toBe("E2E发布 e2e 发布");
    });

    it("drops punctuation-only and emoji-only input before it reaches FTS MATCH", () => {
        expect(buildSearchTerms('  " * ( ) : ^  ')).toEqual([]);
        expect(buildFtsMatchQuery("🔥🎙️✨")).toBe("");
        expect(buildFtsIndexText("🔥🎙️✨")).toBe("🔥🎙️✨");
    });

    it("keeps numeric and underscore tokens while stripping parser operators case-insensitively", () => {
        expect(buildSearchTerms("NOT Project_42 and v2")).toEqual([
            "project_42",
            "v2",
        ]);
        expect(buildFtsMatchQuery("NOT Project_42 and v2")).toBe(
            "project_42 v2",
        );
    });
});
