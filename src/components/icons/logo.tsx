type IconProps = React.HTMLAttributes<SVGElement>;

export const Logo = ({ className, ...props }: IconProps) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            className={className}
            aria-label="BetterAINote Logo"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M12 2.25L4.75 21h3.06l1.73-4.44h4.92L16.2 21h3.05L12 2.25Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <circle
                cx="12"
                cy="12.55"
                r="4.15"
                fill="var(--primary)"
                stroke="color-mix(in srgb, var(--primary), white 22%)"
                strokeWidth="0.45"
            />
            <path
                d="M10.12 9.6h2.42c1.44 0 2.28.72 2.28 1.84 0 .82-.42 1.39-1.16 1.62.95.16 1.56.89 1.56 1.92 0 1.36-1.01 2.18-2.74 2.18h-2.36V9.6Zm2.07 3.03c.76 0 1.22-.35 1.22-.94s-.46-.91-1.22-.91h-.74v1.85h.74Zm.18 3.33c.89 0 1.4-.39 1.4-1.07 0-.66-.51-1.03-1.4-1.03h-.92v2.1h.92Z"
                fill="var(--primary-foreground)"
            />
        </svg>
    );
};
