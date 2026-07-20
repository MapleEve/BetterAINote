import { describe, expect, it } from "vitest";
import { resolveRecordingPagination } from "@/server/modules/recordings/read-model";

describe("recording pagination", () => {
    it("clamps empty, overlarge, and invalid requests to a readable page", () => {
        expect(resolveRecordingPagination(0, 10, 3)).toEqual({
            page: 1,
            pageSize: 10,
            total: 0,
        });
        expect(resolveRecordingPagination(21, 10, 99)).toEqual({
            page: 3,
            pageSize: 10,
            total: 21,
        });
        expect(resolveRecordingPagination(21, 0, 0)).toEqual({
            page: 1,
            pageSize: 1,
            total: 21,
        });
    });
});
