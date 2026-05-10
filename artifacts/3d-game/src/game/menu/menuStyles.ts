import type { CSSProperties } from "react";

export const APK_DOWNLOAD_URL = "https://github.com/Pierrickian/ball-rules/releases/latest/download/ball-rules.apk";

// ---- Shared styles ----
export const OVERLAY: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,5,18,0.88)",
  backdropFilter: "blur(10px)",
  fontFamily: "'Courier New', monospace",
};

export const PANEL: CSSProperties = {
  background: "rgba(4,12,35,0.97)",
  border: "1px solid rgba(30,144,255,0.35)",
  borderRadius: 16,
  padding: "26px 22px",
  width: "min(92vw, 380px)",
  maxHeight: "88vh",
  overflowY: "auto",
  color: "#c8deff",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

export const TITLE: CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 3,
  color: "#334",
  marginBottom: 2,
};

export const CLOSE_BTN: CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(30,144,255,0.3)",
  color: "#668",
  borderRadius: 8,
  padding: "6px 14px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
  alignSelf: "center",
  marginTop: 4,
};


export const DOWNLOAD_APK_BTN: CSSProperties = {
  position: "fixed",
  top: 14,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 101,
  border: "1px solid rgba(102,255,187,0.55)",
  background: "rgba(0,60,42,0.88)",
  color: "#c8ffe7",
  borderRadius: 999,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 900,
  fontFamily: "inherit",
  textDecoration: "none",
  boxShadow: "0 0 18px rgba(102,255,187,0.24)",
};

export const MENU_BTN: CSSProperties = {
  background: "rgba(12,28,72,0.8)",
  border: "1px solid rgba(30,144,255,0.3)",
  color: "#aac8f0",
  borderRadius: 10,
  padding: "14px 20px",
  cursor: "pointer",
  fontSize: 14,
  fontFamily: "inherit",
  textAlign: "left",
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
};
