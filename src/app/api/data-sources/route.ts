import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { DataSourcesRequestBody } from "@/lib/data-sources/types";
import {
    buildDataSourcesRouteErrorResponse,
    getDataSourcesStateForUser,
    saveDataSourceForUser,
} from "@/server/modules/data-sources";

// This route owns upstream recording-platform connections only.
// Local service settings such as VoScript and AI rename live under /api/settings/*.
export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const sources = await getDataSourcesStateForUser(session.user.id);
        return NextResponse.json({ sources });
    } catch (error) {
        console.error("Error fetching data source settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch data sources" },
            { status: 500 },
        );
    }
}

export async function PUT(request: Request) {
    try {
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

        await saveDataSourceForUser(session.user.id, body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving data source settings:", error);
        return buildDataSourcesRouteErrorResponse(error);
    }
}
