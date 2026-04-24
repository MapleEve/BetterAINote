export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative min-h-svh overflow-hidden bg-transparent">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-background/10 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_65%)]" />
            <div className="relative z-10">{children}</div>
        </div>
    );
}
