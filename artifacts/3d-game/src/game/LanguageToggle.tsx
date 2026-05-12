import { useI18n } from "./i18n";

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useI18n();
  const next = language === "fr" ? "en" : "fr";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={t("lang.switchTo", { language: t(`lang.name.${next}`) })}
      aria-label={t("lang.switchTo", { language: t(`lang.name.${next}`) })}
      style={{
        position: "absolute",
        top: 150,
        right: 12,
        width: 42,
        height: 42,
        zIndex: 95,
        pointerEvents: "all",
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.45)",
        background: language === "fr"
          ? "linear-gradient(90deg, #244aa5 0 33%, #f8f8f8 33% 66%, #e33b3b 66% 100%)"
          : "linear-gradient(135deg, #173b86 0 46%, #fff 46% 54%, #c92b3a 54% 100%)",
        color: language === "fr" ? "#071122" : "#fff",
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.5,
        textShadow: language === "fr" ? "0 1px 2px rgba(255,255,255,0.85)" : "0 1px 3px rgba(0,0,0,0.85)",
        boxShadow: "0 0 12px rgba(0,0,0,0.38)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
      }}
    >
      {t(`lang.current.${next}`)}
    </button>
  );
}
