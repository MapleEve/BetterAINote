export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="dashboard-workstation relative min-h-svh overflow-hidden">
            <div className="relative z-10">{children}</div>
        </div>
    );
}
