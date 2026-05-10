export function RetryOverlay({
  reason,
  levelNumber,
  onRetry,
  onSkipLevel,
  onGoToBoss,
}: {
  reason: "timeout" | "ammo" | "manual";
  levelNumber: number;
  onRetry: () => void;
  onSkipLevel: () => void;
  onGoToBoss: () => void;
}) {
  const subtitle = reason === "manual"
    ? "Go to the boss, retry or skip to the next level."
    : reason === "timeout"
      ? "Temps écoulé"
      : "Munitions épuisées";

  const actionButton = (label: string, onClick: () => void, primary = false) => (
    <button
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      style={{
        border: `1px solid ${primary ? "#1e90ff" : "rgba(255,255,255,0.28)"}`,
        background: primary ? "linear-gradient(180deg, #66c2ff, #1e90ff)" : "rgba(0,0,0,0.42)",
        color: primary ? "#061122" : "#ffe6f0",
        borderRadius: 999,
        padding: "12px 18px",
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: 1,
        cursor: "pointer",
        boxShadow: primary ? "0 0 18px rgba(30,144,255,0.48)" : "none",
        flex: "1 1 150px",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      onClick={(event) => { if (event.target === event.currentTarget) onRetry(); }}
      style={{
        position: "absolute",
        inset: 0,
        border: "none",
        background: "rgba(10,0,18,0.72)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        fontFamily: "'Courier New', monospace",
        color: "#ffe6f0",
      }}
    >
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(92vw, 430px)", maxHeight: "calc(100vh - 24px)", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12, cursor: "default", paddingRight: 4 }}>
        <div style={{ textAlign: "center", fontSize: 72, fontWeight: 900, color: "#ff4d7a", letterSpacing: 8, textShadow: "0 0 16px #ff4d7a" }}>RETRY</div>
        <div style={{ textAlign: "center", fontSize: 18 }}>{subtitle} — cliquez le fond pour rejouer</div>

        <section style={{ background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,77,122,0.34)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#ff9fca", textTransform: "uppercase" }}>level</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>#{levelNumber}</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {actionButton("Retry", onRetry, true)}
            {actionButton("Go to the boss", onGoToBoss)}
            {actionButton("Skip level", onSkipLevel)}
          </div>
        </section>
      </div>
    </div>
  );
}
