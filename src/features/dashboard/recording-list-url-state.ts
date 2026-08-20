export type RecordingListUrlState = {
    detailOpen: boolean;
    page: number;
    recordingId: string | null;
};

function positiveInteger(value: string | null) {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function readRecordingListUrlState(search: string) {
    const params = new URLSearchParams(search);
    const recordingId = params.get("recording")?.trim() || null;
    return {
        detailOpen: recordingId !== null,
        page: positiveInteger(params.get("page")),
        recordingId,
    } satisfies RecordingListUrlState;
}

export function recordingListUrl({
    currentUrl,
    detailOpen,
    page,
    recordingId,
}: RecordingListUrlState & { currentUrl: string }) {
    const url = new URL(currentUrl, "http://localhost");

    if (page > 1) url.searchParams.set("page", String(Math.floor(page)));
    else url.searchParams.delete("page");

    if (detailOpen && recordingId) {
        url.searchParams.set("recording", recordingId);
    } else {
        url.searchParams.delete("recording");
    }

    return `${url.pathname}${url.search}${url.hash}`;
}

export function isRecordingListUrlCurrent(currentUrl: string, nextUrl: string) {
    const current = new URL(currentUrl, "http://localhost");
    return `${current.pathname}${current.search}${current.hash}` === nextUrl;
}
