import { useEffect, useState } from "react";
import type { UiEntity } from "./uiEntityTypes";

function CartridgeIcon() {
  return (
    <span aria-hidden="true" style={{ display:"inline-flex", gap:2, alignItems:"center", justifyContent:"center" }}>
      {[0, 1, 2].map((idx) => (
        <span key={idx} style={{ width:6, height:18, borderRadius:"2px 2px 4px 4px", background:"linear-gradient(180deg, #ffe8a3 0%, #ffd166 58%, #b7791f 59%, #8a4f16 100%)", border:"1px solid rgba(255,255,255,.38)", boxShadow:"0 0 7px rgba(255,209,102,.45)", display:"inline-block" }} />
      ))}
    </span>
  );
}

function currentImpactValue(entity: Extract<UiEntity, { type: "impact_popup" }>, now: number) {
  const { from, to } = entity.payload;
  const start = Math.round(from);
  const target = Math.max(start, Math.round(to));
  const duration = entity.durationMs ?? 1900;
  const progress = Math.min(1, Math.max(0, (now - entity.createdAt) / duration));
  const steppedProgress = Math.min(1, progress / 0.58);
  return Math.min(target, start + Math.ceil((target - start) * steppedProgress));
}

interface UiEntityLayerProps {
  entities: UiEntity[];
}

