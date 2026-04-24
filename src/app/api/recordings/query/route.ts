import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryRecordingsForUser } from "@/server/modules/recordings";

class QueryValidationError extends Error {}

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

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new QueryValidationError(`Invalid ${field}`);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (field === "from") {
            parsed.setUTCHours(0, 0, 0, 0);
        } else if (field === "to") {
            parsed.setUTCHours(23, 59, 59, 999);
        }
    }

    return parsed;
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
        const includeTranscript =
            url.searchParams.get("includeTranscript") === "1";
        const limit = Math.min(
            Math.max(
                Number.parseInt(url.searchParams.get("limit") ?? "50", 10) ||
                    50,
                1,
            ),
            200,
        );

        const recordings = await queryRecordingsForUser(session.user.id, {
            from,
            to,
            includeTranscript,
            limit,
        });

        return noStoreJson({
            recordings,
        });
    } catch (error) {
        console.error("Error querying recordings:", error);
        return noStoreJson(
            {
                error:
                    error instanceof QueryValidationError
                        ? error.message
                        : error instanceof Error
                          ? error.message
                          : "Failed to query recordings",
            },
            {
                status: error instanceof QueryValidationError ? 400 : 500,
            },
        );
    }
}
