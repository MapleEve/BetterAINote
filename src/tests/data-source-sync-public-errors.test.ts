import { describe, expect, it } from "vitest";
import {
    createDataSourceSyncPublicErrorResponse,
    DATA_SOURCE_SYNC_PUBLIC_REASON,
    getDataSourceSyncPublicReason,
} from "@/server/modules/data-sources/data-source-sync-public-errors";

describe("data source sync public errors", () => {
    it("maps unavailable worker runtime failures to a stable public reason", () => {
        expect(
            getDataSourceSyncPublicReason(
                new Error("Worker runtime unavailable while starting"),
            ),
        ).toBe(DATA_SOURCE_SYNC_PUBLIC_REASON.RUNTIME_UNAVAILABLE);
        expect(
            getDataSourceSyncPublicReason({
                cause: new Error("worker not responding"),
            }),
        ).toBe(DATA_SOURCE_SYNC_PUBLIC_REASON.RUNTIME_UNAVAILABLE);
    });

    it("returns the runtime reason in the public route response", () => {
        expect(
            createDataSourceSyncPublicErrorResponse(
                new Error("runtime not available"),
            ),
        ).toMatchObject({
            body: {
                error: "runtime-unavailable",
                reason: "runtime-unavailable",
            },
            status: 500,
        });
    });
});
