import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { DataSourcesRequestBody } from "@/lib/data-sources/types";
import {
    buildDataSourcesRouteErrorResponse,
    disconnectDataSourceForUser,
} from "@/server/modules/data-sources";

export async function POST(request: Request) {
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

        const body = (await request.json()) as Pick<
            DataSourcesRequestBody,
            "provider"
        >;
        await disconnectDataSourceForUser(session.user.id, body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error disconnecting data source:", error);
        return buildDataSourcesRouteErrorResponse(error);
    }
}
