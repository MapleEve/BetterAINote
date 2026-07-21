import { NextResponse } from "next/server";
import "@/db";
import { waitForCoreDatabaseReady } from "@/db/core-ready";
import { auth } from "@/lib/auth";
import type { DataSourcesRequestBody } from "@/lib/data-sources/types";
import {
    buildDataSourcesRouteErrorResponse,
    reconnectDataSourceForUser,
} from "@/server/modules/data-sources";

export async function POST(request: Request) {
    try {
        await waitForCoreDatabaseReady();
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = (await request.json()) as DataSourcesRequestBody;
        await reconnectDataSourceForUser(session.user.id, body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error reconnecting data source:", error);
        return buildDataSourcesRouteErrorResponse(error);
    }
}
