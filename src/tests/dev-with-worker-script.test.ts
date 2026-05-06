import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createDevSupervisor } from "../../scripts/dev-with-worker.mjs";

function createMockChild() {
    const child = new EventEmitter() as EventEmitter & {
        exitCode: number | null;
        kill: ReturnType<typeof vi.fn>;
    };
    child.exitCode = null;
    child.kill = vi.fn();
    return child;
}

function createMockProcess() {
    return {
        exit: vi.fn(() => undefined as never),
        exitCode: 0,
    } as unknown as NodeJS.Process;
}

function createMockEnv() {
    return {
        ...process.env,
        PORT: "3001",
        WATCHPACK_POLLING: "true",
        CHOKIDAR_USEPOLLING: "1",
        NODE_ENV: "test" as const,
    };
}

describe("dev-with-worker supervisor", () => {
    it("starts web and worker without detaching them from the parent process", () => {
        const spawnImpl = vi
            .fn()
            .mockReturnValueOnce(createMockChild())
            .mockReturnValueOnce(createMockChild());
        const supervisor = createDevSupervisor({
            env: createMockEnv(),
            spawnImpl,
            processImpl: createMockProcess(),
        });

        supervisor.start();

        expect(spawnImpl).toHaveBeenCalledWith(
            "next",
            ["dev", "--webpack"],
            expect.objectContaining({ detached: false }),
        );
        expect(spawnImpl).toHaveBeenCalledWith(
            "bun",
            ["src/worker/index.ts"],
            expect.objectContaining({ detached: false }),
        );
        expect(supervisor.childCount).toBe(2);
    });

    it("kills all child processes during shutdown", () => {
        const app = createMockChild();
        const worker = createMockChild();
        const supervisor = createDevSupervisor({
            env: createMockEnv(),
            spawnImpl: vi
                .fn()
                .mockReturnValueOnce(app)
                .mockReturnValueOnce(worker),
            processImpl: createMockProcess(),
            setTimeoutImpl: vi.fn(() => ({
                unref: vi.fn(),
            })) as unknown as typeof setTimeout,
        });

        supervisor.start();
        supervisor.shutdown("SIGINT");

        expect(app.kill).toHaveBeenCalledWith("SIGINT");
        expect(worker.kill).toHaveBeenCalledWith("SIGINT");
    });
});
