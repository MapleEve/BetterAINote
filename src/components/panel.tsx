import { cn } from "@/lib/utils";

export function Panel({
    className,
    variant: _variant,
    ...props
}: React.ComponentProps<"section"> & { variant?: "default" | "glass" }) {
    return <section className={cn("panel", className)} {...props} />;
}
