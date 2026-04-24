import { spawn } from "node:child_process";
import { loadLocalEnv } from "./local-env.mjs";

const [, , command, ...args] = process.argv;

if (!command) {
    console.error("Usage: node scripts/run-with-local-env.mjs <command> [...args]");
    process.exit(1);
}

loadLocalEnv();

const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});
