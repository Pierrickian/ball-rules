import type { UiEntity } from "./uiEntityTypes";

interface UiEntityLayerProps {
  entities: UiEntity[];
}

export function UiEntityLayer({ entities }: UiEntityLayerProps) {
  return (
    <>
      {entities.map((entity) => {
        if (entity.type === "grenade_award_popup") {
          return (
            <div
              key={entity.id}
              style={{
                position: "absolute",
                top: 96,
                right: 20,
                zIndex: 30,
                pointerEvents: "none",
                color: "#7afcff",
                fontFamily: "'Courier New', monospace",
                textShadow: "0 0 12px #7afcff",
              }}
            >
              +{entity.payload.amount} grenade
            </div>
          );
        }

        if (entity.type === "star_popup") {
          return (
            <div
              key={entity.id}
              style={{
                position: "absolute",
                top: 130,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 30,
                pointerEvents: "none",
                color: entity.payload.kind === "earned" ? "#ffd166" : "#ff6b6b",
                fontFamily: "'Courier New', monospace",
                fontWeight: 700,
                letterSpacing: 2,
                textShadow: "0 0 12px currentColor",
              }}
            >
              {entity.payload.label}
            </div>
          );
        }

        return null;
      })}
    </>
  );
}
