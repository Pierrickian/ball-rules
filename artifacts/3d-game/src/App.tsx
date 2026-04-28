// ============================================================
// App — Entry point for the Ball Game
//
// Architecture overview:
// - useGameEngine() loads game_config.json, runs the logic loop
// - GameScene renders the 3D Three.js scene (graphics layer)
// - HUD renders the 2D overlay (score, legend, controls)
// - Logic and graphics are fully decoupled.
// ============================================================

import { useGameEngine } from "./engine/useGameEngine";
import { GameScene } from "./scenes/GameScene";
import { HUD } from "./game/HUD";

function App() {
  const { gameState, config, isRunning, pause, resume, reset } = useGameEngine();

  if (!gameState || !config) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020810",
          color: "#1e90ff",
          fontFamily: "monospace",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 32 }}>◉</div>
        <div style={{ fontSize: 14, color: "#4466aa" }}>Chargement du moteur de jeu…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        maxWidth: "100vh",
        margin: "0 auto",
        background: "#020810",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* 3D Scene — graphics layer */}
      <div style={{ position: "absolute", inset: 0 }}>
        <GameScene gameState={gameState} config={config} />
      </div>

      {/* HUD — UI overlay layer */}
      <HUD
        gameState={gameState}
        config={config}
        isRunning={isRunning}
        onPause={pause}
        onResume={resume}
        onReset={reset}
      />
    </div>
  );
}

export default App;
