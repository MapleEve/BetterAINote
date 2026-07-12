"use client";

import { Music2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    RouteFallbackChrome,
    RouteFallbackEmptyState,
} from "../../route-chrome";

export default function RecordingError({ reset }: { reset: () => void }) {
    return (
        <RouteFallbackChrome
            dataSotShell="recording-route-error"
            current="录音详情加载失败"
            workspaceVariant="single"
        >
            <RouteFallbackEmptyState
                title="加载失败"
                description="录音详情暂时无法加载，可以重试或返回工作台。"
                icon={<Music2 aria-hidden="true" focusable="false" />}
                actions={
                    <>
                        <Button
                            variant="default"
                            size="default"
                            type="button"
                            onClick={reset}
                        >
                            重试
                        </Button>
                        <Button asChild variant="ghost" size="default">
                            <Link href="/dashboard">返回工作台</Link>
                        </Button>
                    </>
                }
            />
        </RouteFallbackChrome>
    );
}
