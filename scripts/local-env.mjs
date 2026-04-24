import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadLocalEnv(cwd = process.cwd(), env = process.env) {
    const protectedKeys = new Set(Object.keys(env));
    const envFiles = [".env.test.local", ".env.local", ".env.development.local"];

    for (const relativeFile of envFiles) {
        const filePath = path.resolve(cwd, relativeFile);
        if (!existsSync(filePath)) {
            continue;
        }

        const contents = readFileSync(filePath, "utf8");
        for (const rawLine of contents.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) {
                continue;
            }

            const normalizedLine = line.startsWith("export ")
                ? line.slice("export ".length)
                : line;

            const separatorIndex = normalizedLine.indexOf("=");
            if (separatorIndex <= 0) {
                continue;
            }

            const key = normalizedLine.slice(0, separatorIndex).trim();
            if (!key || protectedKeys.has(key)) {
                continue;
            }

            let value = normalizedLine.slice(separatorIndex + 1).trim();

            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }

            env[key] = value;
        }
    }

    return env;
}
