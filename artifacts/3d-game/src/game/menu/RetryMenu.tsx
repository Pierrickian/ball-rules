import { useI18n } from "../i18n";
import { CLOSE_BTN, MENU_BTN, PANEL, TITLE } from "./menuStyles";

export function RetryMenu({
  reason,
  levelNumber,
  onRetry,
  onSkipLevel,
  onGoToBoss,
  onBack,
}: {
  reason: "timeout" | "ammo" | "manual" | null;
  levelNumber: number;
  onRetry: () => void;
  onSkipLevel: () => void;
  onGoToBoss: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const subtitle = reason === "timeout"
    ? t("retry.timeout")
    : reason === "ammo"
      ? t("retry.ammo")
      : t("retry.manual");

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>{t("retry.title")}</div>
        <div style={{ fontSize: 20, color: "#ff9fca", fontWeight: 900 }}>{subtitle}</div>
      </div>
      <section style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,77,122,0.28)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#ff9fca", textTransform: "uppercase" }}>{t("retry.level")}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#ffe6f0" }}>#{levelNumber}</div>
        </div>
        <button style={MENU_BTN} onClick={onRetry}>{t("retry.retry")}</button>
        <button style={MENU_BTN} onClick={onGoToBoss}>{t("retry.goBoss")}</button>
        <button style={MENU_BTN} onClick={onSkipLevel}>{t("retry.skip")}</button>
      </section>
      <button style={CLOSE_BTN} onClick={onBack}>{t("menu.back")}</button>
    </div>
  );
}
