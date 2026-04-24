import { describe, expect, it } from "vitest";
import { ErrorCode, mapErrorToAppError } from "@/lib/errors";

describe("error mapping", () => {
    it("maps provider-neutral upstream API failures without naming one source", () => {
        const mapped = mapErrorToAppError(
            new Error("Provider API request failed: 502"),
        );

        expect(mapped.code).toBe(ErrorCode.DATA_SOURCE_API_ERROR);
        expect(mapped.message).toBe(
            "Failed to communicate with the upstream source service. Please try again later.",
        );
        expect(mapped.statusCode).toBe(502);
    });

    it("maps provider-neutral upstream rate limits", () => {
        const mapped = mapErrorToAppError(
            new Error("Provider API request failed: 429"),
        );

        expect(mapped.code).toBe(ErrorCode.DATA_SOURCE_RATE_LIMITED);
        expect(mapped.statusCode).toBe(429);
    });
});
