import { Music2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    RouteFallbackChrome,
    RouteFallbackEmptyState,
} from "../../route-chrome";

export default function RecordingNotFound() {
    return (
        <RouteFallbackChrome
            dataSotShell="recording-route-empty"
            current="录音不存在或已删除"
            workspaceVariant="single"
        >
            <RouteFallbackEmptyState
                title="录音不存在"
                description="这条录音不存在或已经被删除，返回工作台后可以继续查看其他录音。"
                icon={<Music2 aria-hidden="true" focusable="false" />}
                actions={
                    <Button asChild variant="default" size="default">
                        <Link href="/dashboard">返回工作台</Link>
                    </Button>
                }
            />
        </RouteFallbackChrome>
    );
}
