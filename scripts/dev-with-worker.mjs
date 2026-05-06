import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "./local-env.mjs";

export function buildDevEnv(baseEnv = process.env) {
    return {
        ...baseEnv,
        PORT: baseEnv.PORT || "3001",
        WATCHPACK_POLLING: baseEnv.WATCHPACK_POLLING || "true",
        CHOKIDAR_USEPOLLING: baseEnv.CHOKIDAR_USEPOLLING || "1",
    };
}

export function createDevSupervisor({
    env = buildDevEnv(),
    spawnImpl = spawn,
    processImpl = process,
    consoleImpl = console,
    setTimeoutImpl = setTimeout,
} = {}) {
    const children = new Map();
    let shuttingDown = false;
    let shutdownExitCode = 0;

    function killChild(name, signal = "SIGTERM") {
        const child = children.get(name);
        if (!child || child.exitCode !== null) {
            return;
        }

        try {
            child.kill(signal);
        } catch {
            // The child may have exited between the liveness check and kill().
        }
    }

    function killChildren(signal = "SIGTERM") {
        for (const name of Array.from(children.keys())) {
            killChild(name, signal);
        }
    }

    function shutdown(signal = "SIGTERM") {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;

        killChildren(signal);

        const forceKillTimer = setTimeoutImpl(() => {
            killChildren("SIGKILL");
        }, 2000);
        forceKillTimer.unref?.();
    }

    function startProcess(name, command, args) {
        const child = spawnImpl(command, args, {
            stdio: "inherit",
            env,
            detached: false,
        });

        children.set(name, child);

        child.on("exit", (code, signal) => {
            children.delete(name);

            if (!shuttingDown) {
                shutdownExitCode = code ?? (signal ? 1 : 0);
                shutdown(signal || "SIGTERM");
                processImpl.exitCode = shutdownExitCode;
            } else if (children.size === 0) {
                processImpl.exit(shutdownExitCode);
            }
        });

        child.on("error", (error) => {
            consoleImpl.error(`[dev] Failed to start ${name}:`, error);
            processImpl.exit(1);
        });
    }

    function start() {
        startProcess("app", "next", ["dev", "--webpack"]);
        startProcess("worker", "bun", ["src/worker/index.ts"]);
    }

    return {
        start,
        shutdown,
        killChildren,
        get childCount() {
            return children.size;
        },
    };
}

function registerSignalHandlers(supervisor, processImpl = process) {
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
        processImpl.on(signal, () => {
            supervisor.shutdown(signal);
        });
    }

    processImpl.on("exit", () => {
        supervisor.killChildren("SIGTERM");
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    loadLocalEnv();
    const supervisor = createDevSupervisor({ env: buildDevEnv() });
    registerSignalHandlers(supervisor);
    supervisor.start();
}
