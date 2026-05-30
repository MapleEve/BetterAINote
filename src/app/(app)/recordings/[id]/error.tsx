"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RecordingDetailError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="dashboard-workstation flex min-h-svh items-center justify-center px-4 py-8">
            <section className="glass-surface flex w-full max-w-md flex-col items-center rounded-2xl p-8 text-center">
                <span className="glass-control flex size-12 items-center justify-center rounded-2xl text-destructive">
                    <AlertCircle className="size-6" />
                </span>
                <h1 className="mt-5 text-xl font-semibold tracking-tight">
                    录音详情加载失败
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    请重试；如果仍然失败，回到录音列表重新打开。
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Button type="button" onClick={reset}>
                        重试
                    </Button>
                    <Link
                        href="/dashboard"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-border/70 bg-background/40 px-4 font-medium text-sm transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                    >
                        返回录音列表
                    </Link>
                </div>
            </section>
        </div>
    );
}
