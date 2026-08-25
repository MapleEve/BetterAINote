import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryRecordingsForUser } from "@/server/modules/recordings";

class QueryValidationError extends Error {}

const SORT_VALUES = ["newest", "oldest", "name"] as const;
const TIMELINE_VALUES = [
    "all",
    "today",
    "yesterday",
    "last7",
    "earlier",
] as const;
const FAVORITE_VALUES = ["all", "transcribed", "tags"] as const;

function noStoreJson(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, {
        ...init,
        headers: {
            "Cache-Control": "private, no-store",
            ...(init?.headers ?? {}),
        },
    });
}

function parseDateParam(value: string | null, field: string) {
    if (!value) {
        return null;
    }

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const parsed = dateOnly
        ? new Date(
              Number(dateOnly[1]),
              Number(dateOnly[2]) - 1,
              Number(dateOnly[3]),
          )
        : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new QueryValidationError(`Invalid ${field}`);
    }

    if (dateOnly) {
        if (
            parsed.getFullYear() !== Number(dateOnly[1]) ||
            parsed.getMonth() !== Number(dateOnly[2]) - 1 ||
            parsed.getDate() !== Number(dateOnly[3])
        ) {
            throw new QueryValidationError(`Invalid ${field}`);
        }
        if (field === "from") {
            parsed.setHours(0, 0, 0, 0);
        } else if (field === "to") {
            parsed.setHours(23, 59, 59, 999);
        }
    }

    return parsed;
}

function parseIntegerParam(
    value: string | null,
    field: string,
    fallback: number,
    maximum?: number,
) {
    if (value === null) {
        return fallback;
    }
    if (!/^\d+$/.test(value)) {
        throw new QueryValidationError(`Invalid ${field}`);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new QueryValidationError(`Invalid ${field}`);
    }
    if (maximum !== undefined && parsed > maximum) {
        throw new QueryValidationError(`Invalid ${field}`);
    }

    return parsed;
}

function parseEnumParam<const T extends readonly string[]>(
    value: string | null,
    field: string,
    allowed: T,
    fallback: T[number],
) {
    if (value === null) {
        return fallback;
    }
    if (!allowed.includes(value)) {
        throw new QueryValidationError(`Invalid ${field}`);
    }

    return value as T[number];
}

function parseBooleanFlag(value: string | null, field: string) {
    if (value === null || value === "0") {
        return false;
    }
    if (value === "1") {
        return true;
    }

    throw new QueryValidationError(`Invalid ${field}`);
}

function parseOptionalStringParam(value: string | null, field: string) {
    if (value === null) return null;
    const normalized = value.trim();
    if (!normalized || normalized.length > 256) {
        throw new QueryValidationError(`Invalid ${field}`);
    }
    return normalized;
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
        const from = parseDateParam(url.searchParams.get("from"), "from");
        const to = parseDateParam(url.searchParams.get("to"), "to");
        if (from && to && from > to) {
            throw new QueryValidationError("Invalid date range");
        }
        const includeTranscript = parseBooleanFlag(
            url.searchParams.get("includeTranscript"),
            "includeTranscript",
        );
        const pageSize = parseIntegerParam(
            url.searchParams.get("pageSize") ?? url.searchParams.get("limit"),
            "pageSize",
            50,
            200,
        );
        const page = parseIntegerParam(url.searchParams.get("page"), "page", 1);
        const favorite = parseEnumParam(
            url.searchParams.get("favorite"),
            "favorite",
            FAVORITE_VALUES,
            "all",
        );
        const timeline = parseEnumParam(
            url.searchParams.get("timeline"),
            "timeline",
            TIMELINE_VALUES,
            "all",
        );
        const sort = parseEnumParam(
            url.searchParams.get("sort"),
            "sort",
            SORT_VALUES,
            "newest",
        );
        const result = await queryRecordingsForUser(session.user.id, {
            anchorRecordingId: parseOptionalStringParam(
                url.searchParams.get("anchorRecordingId"),
                "anchorRecordingId",
            ),
            from,
            to,
            includeTranscript,
            page,
            pageSize,
            query: url.searchParams.get("query"),
            source: url.searchParams.get("source"),
            favorite,
            tagId: url.searchParams.get("tagId"),
            tagName: url.searchParams.get("tagName"),
            untagged: parseBooleanFlag(
                url.searchParams.get("untagged"),
                "untagged",
            ),
            speaker: url.searchParams.get("speaker"),
            timeline,
            sort,
        });

        return noStoreJson(result);
    } catch (error) {
        if (!(error instanceof QueryValidationError)) {
            console.error("Error querying recordings:", error);
        }
        return noStoreJson(
            {
                error:
                    error instanceof QueryValidationError
                        ? error.message
                        : "Failed to query recordings",
            },
            {
                status: error instanceof QueryValidationError ? 400 : 500,
            },
        );
    }
}
