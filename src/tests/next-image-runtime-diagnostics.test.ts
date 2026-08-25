import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { chromium } from "@playwright/test";
import { afterEach, describe, expect, it } from "vitest";

type NextServer = {
    child: ChildProcessWithoutNullStreams;
    output: string;
    url: string;
};

const runningServers: NextServer[] = [];
const TARGET_IMAGE_ASSETS = [
    "/assets/logo-mark-steel.svg",
    "/assets/sources/ticnote.png",
] as const;

function readSource(filePath: string) {
    return readFile(path.join(process.cwd(), filePath), "utf8");
}

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
            server.close((error) =>
                error ? reject(error) : resolve(address.port),
            );
        });
    });
}

function targetImageDiagnostics(output: string) {
    return TARGET_IMAGE_ASSETS.flatMap((asset) => {
        const escapedAsset = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const diagnostic = new RegExp(
            `(?:${escapedAsset}[\\s\\S]{0,500}(?:Image with src|next/image|custom image loader|width|height|aspect ratio)|(?:Image with src|next/image|custom image loader|width|height|aspect ratio)[\\s\\S]{0,500}${escapedAsset})`,
            "i",
        );
        return diagnostic.test(output) ? [asset] : [];
    });
}

async function waitForNextReady(server: NextServer) {
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Next server did not start:\n${server.output}`));
        }, 60_000);
        const onOutput = () => {
            if (/Ready in|started server on|Local:/i.test(server.output)) {
                clearTimeout(timeout);
                server.child.stdout.off("data", onOutput);
                server.child.stderr.off("data", onOutput);
                resolve();
            }
        };
        server.child.stdout.on("data", onOutput);
        server.child.stderr.on("data", onOutput);
        server.child.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        server.child.once("exit", (code, signal) => {
            clearTimeout(timeout);
            reject(
                new Error(
                    `Next server exited before readiness (code=${code}, signal=${signal}):\n${server.output}`,
                ),
            );
        });
    });
}

async function prepareIsolatedNextApp(root: string, databasePath: string) {
    const appDir = path.join(root, "app");
    const dataDir = path.join(root, "data");
    const storageDir = path.join(root, "storage");
    const setup = spawn("node", ["scripts/e2e-setup.mjs"], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            DATABASE_PATH: databasePath,
            PLAYWRIGHT_E2E_APP_DIR: appDir,
            PLAYWRIGHT_E2E_DATA_DIR: dataDir,
            PLAYWRIGHT_E2E_ROOT: root,
            PLAYWRIGHT_E2E_STORAGE_DIR: storageDir,
        },
    });
    let output = "";
    setup.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
    });
    setup.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
    });
    await new Promise<void>((resolve, reject) => {
        setup.once("error", reject);
        setup.once("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(
                new Error(
                    `Isolated Next setup failed (code=${code}, signal=${signal}):\n${output}`,
                ),
            );
        });
    });
    return { appDir, storageDir };
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
    if (index >= 0) runningServers.splice(index, 1);
    if (server.child.exitCode !== null || server.child.signalCode !== null)
        return;
    server.child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            server.child.kill("SIGKILL");
            resolve();
        }, 5_000);
        server.child.once("exit", () => {
            clearTimeout(timeout);
            resolve();
        });
    });
}

async function seedTicNoteRecording(databasePath: string, storageDir: string) {
    const libraryPath = databasePath.replace(/\.db$/, "-library.db");
    const core = createClient({ url: pathToFileURL(databasePath).href });
    const library = createClient({ url: pathToFileURL(libraryPath).href });
    const audioPath = path.join(storageDir, "e2e/image-diagnostics.wav");
    const now = Date.now();

    try {
        const user = await core.execute(
            "SELECT id FROM users WHERE email = 'image-diagnostics@example.com' LIMIT 1",
        );
        const userId = user.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Image diagnostics user was not created");
        }
        await mkdir(path.dirname(audioPath), { recursive: true });
        await writeFile(audioPath, "RIFF");
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO recordings (
                    id, user_id, source_provider, source_recording_id, source_version,
                    source_metadata, provider_device_id, filename, duration, start_time,
                    end_time, filesize, file_md5, storage_type, storage_path,
                    downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                "image-diagnostics-recording",
                userId,
                "ticnote",
                "image-diagnostics-source",
                "1",
                "{}",
                "image-diagnostics-device",
                "Image diagnostics recording",
                1_000,
                now - 1_000,
                now,
                4,
                "image-diagnostics-md5",
                "local",
                "e2e/image-diagnostics.wav",
                now,
                0,
                0,
                now,
                now,
            ],
        });
    } finally {
        await Promise.all([core.close(), library.close()]);
    }
}

async function signInAndNavigate(
    server: NextServer,
    databasePath: string,
    storageDir: string,
) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const signUp = await page.request.post(
        `${server.url}/api/auth/sign-up/email`,
        {
            data: {
                email: "image-diagnostics@example.com",
                name: "Image Diagnostics",
                password: "ImageDiagnostics123!",
            },
        },
    );
    if (!signUp.ok() && signUp.status() !== 403) {
        throw new Error(
            `Failed to create image diagnostics session: ${signUp.status()}`,
        );
    }
    if (signUp.status() === 403) {
        const signIn = await page.request.post(
            `${server.url}/api/auth/sign-in/email`,
            {
                data: {
                    email: "image-diagnostics@example.com",
                    password: "ImageDiagnostics123!",
                },
            },
        );
        if (!signIn.ok()) {
            throw new Error(
                `Failed to sign in image diagnostics user: ${signIn.status()}`,
            );
        }
    }

    await seedTicNoteRecording(databasePath, storageDir);
    await page.goto(`${server.url}/dashboard`, {
        waitUntil: "domcontentloaded",
    });
    await page.locator('[data-shell="dashboard-workstation"]').waitFor();
    await page.goto(`${server.url}/recordings/image-diagnostics-recording`, {
        waitUntil: "domcontentloaded",
    });
    await page.locator('[data-control="recording-player"]').waitFor();
    await context.close();
    await browser.close();
}

afterEach(async () => {
    await Promise.all(runningServers.splice(0).map(stopNextServer));
});

describe("Next Image runtime diagnostics", () => {
    it("captures dev-server diagnostics for Dashboard and recording browser navigation", async () => {
        const directory = await mkdtemp(
            path.join(os.tmpdir(), "betterainote-image-diagnostics-"),
        );
        const root = path.join(directory, "e2e");
        const databasePath = path.join(root, "data", "betterainote-e2e.db");
        let server: NextServer | null = null;

        try {
            const { appDir, storageDir } = await prepareIsolatedNextApp(
                root,
                databasePath,
            );
            server = await startNextServer(databasePath, appDir);
            server.output = "";
            await signInAndNavigate(server, databasePath, storageDir);
            expect(
                targetImageDiagnostics(server.output),
                server.output,
            ).toEqual([]);
        } finally {
            if (server) await stopNextServer(server);
            await rm(directory, { force: true, recursive: true });
        }
    }, 180_000);

    it("keeps every fixed app logo out of the custom loader", async () => {
        const files = [
            "src/app/(app)/dashboard/loading.tsx",
            "src/app/(app)/recordings/[id]/loading.tsx",
            "src/app/(app)/route-chrome.tsx",
            "src/features/dashboard/workstation.tsx",
            "src/features/recordings/workstation.tsx",
        ];

        for (const filePath of files) {
            const source = await readSource(filePath);
            const logoOffset = source.indexOf(
                'src="/assets/logo-mark-steel.svg"',
            );
            expect(logoOffset, filePath).toBeGreaterThanOrEqual(0);
            expect(
                source.slice(logoOffset, logoOffset + 240),
                filePath,
            ).toContain("unoptimized");
        }
    });

    it("keeps Dashboard provider marks as fixed local images and preserves intrinsic player dimensions", async () => {
        const dashboard = await readSource(
            "src/features/dashboard/workstation.tsx",
        );
        const recordingList = await readSource(
            "src/features/dashboard/components/recording-list.tsx",
        );
        const playerPrimitives = await readSource(
            "src/features/recordings/components/player-primitives.tsx",
        );
        const providerMarkSources = `${dashboard}\n${recordingList}`;

        expect(
            (
                providerMarkSources.match(
                    /provider marks are fixed local assets/g,
                ) ?? []
            ).length,
        ).toBe(2);
        expect(
            (providerMarkSources.match(/<img/g) ?? []).length,
        ).toBeGreaterThanOrEqual(2);
        expect(dashboard).toContain('data-part="source-provider-mark"');
        expect(recordingList).toContain(
            'data-part="dashboard-recording-source-mark"',
        );
        expect(playerPrimitives).toContain("imageHeight: 382");
        expect(playerPrimitives).toContain("imageWidth: 354");
        expect(playerPrimitives).toContain(
            '"block h-4 w-auto max-w-none object-contain"',
        );
        expect(playerPrimitives).toContain("width={badge.imageWidth}");
        expect(playerPrimitives).toContain("height={badge.imageHeight}");
        expect(playerPrimitives).toContain("unoptimized");
    });

    it("covers loading fallbacks statically because App Router does not expose a real navigation hook that can deterministically suspend them", async () => {
        for (const filePath of [
            "src/app/(app)/dashboard/loading.tsx",
            "src/app/(app)/recordings/[id]/loading.tsx",
        ]) {
            const source = await readSource(filePath);
            expect(source).toContain('src="/assets/logo-mark-steel.svg"');
            expect(source).toContain("width={36}");
            expect(source).toContain("height={36}");
            expect(source).toContain("unoptimized");
            expect(source).toContain("aria-busy={true}");
        }
    });
});
