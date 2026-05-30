import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function RecordingDetailNotFound() {
    return (
        <div className="dashboard-workstation flex min-h-svh items-center justify-center px-4 py-8">
            <section className="glass-surface flex w-full max-w-md flex-col items-center rounded-2xl p-8 text-center">
                <span className="glass-control flex size-12 items-center justify-center rounded-2xl text-primary">
                    <FileQuestion className="size-6" />
                </span>
                <h1 className="mt-5 text-xl font-semibold tracking-tight">
                    找不到这条录音
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    这条录音可能已经被删除，或当前账号没有访问权限。
                </p>
                <Link
                    href="/dashboard"
                    className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                    返回录音列表
                </Link>
            </section>
        </div>
    );
}
