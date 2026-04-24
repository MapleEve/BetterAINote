import { spawn } from "node:child_process";
import { loadLocalEnv } from "./local-env.mjs";

loadLocalEnv();

const env = {
    ...process.env,
    PORT: process.env.PORT || "3001",
    WATCHPACK_POLLING: process.env.WATCHPACK_POLLING || "true",
    CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING || "1",
};

const children = new Map();
let shuttingDown = false;

function killChild(name, signal = "SIGTERM") {
    const child = children.get(name);
    if (!child || child.exitCode !== null) {
        return;
    }

    try {
        if (child.pid) {
            process.kill(-child.pid, signal);
        } else {
            child.kill(signal);
        }
    } catch {
        child.kill(signal);
    }
}

function shutdown(signal = "SIGTERM") {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;

    for (const name of children.keys()) {
        killChild(name, signal);
    }

    setTimeout(() => {
        for (const name of children.keys()) {
            killChild(name, "SIGKILL");
        }
    }, 2000).unref();
}

function startProcess(name, command, args) {
    const child = spawn(command, args, {
        stdio: "inherit",
        env,
        detached: true,
    });

    children.set(name, child);

    child.on("exit", (code, signal) => {
        children.delete(name);

        if (!shuttingDown) {
            shutdown(signal || "SIGTERM");
            process.exitCode = code ?? (signal ? 1 : 0);
        } else if (children.size === 0) {
            process.exit(code ?? 0);
        }
    });

    child.on("error", (error) => {
        console.error(`[dev] Failed to start ${name}:`, error);
        process.exit(1);
    });
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
        shutdown(signal);
    });
}

startProcess("app", "next", ["dev", "--webpack"]);
startProcess("worker", "bun", ["src/worker/index.ts"]);
