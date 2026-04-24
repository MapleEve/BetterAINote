import { integer, text } from "drizzle-orm/sqlite-core";

export const bool = (name: string) => integer(name, { mode: "boolean" });
export const timestampMs = (name: string) =>
    integer(name, { mode: "timestamp_ms" });
export const jsonText = <T>(name: string) =>
    text(name, { mode: "json" }).$type<T>();
