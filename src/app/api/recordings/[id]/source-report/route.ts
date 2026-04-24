import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { sourceArtifacts } from "@/db/schema/transcripts";
import { auth } from "@/lib/auth";
import { findOwnedRecording } from "@/server/modules/recordings";

function noStoreJson(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, {
        ...init,
        headers: {
            "Cache-Control": "private, no-store",
            ...(init?.headers ?? {}),
        },
    });
}

type SourceArtifact = typeof sourceArtifacts.$inferSelect;

function toPublicTimestamp(value: unknown) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "number" || typeof value === "string") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    return null;
}

function getPublicLanguage(payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }

    const language = (payload as Record<string, unknown>).language;
    return typeof language === "string" && language.length <= 64
        ? language
        : null;
}

function buildPublicDetail(
    artifact: SourceArtifact | null,
    fallbackProvider: string,
    sections: string[],
) {
    if (!artifact) {
        return null;
    }

    const createdAt = toPublicTimestamp(artifact.createdAt);
    const updatedAt = toPublicTimestamp(artifact.updatedAt);
    const language = getPublicLanguage(artifact.payload);

    return {
        provider: artifact.provider || fallbackProvider,
        status: "available",
        sections,
        ...(language ? { language } : {}),
        ...(createdAt ? { createdAt } : {}),
        ...(updatedAt ? { updatedAt } : {}),
    };
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return noStoreJson({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const recording = await findOwnedRecording(session.user.id, id, {
            id: recordings.id,
            sourceProvider: recordings.sourceProvider,
            filename: recordings.filename,
        });

        if (!recording) {
            return noStoreJson(
                { error: "Recording not found" },
                { status: 404 },
            );
        }

        const artifacts = await db
            .select()
            .from(sourceArtifacts)
            .where(eq(sourceArtifacts.recordingId, recording.id));

        const transcriptArtifact =
            artifacts.find(
                (artifact) => artifact.artifactType === "official-transcript",
            ) ?? null;
        const summaryArtifact =
            artifacts.find(
                (artifact) => artifact.artifactType === "official-summary",
            ) ?? null;
        const detailArtifact =
            artifacts.find(
                (artifact) => artifact.artifactType === "official-detail",
            ) ?? null;
        const transcriptSegments = Array.isArray(
            (transcriptArtifact?.payload as { segments?: unknown } | null)
                ?.segments,
        )
            ? (((transcriptArtifact?.payload as { segments?: unknown[] } | null)
                  ?.segments as unknown[]) ?? [])
            : [];
        const transcriptReady = Boolean(
            transcriptArtifact?.textContent?.trim() ||
                transcriptSegments.length > 0,
        );
        const summaryReady = Boolean(summaryArtifact?.markdownContent?.trim());
        const availableSections = [
            ...(transcriptReady ? ["transcript"] : []),
            ...(summaryReady ? ["summary"] : []),
            ...(detailArtifact ? ["detail"] : []),
        ];

        return noStoreJson({
            sourceProvider: recording.sourceProvider,
            filename: recording.filename,
            source: {
                provider: recording.sourceProvider,
                name: recording.filename,
            },
            availableSections,
            transcriptReady,
            summaryReady,
            transcript: transcriptArtifact
                ? {
                      text: transcriptArtifact.textContent ?? "",
                      segmentCount: transcriptSegments.length,
                  }
                : null,
            summaryMarkdown: summaryArtifact?.markdownContent ?? null,
            detail: buildPublicDetail(
                detailArtifact,
                recording.sourceProvider,
                availableSections,
            ),
        });
    } catch (error) {
        console.error("Error loading source report:", error);
        return noStoreJson(
            { error: "Failed to load source report" },
            { status: 500 },
        );
    }
}
