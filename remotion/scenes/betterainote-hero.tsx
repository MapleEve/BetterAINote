import {
    AbsoluteFill,
    Easing,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
} from "remotion";

const sources = [
    { name: "钉钉 / A1", x: 142, y: 184, color: "#4fb3ff" },
    { name: "TicNote", x: 162, y: 400, color: "#a8d95f" },
    { name: "Plaud", x: 1030, y: 178, color: "#ffb24f" },
    { name: "飞书妙记", x: 1024, y: 402, color: "#7d8cff" },
    { name: "讯飞听见", x: 1042, y: 536, color: "#ff6f91" },
];

const lanes = [
    "录音归档",
    "私有转写",
    "说话人审阅",
    "AI 标题",
    "统一搜索",
];

function clampProgress(frame: number, start: number, end: number) {
    return interpolate(frame, [start, end], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
}

function FlowLine({
    color,
    delay,
    from,
    to,
}: {
    color: string;
    delay: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
}) {
    const frame = useCurrentFrame();
    const progress = clampProgress(frame, delay, delay + 46);
    const pulse = clampProgress((frame + delay) % 80, 4, 36);
    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress;

    return (
        <svg
            style={{
                position: "absolute",
                inset: 0,
                overflow: "visible",
            }}
            viewBox="0 0 1280 640"
        >
            <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={color}
                strokeOpacity={0.22}
                strokeWidth={2}
            />
            <circle cx={x} cy={y} r={6 + pulse * 4} fill={color} opacity={0.26} />
            <circle cx={x} cy={y} r={4} fill={color} />
        </svg>
    );
}

function SourceNode({
    color,
    delay,
    name,
    x,
    y,
}: {
    color: string;
    delay: number;
    name: string;
    x: number;
    y: number;
}) {
    const frame = useCurrentFrame();
    const scale = 0.92 + spring({ frame: frame - delay, fps: 30, config: { damping: 14 } }) * 0.08;

    return (
        <div
            style={{
                position: "absolute",
                left: x - 84,
                top: y - 32,
                width: 168,
                height: 64,
                borderRadius: 8,
                transform: `scale(${scale})`,
                transformOrigin: "center",
                background: "rgba(18, 24, 29, 0.88)",
                border: `1px solid ${color}66`,
                boxShadow: `0 0 28px ${color}22`,
                color: "#eef3f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: 24,
                fontWeight: 700,
            }}
        >
            <span
                style={{
                    position: "absolute",
                    left: 16,
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: color,
                    boxShadow: `0 0 16px ${color}`,
                }}
            />
            {name}
        </div>
    );
}

function WorkspacePanel() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const lift = spring({ frame: frame - 12, fps, config: { damping: 18 } });
    const highlight = interpolate(Math.sin(frame / 12), [-1, 1], [0.28, 0.48]);

    return (
        <div
            style={{
                position: "absolute",
                left: 390,
                top: 148 - lift * 12,
                width: 500,
                height: 314,
                borderRadius: 12,
                background: "linear-gradient(145deg, rgba(40,48,56,0.94), rgba(15,19,23,0.96))",
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: `0 30px 90px rgba(0,0,0,0.48), 0 0 44px rgba(235,155,49,${highlight})`,
                overflow: "hidden",
                fontFamily: "Inter, Arial, sans-serif",
            }}
        >
            <div
                style={{
                    height: 64,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 28px",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    color: "#f6f2eb",
                    fontWeight: 800,
                    fontSize: 28,
                }}
            >
                <span style={{ color: "#f0a23a", marginRight: 12 }}>B</span>
                BetterAINote 私有工作台
            </div>
            <div style={{ padding: "24px 28px" }}>
                {lanes.map((lane, index) => {
                    const progress = clampProgress(frame, 18 + index * 8, 54 + index * 8);
                    return (
                        <div
                            key={lane}
                            style={{
                                height: 34,
                                marginBottom: 12,
                                borderRadius: 6,
                                background: "rgba(255,255,255,0.07)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                overflow: "hidden",
                                position: "relative",
                            }}
                        >
                            <div
                                style={{
                                    width: `${Math.round(progress * 100)}%`,
                                    height: "100%",
                                    background:
                                        "linear-gradient(90deg, rgba(240,162,58,0.34), rgba(83,193,173,0.36))",
                                }}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "0 14px",
                                    color: "#e9eef2",
                                    fontSize: 20,
                                    fontWeight: 650,
                                }}
                            >
                                <span>{lane}</span>
                                <span style={{ color: "#aeb8bf", fontSize: 17 }}>本地优先</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const BetterAINoteHero = () => {
    const frame = useCurrentFrame();
    const glow = interpolate(Math.sin(frame / 18), [-1, 1], [0.15, 0.34]);

    return (
        <AbsoluteFill
            style={{
                background:
                    "radial-gradient(circle at 50% 45%, rgba(240,162,58,0.16), transparent 38%), linear-gradient(135deg, #0b1114 0%, #151b1f 46%, #070a0c 100%)",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.18,
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                    backgroundSize: "48px 48px",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    left: 94,
                    top: 54,
                    color: "#f6f2eb",
                    fontFamily: "Inter, Arial, sans-serif",
                    fontWeight: 850,
                    fontSize: 40,
                    letterSpacing: 0,
                }}
            >
                多平台语音资料私有化集合，统一管理
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 98,
                    top: 108,
                    color: "#aeb8bf",
                    fontFamily: "Inter, Arial, sans-serif",
                    fontSize: 22,
                }}
            >
                Recording sources → local workspace → transcript, speaker, tags, search
            </div>
            {sources.map((source, index) => (
                <FlowLine
                    key={source.name}
                    color={source.color}
                    delay={index * 7}
                    from={{ x: source.x, y: source.y }}
                    to={{ x: 640, y: 282 }}
                />
            ))}
            {sources.map((source, index) => (
                <SourceNode key={source.name} {...source} delay={index * 5} />
            ))}
            <WorkspacePanel />
            <div
                style={{
                    position: "absolute",
                    left: 470,
                    top: 498,
                    width: 340,
                    height: 44,
                    borderRadius: 8,
                    border: "1px solid rgba(83,193,173,0.45)",
                    background: `rgba(83,193,173,${glow})`,
                    color: "#eafff8",
                    fontFamily: "Inter, Arial, sans-serif",
                    fontSize: 22,
                    fontWeight: 750,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 26px rgba(83,193,173,0.25)",
                }}
            >
                私有部署 · SQLite · Bun · Worker
            </div>
        </AbsoluteFill>
    );
};
