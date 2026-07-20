"use client";

import { Music2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import {
    RouteFallbackChrome,
    RouteFallbackEmptyState,
} from "../../route-chrome";

export default function RecordingError({ reset }: { reset: () => void }) {
    return (
        <RouteFallbackChrome
            current="录音详情加载失败"
            data-panel="route-workspace"
            data-shell="recording-route-error"
            workspaceVariant="single"
        >
            <RouteFallbackEmptyState
                data-empty="true"
                data-panel="recording-route-empty-detail"
                contentPanel={<Empty data-panel="recording-route-empty" />}
                title={
                    <span data-part="recording-route-empty-title">
                        加载失败
                    </span>
                }
                description={
                    <span data-part="recording-route-empty-description">
                        录音详情暂时无法加载，可以重试或返回工作台。
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
