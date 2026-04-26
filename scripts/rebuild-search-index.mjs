import { spawn } from "node:child_process";
import { loadLocalEnv } from "./local-env.mjs";

loadLocalEnv();

const child = spawn(
    "bun",
    ["src/server/modules/search/rebuild-cli.ts", ...process.argv.slice(2)],
    {
        stdio: "inherit",
        env: process.env,
    },
);

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exit(code ?? 0);
});
