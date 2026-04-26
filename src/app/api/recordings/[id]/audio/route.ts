import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getRecordingAudioForUser,
    RecordingAudioError,
} from "@/server/modules/recordings";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
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

        const { id } = await params;
        const { audioBuffer, contentType } = await getRecordingAudioForUser(
            session.user.id,
            id,
        );
        const fileSize = audioBuffer.length;

        // Parse Range header for seeking support
        const rangeHeader = request.headers.get("range");

        if (rangeHeader) {
            // Parse range header (e.g., "bytes=0-1023" or "bytes=1024-")
            const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);

            if (rangeMatch) {
                const start = parseInt(rangeMatch[1], 10);
                const end = rangeMatch[2]
                    ? parseInt(rangeMatch[2], 10)
                    : fileSize - 1;

                // Validate range values
                if (
                    start < 0 ||
                    start >= fileSize ||
                    end < 0 ||
                    end >= fileSize ||
                    start > end
                ) {
                    // Return 416 Range Not Satisfiable
                    return new NextResponse(null, {
                        status: 416,
                        headers: {
                            "Content-Range": `bytes */${fileSize}`,
                        },
                    });
                }

                const chunkSize = end - start + 1;

                // Extract the requested chunk
                const chunk = audioBuffer.slice(start, end + 1);

                // Return 206 Partial Content
                return new NextResponse(new Uint8Array(chunk), {
                    status: 206,
                    headers: {
                        "Content-Type": contentType,
                        "Content-Length": chunkSize.toString(),
                        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                        "Accept-Ranges": "bytes",
                        "Cache-Control": "public, max-age=31536000, immutable",
                    },
                });
            }
        }

        // No range requested - return full file
        return new NextResponse(new Uint8Array(audioBuffer), {
            headers: {
                "Content-Type": contentType,
                "Content-Length": fileSize.toString(),
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        if (error instanceof RecordingAudioError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error streaming audio:", error);
        return NextResponse.json(
            { error: "Failed to stream audio" },
            { status: 500 },
        );
    }
}
