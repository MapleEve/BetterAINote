import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";

const ROUTES = [
    { method: "GET", name: "sources-get", path: "/api/data-sources" },
    { method: "PUT", name: "sources-put", path: "/api/data-sources" },
    {
        method: "POST",
        name: "disconnect",
        path: "/api/data-sources/disconnect",
    },
    {
        method: "POST",
        name: "reconnect",
        path: "/api/data-sources/reconnect",
    },
    { method: "GET", name: "sync-get", path: "/api/data-sources/sync" },
    { method: "POST", name: "sync-post", path: "/api/data-sources/sync" },
    { method: "POST", name: "test", path: "/api/data-sources/test" },
] as const;

type Route = (typeof ROUTES)[number];

type NextServer = {
    child: ChildProcessWithoutNullStreams;
    output: string;
    url: string;
};

const runningServers: NextServer[] = [];

function getAvailablePort() {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                server.close();
                reject(new Error("Unable to allocate a loopback port"));
                return;
            }

            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(address.port);
            });
        });
    });
}

async function waitForNextReady(server: NextServer) {
    const { child } = server;

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Next server did not start:\n${server.output}`));
        }, 60_000);
        const onOutput = (_chunk: Buffer) => {
            if (/Ready in|started server on|Local:/i.test(server.output)) {
                clearTimeout(timeout);
                child.stdout.off("data", onOutput);
                child.stderr.off("data", onOutput);
                resolve();
            }
        };
        child.stdout.on("data", onOutput);
        child.stderr.on("data", onOutput);
        child.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        child.once("exit", (code, signal) => {
            clearTimeout(timeout);
            reject(
                new Error(
                    `Next server exited before readiness (code=${code}, signal=${signal}):\n${server.output}`,
                ),
            );
        });
    });
}

async function prepareIsolatedNextApp(e2eRoot: string, databasePath: string) {
    const appDir = path.join(e2eRoot, "app");
    const dataDir = path.join(e2eRoot, "data");
    const storageDir = path.join(e2eRoot, "storage");
    await new Promise<void>((resolve, reject) => {
        const setup = spawn("node", ["scripts/e2e-setup.mjs"], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                DATABASE_PATH: databasePath,
                PLAYWRIGHT_E2E_APP_DIR: appDir,
                PLAYWRIGHT_E2E_DATA_DIR: dataDir,
                PLAYWRIGHT_E2E_ROOT: e2eRoot,
                PLAYWRIGHT_E2E_STORAGE_DIR: storageDir,
            },
        });
        let logs = "";
        setup.stdout.on("data", (chunk: Buffer) => {
            logs += chunk.toString();
        });
        setup.stderr.on("data", (chunk: Buffer) => {
            logs += chunk.toString();
        });
        setup.once("error", reject);
        setup.once("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(
                new Error(
                    `Isolated Next setup failed (code=${code}, signal=${signal}):\n${logs}`,
                ),
            );
        });
    });

    return appDir;
}

async function startNextServer(databasePath: string, appDir: string) {
    const port = await getAvailablePort();
    const url = `http://127.0.0.1:${port}`;
    const child = spawn(
        "bunx",
        [
            "next",
            "dev",
            "--webpack",
            "--hostname",
            "127.0.0.1",
            "--port",
            String(port),
        ],
        {
            cwd: appDir,
            detached: true,
            env: {
                ...process.env,
                APP_URL: url,
                BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
                DATABASE_PATH: databasePath,
                ENCRYPTION_KEY:
                    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                NEXT_TELEMETRY_DISABLED: "1",
            },
        },
    );
    const server = { child, output: "", url };
    const appendOutput = (chunk: Buffer) => {
        server.output += chunk.toString();
    };
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    runningServers.push(server);
    await waitForNextReady(server);
    return server;
}

