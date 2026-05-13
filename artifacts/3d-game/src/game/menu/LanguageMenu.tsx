import { useI18n, type Language } from "../i18n";
import { CLOSE_BTN, MENU_BTN, PANEL, TITLE } from "./menuStyles";

export function LanguageMenu({ language, onLanguageChange, onBack }: { language: Language; onLanguageChange: (language: Language) => void; onBack: () => void }) {
  const { t } = useI18n();
  const languageButton = (value: Language) => (
    <button
      style={{ ...MENU_BTN, justifyContent: "center", background: language === value ? "#1e90ff" : MENU_BTN.background, color: language === value ? "#061122" : MENU_BTN.color, fontWeight: 900 }}
      onClick={() => onLanguageChange(value)}
    >
      {t(`lang.name.${value}`)}
    </button>
  );

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>{t("menu.language")}</div>
        <div style={{ fontSize: 20, color: "#7afcff", fontWeight: 900 }}>{t("menu.language.subtitle")}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {languageButton("fr")}
        {languageButton("en")}
      </div>
      <button style={CLOSE_BTN} onClick={onBack}>{t("menu.back")}</button>
    </div>
  );
}
