import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError, createErrorResponse, ErrorCode } from "@/lib/errors";
import {
    getDataSourceSyncStatusForUser,
    runManualDataSourceSyncForUser,
} from "@/server/modules/data-sources";

export async function GET(request: Request) {
    try {
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
        const response = createErrorResponse(
            error,
            ErrorCode.DATA_SOURCE_SYNC_ERROR,
        );
        return NextResponse.json(response.body, { status: response.status });
    }
}

export async function POST(request: Request) {
    try {
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
        const response = createErrorResponse(
            error,
            ErrorCode.DATA_SOURCE_SYNC_ERROR,
        );
        return NextResponse.json(response.body, { status: response.status });
    }
}
