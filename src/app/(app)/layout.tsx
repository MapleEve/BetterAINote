export default function AppLayout({ children }: { children: React.ReactNode }) {
    return <main className="flex min-h-svh flex-col">{children}</main>;
}