export function UiEntityLayer({ entities }: UiEntityLayerProps) {
  const grenadeAwardPopups = entities.filter((entity): entity is Extract<UiEntity, { type: "grenade_award_popup" }> => entity.type === "grenade_award_popup");
  const starPopups = entities.filter((entity): entity is Extract<UiEntity, { type: "star_popup" }> => entity.type === "star_popup");
  const impactPopups = entities.filter((entity): entity is Extract<UiEntity, { type: "impact_popup" }> => entity.type === "impact_popup");
  const [now, setNow] = useState(() => Date.now());
  const ammoWarningPopups = entities.filter((entity): entity is Extract<UiEntity, { type: "ammo_warning_popup" }> => entity.type === "ammo_warning_popup");

  useEffect(() => {
    if (impactPopups.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 38);
    return () => window.clearInterval(timer);
  }, [impactPopups.length]);

  return (
    <>
      {grenadeAwardPopups.map((popup, index) => (
        <div
          key={popup.id}
          style={{ position:"absolute", right:28, bottom:200 + index * 18, zIndex:13, pointerEvents:"none", color:"#ffed9a", fontWeight:900, fontSize:22, textShadow:"0 0 10px #000, 0 0 12px #ff9f1c", animation:"grenade-award-float 0.9s ease-out forwards" }}
        >
          +{popup.payload.amount}
        </div>
      ))}
      {starPopups.map((popup, index) => (
        <div
          key={`title-${popup.id}`}
          style={{ position:"absolute", left:"50%", top:158 + index * 64, transform:"translateX(-50%)", zIndex:13, pointerEvents:"none", width:"96vw", textAlign:"center", fontSize:44, fontWeight:950, letterSpacing:5, color:"rgba(255,255,255,.2)", textShadow:"0 0 22px rgba(122,252,255,.36), 0 0 8px #000", textTransform:"uppercase", animation:`${popup.payload.kind === "reloadLost" ? "reload-star-lost-pop" : popup.payload.kind === "lost" ? "star-popup-lost" : "star-popup-earned"} ${popup.payload.kind === "reloadLost" ? 3.3 : 2.3}s ease-out forwards` }}
        >
          {popup.payload.label}
        </div>
      ))}
      {starPopups.map((popup, index) => {
        const isReloadLost = popup.payload.kind === "reloadLost";
        const isLost = popup.payload.kind === "lost" || isReloadLost;
        return (
          <div
            key={popup.id}
            style={{ position:"absolute", left:"50%", top:210 + index * 64, zIndex:14, pointerEvents:"none", display:"flex", alignItems:"center", gap:12, padding:isReloadLost ? "12px 18px" : "9px 14px", borderRadius:999, border:`2px solid ${isReloadLost ? "rgba(168,85,247,.95)" : isLost ? "rgba(96,165,250,.82)" : "rgba(255,209,102,.82)"}`, background: isReloadLost ? "linear-gradient(135deg, rgba(35,18,80,.96), rgba(12,35,90,.94))" : isLost ? "rgba(15,23,42,.84)" : "rgba(60,40,5,.82)", color: isReloadLost ? "#f3e8ff" : isLost ? "#dbeafe" : "#fff4b8", fontWeight:1000, fontSize:isReloadLost ? 26 : 21, letterSpacing:isReloadLost ? 1.1 : .5, textTransform:isReloadLost ? "uppercase" : undefined, textShadow:isReloadLost ? "0 0 12px #000, 0 0 18px rgba(168,85,247,.95), 0 0 8px rgba(96,165,250,.9)" : "0 0 10px #000", boxShadow: isReloadLost ? "0 0 28px rgba(168,85,247,.65), 0 0 48px rgba(37,99,235,.38)" : isLost ? "0 0 20px rgba(96,165,250,.32)" : "0 0 24px rgba(255,209,102,.42)", animation:`${isReloadLost ? "reload-star-lost-pop" : isLost ? "star-popup-lost" : "star-popup-earned"} ${isReloadLost ? 3.3 : 2.3}s ease-out forwards` }}
          >
            <span style={{ fontSize:isReloadLost ? 40 : 31, color: isReloadLost ? "#a78bfa" : isLost ? "#60a5fa" : "#ffd166", filter: isLost ? "drop-shadow(0 0 12px rgba(96,165,250,.85))" : "drop-shadow(0 0 9px rgba(255,209,102,.88))" }}>★</span>
            <span>{popup.payload.label}</span>
          </div>
        );
      })}
      {impactPopups.map((popup, index) => {
        const current = currentImpactValue(popup, now);
        return (
          <div
            key={popup.id}
            style={{ position:"absolute", left:18, top:190 + index * 74, zIndex:14, pointerEvents:"none", minWidth:168, padding:"10px 12px", borderRadius:18, border:"1px solid rgba(122,252,255,.58)", background:"rgba(3,10,24,.9)", color:"#eaffff", fontWeight:950, textShadow:"0 0 8px #000", boxShadow:"0 0 24px rgba(122,252,255,.24)", animation:"impact-popup-bump 1.9s ease-out forwards" }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ display:"inline-grid", placeItems:"center", width:42, height:42, borderRadius:"50%", background:"rgba(122,252,255,.12)", animation:"impact-icon-bump .55s ease-in-out 3" }}>
                {popup.payload.kind === "ammo" ? <CartridgeIcon /> : popup.payload.kind === "balls" ? <span style={{ display:"flex", gap:3 }}>{[0,1,2].map((i) => <span key={i} style={{ width:12, height:12, borderRadius:"50%", background:["#7afcff", "#ffd166", "#c084fc"][i], boxShadow:"0 0 8px currentColor" }} />)}</span> : <span style={{ position:"relative", width:26, height:26, borderRadius:"50%", background:"radial-gradient(circle at 30% 25%, #ffe8a3, #ff4d7a)", boxShadow:"0 0 14px rgba(255,77,122,.75)" }} />}
              </span>
              <span style={{ flex:1 }}>
                <div style={{ fontSize:12, color:"#9db8d6", letterSpacing:1.5, textTransform:"uppercase" }}>{popup.payload.label}</div>
                <div style={{ fontSize:22, color:"#fff", lineHeight:1.05 }}>{popup.payload.kind === "balls" ? `+${current}` : `${current}`}</div>
              </span>
            </div>
          </div>
        );
      })}
      {ammoWarningPopups.map((popup, index) => (
        <div
          key={popup.id}
          style={{ position:"absolute", left:20, bottom:204 + index * 34, zIndex:14, pointerEvents:"none", padding:"8px 12px", borderRadius:999, border:"1px solid rgba(122,252,255,.55)", background:"rgba(3,10,24,.86)", color:"#eaffff", fontWeight:950, textShadow:"0 0 8px #000", animation:"grenade-award-float 1.2s ease-out forwards" }}
        >
          {popup.payload.label ?? "Plus de munitions"}
        </div>
      ))}
    </>
  );
}