async function stopNextServer(server: NextServer) {
    const index = runningServers.indexOf(server);
    if (index >= 0) {
        runningServers.splice(index, 1);
    }

    if (server.child.exitCode !== null || server.child.signalCode !== null) {
        return;
    }

    const processGroup = server.child.pid;
    if (!processGroup) {
        return;
    }

    process.kill(-processGroup, "SIGTERM");
    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            process.kill(-processGroup, "SIGKILL");
            resolve();
        }, 5_000);
        server.child.once("exit", () => {
            clearTimeout(timeout);
            resolve();
        });
    });
}

async function lockCoreDatabase(databasePath: string): Promise<Client> {
    const client = createClient({ url: pathToFileURL(databasePath).href });
    await client.execute("CREATE TABLE readiness_probe (id INTEGER)");
    await client.execute("PRAGMA busy_timeout = 0");
    await client.execute("BEGIN EXCLUSIVE");
    return client;
}

async function releaseCoreDatabaseLock(client: Client | null) {
    if (!client) return;

    try {
        await client.execute("COMMIT");
    } finally {
        client.close();
    }
}

async function callRoute(server: NextServer, route: Route) {
    try {
        return await fetch(`${server.url}${route.path}`, {
            method: route.method,
            headers:
                route.method === "GET"
                    ? undefined
                    : { "content-type": "application/json" },
            body: route.method === "GET" ? undefined : "{}",
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        throw new Error(
            `Real HTTP request to ${route.name} failed:\n${server.output}`,
            { cause: error },
        );
    }
}

async function warmRoute(server: NextServer, route: Route) {
    expect((await callRoute(server, route)).status).toBe(401);
}

afterEach(async () => {
    await Promise.all(runningServers.splice(0).map(stopNextServer));
});

describe("Data Sources core database readiness contract", () => {
    it.each(
        ROUTES,
    )("$name returns 500 while the core database lock is retained, then retries to 401 after release", async (route) => {
        const directory = await mkdtemp(
            path.join(os.tmpdir(), "betterainote-route-ready-"),
        );
        const e2eRoot = path.join(directory, "e2e");
        const databasePath = path.join(e2eRoot, "data", "core.db");
        let lock: Client | null = null;
        let server: NextServer | null = null;

        try {
            const appDir = await prepareIsolatedNextApp(e2eRoot, databasePath);
            server = await startNextServer(databasePath, appDir);
            await warmRoute(server, route);
            lock = await lockCoreDatabase(databasePath);

            expect((await callRoute(server, route)).status).toBe(500);

            await releaseCoreDatabaseLock(lock);
            lock = null;

            expect((await callRoute(server, route)).status).toBe(401);
        } finally {
            await releaseCoreDatabaseLock(lock);
            if (server) await stopNextServer(server);
            await rm(directory, { recursive: true });
        }
    }, 90_000);

    it("rejects concurrent unauthenticated requests until the failed readiness attempt is retried", async () => {
        const directory = await mkdtemp(
            path.join(os.tmpdir(), "betterainote-route-ready-"),
        );
        const e2eRoot = path.join(directory, "e2e");
        const databasePath = path.join(e2eRoot, "data", "core.db");
        let lock: Client | null = null;
        let server: NextServer | null = null;

        try {
            const appDir = await prepareIsolatedNextApp(e2eRoot, databasePath);
            server = await startNextServer(databasePath, appDir);
            await warmRoute(server, ROUTES[0]);
            await warmRoute(server, ROUTES[4]);
            lock = await lockCoreDatabase(databasePath);

            const locked = await Promise.all([
                callRoute(server, ROUTES[0]),
                callRoute(server, ROUTES[4]),
            ]);
            expect(locked.map((response) => response.status)).toEqual([
                500, 500,
            ]);

            await releaseCoreDatabaseLock(lock);
            lock = null;

            const retried = await Promise.all([
                callRoute(server, ROUTES[0]),
                callRoute(server, ROUTES[4]),
            ]);
            expect(retried.map((response) => response.status)).toEqual([
                401, 401,
            ]);
        } finally {
            await releaseCoreDatabaseLock(lock);
            if (server) await stopNextServer(server);
            await rm(directory, { recursive: true });
        }
    }, 90_000);
});
