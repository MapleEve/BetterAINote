import { describe, expect, it } from "vitest";
import {
    normalizeServiceUrl,
    ServiceUrlValidationError,
} from "@/lib/service-url";

describe("normalizeServiceUrl", () => {
    it("normalizes absolute HTTP URLs and removes trailing slashes", () => {
        expect(
            normalizeServiceUrl(
                "  https://transcribe.internal:8780/api/  ",
                "privateTranscriptionBaseUrl",
            ),
        ).toBe("https://transcribe.internal:8780/api");
    });

    it("rejects embedded credentials", () => {
        expect(() =>
            normalizeServiceUrl(
                "https://user:secret@transcribe.internal:8780",
                "privateTranscriptionBaseUrl",
            ),
        ).toThrowError(
            new ServiceUrlValidationError(
                "privateTranscriptionBaseUrl must not include embedded credentials",
            ),
        );
    });

    it("rejects query strings and fragments", () => {
        expect(() =>
            normalizeServiceUrl(
                "https://llm.internal/v1?model=gpt#frag",
                "titleGenerationBaseUrl",
            ),
        ).toThrowError(
            new ServiceUrlValidationError(
                "titleGenerationBaseUrl must not include query parameters or fragments",
            ),
        );
    });
});
