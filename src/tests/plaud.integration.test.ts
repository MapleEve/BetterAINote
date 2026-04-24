import { beforeAll, describe, expect, it } from "vitest";
import { PlaudClient } from "../lib/data-sources/providers/plaud/client";

const bearerToken = process.env.PLAUD_BEARER_TOKEN;
const apiBase = process.env.PLAUD_API_BASE;
const hasToken = typeof bearerToken === "string" && bearerToken.length > 0;

if (!hasToken) {
    console.warn(
        "Skipping PlaudClient integration tests: PLAUD_BEARER_TOKEN not set.",
    );
}

const describeIntegration = hasToken ? describe : describe.skip;

describeIntegration("PlaudClient (integration)", () => {
    let client: PlaudClient;

    beforeAll(() => {
        client = new PlaudClient(bearerToken as string, apiBase);
    });

    it("confirms the Plaud service connection is healthy", async () => {
        const result = await client.testConnection();
        expect(result).toBe(true);
    });

    it("lists devices with a success response", async () => {
        const response = await client.listDevices();
        expect(response.status).toBe(0);
        expect(Array.isArray(response.data_devices)).toBe(true);
    });

    it("fetches the latest recordings payload", async () => {
        const response = await client.getRecordings(0, 5, 0, "edit_time", true);
        expect(response.status).toBe(0);
        expect(Array.isArray(response.data_file_list)).toBe(true);
        expect(typeof response.data_file_total).toBe("number");
    });
});
