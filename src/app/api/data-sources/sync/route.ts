import { NextResponse } from "next/server";
import "@/db";
import { waitForCoreDatabaseReady } from "@/db/core-ready";
import { auth } from "@/lib/auth";
import { AppError, createErrorResponse, ErrorCode } from "@/lib/errors";
import {
    getDataSourceSyncStatusForUser,
    runManualDataSourceSyncForUser,
} from "@/server/modules/data-sources";
import { createDataSourceSyncPublicErrorResponse } from "@/server/modules/data-sources/data-source-sync-public-errors";

function createSyncErrorResponse(error: unknown) {
    if (error instanceof AppError) {
        return createErrorResponse(error, ErrorCode.DATA_SOURCE_SYNC_ERROR);
    }

    return createDataSourceSyncPublicErrorResponse(error);
}

export async function GET(request: Request) {
    try {
        await waitForCoreDatabaseReady();
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            const error = new AppError(
                ErrorCode.UNAUTHORIZED,
                "You must be logged in to view sync status",
                401,
            );
            const response = createErrorResponse(error);
            return NextResponse.json(response.body, {
                status: response.status,
            });
        }

        return NextResponse.json(
            await getDataSourceSyncStatusForUser(session.user.id),
        );
    } catch (error) {
        console.error("Error fetching data source sync status:", error);
        const response = createSyncErrorResponse(error);
        return NextResponse.json(response.body, { status: response.status });
    }
}

export async function POST(request: Request) {
    try {
        await waitForCoreDatabaseReady();
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            const error = new AppError(
                ErrorCode.UNAUTHORIZED,
                "You must be logged in to sync recordings",
                401,
            );
            const response = createErrorResponse(error);
            return NextResponse.json(response.body, {
                status: response.status,
            });
        }

        return NextResponse.json(
            await runManualDataSourceSyncForUser(session.user.id),
        );
    } catch (error) {
        console.error("Error syncing data sources:", error);
        const response = createSyncErrorResponse(error);
        return NextResponse.json(response.body, { status: response.status });
    }
}
