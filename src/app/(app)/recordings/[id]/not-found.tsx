import { Music2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import {
    RouteFallbackChrome,
    RouteFallbackEmptyState,
} from "../../route-chrome";

export default function RecordingNotFound() {
    return (
        <RouteFallbackChrome
            current="录音不存在或已删除"
            data-panel="route-workspace"
            data-shell="recording-route-empty"
            workspaceVariant="single"
        >
            <RouteFallbackEmptyState
                data-empty="true"
                data-panel="recording-route-empty-detail"
                contentPanel={<Empty data-panel="recording-route-empty" />}
                title={
                    <span data-part="recording-route-empty-title">
                        录音不存在
                    </span>
                }
                description={
                    <span data-part="recording-route-empty-description">
                        这条录音不存在或已经被删除，返回工作台后可以继续查看其他录音。
                    </span>
                }
                icon={
                    <span
                        className="contents"
                        data-part="recording-route-empty-icon"
                    >
                        <Music2 aria-hidden="true" focusable="false" />
                    </span>
                }
                actions={
                    <Button asChild variant="default" size="default">
                        <Link href="/dashboard">返回工作台</Link>
                    </Button>
                }
            />
        </RouteFallbackChrome>
    );
}
