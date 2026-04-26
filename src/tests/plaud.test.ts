import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from "vitest";
import {
    DEFAULT_PLAUD_API_BASE,
    normalizePlaudBearerToken,
    PlaudClient,
} from "../lib/data-sources/providers/plaud/client";
import { PlaudSourceClient } from "../lib/data-sources/providers/plaud/definition";
import {
    DEFAULT_SERVER_KEY,
    isValidPlaudApiUrl,
    PLAUD_SERVERS,
    resolveApiBase,
    serverKeyFromApiBase,
} from "../lib/data-sources/providers/plaud/servers";

const originalFetch = global.fetch;
let mockFetch: Mock;

beforeAll(() => {
    mockFetch = vi.fn() as Mock;
    global.fetch = mockFetch as typeof global.fetch;
});

afterAll(() => {
    global.fetch = originalFetch;
});

describe("PlaudClient", () => {
    let client: PlaudClient;
    const mockBearerToken = "test-bearer-token";

    beforeEach(() => {
        client = new PlaudClient(mockBearerToken);
        vi.clearAllMocks();
    });

    describe("constructor", () => {
        it("should create client with bearer token", () => {
            expect(client).toBeInstanceOf(PlaudClient);
        });

        it("should use custom apiBase when provided", () => {
            const euClient = new PlaudClient(
                mockBearerToken,
                "https://api-euc1.plaud.ai",
            );
            expect(euClient).toBeInstanceOf(PlaudClient);
        });
    });

    describe("listDevices", () => {
        it("should make authenticated request to device list endpoint", async () => {
            const mockResponse = {
                status: 0,
                msg: "success",
                data_devices: [
                    {
                        sn: "888317426694681884",
                        name: "Test Device",
                        model: "888",
                        version_number: 131339,
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await client.listDevices();

            expect(fetch).toHaveBeenCalledWith(
                `${DEFAULT_PLAUD_API_BASE}/device/list`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockBearerToken}`,
                        "Content-Type": "application/json",
                    }),
                }),
            );
            expect(result).toEqual(mockResponse);
        });

        it("should use custom apiBase for requests", async () => {
            const euClient = new PlaudClient(
                mockBearerToken,
                "https://api-euc1.plaud.ai",
            );
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        status: 0,
                        msg: "success",
                        data_devices: [],
                    }),
            });

            await euClient.listDevices();

            expect(fetch).toHaveBeenCalledWith(
                "https://api-euc1.plaud.ai/device/list",
                expect.any(Object),
            );
        });
    });

    describe("getRecordings", () => {
        it("should make request with default parameters", async () => {
            const mockResponse = {
                status: 0,
                msg: "success",
                data_file_total: 0,
                data_file_list: [],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await client.getRecordings();

            expect(fetch).toHaveBeenCalledWith(
                `${DEFAULT_PLAUD_API_BASE}/file/simple/web?skip=0&limit=99999&is_trash=0&sort_by=start_time&is_desc=true`,
                expect.any(Object),
            );
            expect(result).toEqual(mockResponse);
        });

        it("should make request with custom parameters", async () => {
            const mockResponse = {
                status: 0,
                msg: "success",
                data_file_total: 0,
                data_file_list: [],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            await client.getRecordings(10, 50, 1, "create_time", false);

            expect(fetch).toHaveBeenCalledWith(
                `${DEFAULT_PLAUD_API_BASE}/file/simple/web?skip=10&limit=50&is_trash=1&sort_by=create_time&is_desc=false`,
                expect.any(Object),
            );
        });
    });

    describe("getTempUrl", () => {
        it("should get temp URL for OPUS format by default", async () => {
            const mockResponse = {
                code: 0,
                msg: "success",
                data: {
                    temp_url: "https://example.com/audio.wav",
                    temp_url_opus: "https://example.com/audio.opus",
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await client.getTempUrl("file-123");

            expect(fetch).toHaveBeenCalledWith(
                `${DEFAULT_PLAUD_API_BASE}/file/temp-url/file-123?is_opus=1`,
                expect.any(Object),
            );
            expect(result).toEqual(mockResponse);
        });

        it("should get temp URL for WAV format when specified", async () => {
            const mockResponse = {
                code: 0,
                msg: "success",
                data: {
                    temp_url: "https://example.com/audio.wav",
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            await client.getTempUrl("file-123", false);

            expect(fetch).toHaveBeenCalledWith(
                `${DEFAULT_PLAUD_API_BASE}/file/temp-url/file-123?is_opus=0`,
                expect.any(Object),
            );
        });
    });

    describe("testConnection", () => {
        it("should return true when connection is successful", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        status: 0,
                        msg: "success",
                        data_devices: [],
                    }),
            });

            const result = await client.testConnection();
            expect(result).toBe(true);
        });

        it("should return false when connection fails", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network error"));

            const result = await client.testConnection();
            expect(result).toBe(false);
        });

        it("should return false when Plaud rejects the region or token", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        status: -302,
                        msg: "user region mismatch",
                        data_devices: [],
                    }),
            });

            const result = await client.testConnection();
            expect(result).toBe(false);
        });
    });

    describe("server key resolution", () => {
        it("should resolve known server keys to API base URLs", () => {
            expect(PLAUD_SERVERS.global.apiBase).toBe("https://api.plaud.ai");
            expect(PLAUD_SERVERS.eu.apiBase).toBe("https://api-euc1.plaud.ai");
            expect(PLAUD_SERVERS.china.apiBase).toBe("https://api.plaud.cn");
        });

        it("should have global as the default server key", () => {
            expect(DEFAULT_SERVER_KEY).toBe("global");
        });

        it("should reject unknown server keys", () => {
            const unknownKey = "evil";
            expect(unknownKey in PLAUD_SERVERS).toBe(false);
        });
    });

    describe("isValidPlaudApiUrl", () => {
        it("should accept valid plaud.ai HTTPS URLs", () => {
            expect(isValidPlaudApiUrl("https://api.plaud.ai")).toBe(true);
            expect(isValidPlaudApiUrl("https://api-euc1.plaud.ai")).toBe(true);
            expect(isValidPlaudApiUrl("https://api-apse1.plaud.ai")).toBe(true);
            expect(isValidPlaudApiUrl("https://api-usw1.plaud.ai")).toBe(true);
            expect(isValidPlaudApiUrl("https://api.plaud.cn")).toBe(true);
        });

        it("should reject non-plaud domains", () => {
            expect(isValidPlaudApiUrl("https://evil.com")).toBe(false);
            expect(isValidPlaudApiUrl("https://plaud.ai.evil.com")).toBe(false);
            expect(isValidPlaudApiUrl("https://notplaud.ai")).toBe(false);
        });

        it("should reject non-HTTPS URLs", () => {
            expect(isValidPlaudApiUrl("http://api.plaud.ai")).toBe(false);
        });

        it("should reject invalid URLs", () => {
            expect(isValidPlaudApiUrl("")).toBe(false);
            expect(isValidPlaudApiUrl("not-a-url")).toBe(false);
        });
    });

    describe("resolveApiBase", () => {
        it("should resolve known server keys", () => {
            expect(resolveApiBase("global")).toBe("https://api.plaud.ai");
            expect(resolveApiBase("eu")).toBe("https://api-euc1.plaud.ai");
            expect(resolveApiBase("apse1")).toBe("https://api-apse1.plaud.ai");
            expect(resolveApiBase("china")).toBe("https://api.plaud.cn");
        });

        it("should resolve custom key with valid URL", () => {
            expect(resolveApiBase("custom", "https://api-usw1.plaud.ai")).toBe(
                "https://api-usw1.plaud.ai",
            );
        });

        it("should strip trailing slashes from custom URLs", () => {
            expect(resolveApiBase("custom", "https://api.plaud.ai/")).toBe(
                "https://api.plaud.ai",
            );
        });

        it("should return null for custom key with invalid URL", () => {
            expect(resolveApiBase("custom", "https://evil.com")).toBeNull();
            expect(resolveApiBase("custom", "")).toBeNull();
            expect(resolveApiBase("custom")).toBeNull();
        });

        it("should return null for unknown server keys", () => {
            expect(resolveApiBase("evil")).toBeNull();
        });
    });

    describe("serverKeyFromApiBase", () => {
        it("should return known keys for known URLs", () => {
            expect(serverKeyFromApiBase("https://api.plaud.ai")).toBe("global");
            expect(serverKeyFromApiBase("https://api-euc1.plaud.ai")).toBe(
                "eu",
            );
            expect(serverKeyFromApiBase("https://api-apse1.plaud.ai")).toBe(
                "apse1",
            );
            expect(serverKeyFromApiBase("https://api.plaud.cn")).toBe("china");
        });

        it("should return 'custom' for unknown URLs", () => {
            expect(serverKeyFromApiBase("https://api-usw1.plaud.ai")).toBe(
                "custom",
            );
        });
    });

    describe("error handling", () => {
        it("should show a user-facing connection error when the service returns an error", async () => {
            const errorResponse = {
                status: 400,
                msg: "Invalid request",
            };

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: "Bad Request",
                json: () => Promise.resolve(errorResponse),
            });

            await expect(client.listDevices()).rejects.toThrow(
                "Unable to connect to Plaud (400): Invalid request",
            );
        });

        it("should throw error when fetch fails", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network error"));

            await expect(client.listDevices()).rejects.toThrow("Network error");
        });

        it("retries transient socket disconnects before surfacing an error", async () => {
            const mockResponse = {
                status: 0,
                msg: "success",
                data_devices: [],
            };

            mockFetch
                .mockRejectedValueOnce(
                    new Error("The socket connection was closed unexpectedly"),
                )
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockResponse),
                });

            await expect(client.listDevices()).resolves.toEqual(mockResponse);
            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe("normalizePlaudBearerToken", () => {
        it("strips a bearer prefix and line breaks", () => {
            expect(
                normalizePlaudBearerToken(
                    "bearer\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
                ),
            ).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
        });

        it("removes extra whitespace from the pasted token", () => {
            expect(
                normalizePlaudBearerToken(
                    "  Bearer  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9  ",
                ),
            ).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
        });

        it("accepts an Authorization header pasted with a bearer prefix", () => {
            expect(
                normalizePlaudBearerToken(
                    "  Authorization: Bearer\n eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9  ",
                ),
            ).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");

            expect(
                normalizePlaudBearerToken(
                    "Authorization：bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
                ),
            ).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
        });
    });
});

describe("PlaudSourceClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("limits Plaud enrichment requests while building source recordings", async () => {
        let activeRequests = 0;
        let maxActiveRequests = 0;
        const sourceClient = new PlaudSourceClient({
            userId: "user-1",
            provider: "plaud",
            enabled: true,
            authMode: "bearer",
            baseUrl: DEFAULT_PLAUD_API_BASE,
            config: {},
            secrets: { bearerToken: "test-bearer-token" },
            lastSync: null,
        });
        const recordings = Array.from({ length: 8 }, (_, index) => ({
            id: `file-${index}`,
            filename: `recording-${index}`,
            keywords: [],
            filesize: 1024,
            filetype: "mp3",
            fullname: `recording-${index}.mp3`,
            file_md5: `md5-${index}`,
            ori_ready: true,
            version: index,
            version_ms: index + 100,
            edit_time: 0,
            edit_from: "",
            is_trash: false,
            start_time: 1_700_000_000_000 + index,
            end_time: 1_700_000_060_000 + index,
            duration: 60_000,
            timezone: 8,
            zonemins: 480,
            scene: 0,
            filetag_id_list: [],
            serial_number: "device-1",
            is_trans: true,
            is_summary: true,
        }));

        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/file/simple/web")) {
                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            status: 0,
                            msg: "success",
                            data_file_total: recordings.length,
                            data_file_list: recordings,
                        }),
                };
            }

            if (
                url.includes("/ai/transsumm/") ||
                url.includes("/file/temp-url/")
            ) {
                activeRequests += 1;
                maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
                await new Promise((resolve) => setTimeout(resolve, 5));
                activeRequests -= 1;

                if (url.includes("/ai/transsumm/")) {
                    return {
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                status: 0,
                                msg: "success",
                                data_result: [
                                    {
                                        speaker: "Speaker 1",
                                        content: "hello",
                                        start_time: 0,
                                        end_time: 1000,
                                    },
                                ],
                                data_result_summ: { content: "summary" },
                                data_result_summ_mul: null,
                                outline_result: null,
                            }),
                    };
                }

                return {
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            status: 0,
                            temp_url_opus: "https://example.com/audio.opus",
                            temp_url: "https://example.com/audio.mp3",
                        }),
                };
            }

            throw new Error(`Unexpected Plaud request: ${url}`);
        });

        await expect(sourceClient.listRecordings()).resolves.toHaveLength(8);
        expect(maxActiveRequests).toBeLessThanOrEqual(4);
    });
});
