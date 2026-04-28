import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    SEARCH_ENTITY_TYPES,
    type SearchEntityType,
    searchLibrary,
} from "@/server/modules/search";

class SearchValidationError extends Error {}

function noStoreJson(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, {
        ...init,
        headers: {
            "Cache-Control": "private, no-store",
            ...(init?.headers ?? {}),
        },
    });
}

function parseLimit(value: string | null) {
    const parsed = Number.parseInt(value ?? "50", 10);
    if (!Number.isFinite(parsed)) {
        return 50;
    }
    return Math.min(Math.max(parsed, 1), 100);
}

function parseEntityTypes(url: URL): SearchEntityType[] | undefined {
    const values = url.searchParams
        .getAll("type")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);

    if (values.length === 0) {
        return undefined;
    }

    const allowed = new Set<string>(SEARCH_ENTITY_TYPES);
    for (const value of values) {
        if (!allowed.has(value)) {
            throw new SearchValidationError(
                `Unsupported search entity type: ${value}`,
            );
        }
    }

    return [...new Set(values)] as SearchEntityType[];
}

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return noStoreJson({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const query = url.searchParams.get("q") ?? "";
        const results = await searchLibrary({
            userId: session.user.id,
            query,
            entityTypes: parseEntityTypes(url),
            limit: parseLimit(url.searchParams.get("limit")),
        });

        return noStoreJson({ results });
    } catch (error) {
        console.error("Error searching library:", error);
        return noStoreJson(
            {
                error:
                    error instanceof SearchValidationError
                        ? error.message
                        : error instanceof Error
                          ? error.message
                          : "Failed to search library",
            },
            { status: error instanceof SearchValidationError ? 400 : 500 },
        );
    }
}
