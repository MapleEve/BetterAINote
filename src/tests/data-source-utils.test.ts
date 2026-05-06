import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBuffer } from "@/lib/data-sources/utils";

describe("data source fetch utilities", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("passes an abort signal to source audio downloads so sync batches cannot hang forever", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        });
        global.fetch = fetchMock as typeof fetch;

        await fetchBuffer("https://cdn.example.test/audio.opus");

        expect(fetchMock).toHaveBeenCalledWith(
            "https://cdn.example.test/audio.opus",
            expect.objectContaining({
                signal: expect.any(AbortSignal),
            }),
        );
    });
});
