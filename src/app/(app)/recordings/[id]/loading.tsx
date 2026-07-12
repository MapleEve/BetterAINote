import {
    RouteFallbackChrome,
    RouteFallbackDetailLoadingSkeleton,
} from "../../route-chrome";

export default function RecordingLoading() {
    return (
        <RouteFallbackChrome
            dataSotShell="recording-route-loading"
            current="录音加载中"
            aria-busy={true}
            workspaceVariant="single"
        >
            <RouteFallbackDetailLoadingSkeleton data-sot-panel="recording-route-loading-detail" />
        </RouteFallbackChrome>
    );
}
