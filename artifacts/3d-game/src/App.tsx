// ============================================================
// App — Entry point for the Ball Game
//
// Layers:
// 1. useGameEngine() — logic loop (config-driven, no Three.js)
// 2. GameScene       — 3D Three.js rendering (no game logic)
// 3. HUD             — 2D overlay (count + controls)
// 4. Menu            — Game menu (rules + ball carousel)
// ============================================================

import { useState } from "react";
import { useGameEngine } from "./engine/useGameEngine";
import { GameScene } from "./scenes/GameScene";
import { HUD } from "./game/HUD";
import { Menu } from "./game/Menu";

function App() {
  const { gameState, config, isRunning, pause, resume, reset } = useGameEngine();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleMenuOpen = () => {
    pause();
    setMenuOpen(true);
  };

  const handleMenuClose = () => {
    setMenuOpen(false);
    resume();
  };

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
        <div style={{ fontSize: 32, animation: "spin 1s linear infinite" }}>◉</div>
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
      }}
    >
      {/* 3D Scene */}
      <div style={{ position: "absolute", inset: 0 }}>
        <GameScene gameState={gameState} config={config} />
      </div>

      {/* HUD */}
      <HUD
        gameState={gameState}
        config={config}
        isRunning={isRunning}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onMenu={handleMenuOpen}
      />

      {/* Menu overlay */}
      {menuOpen && <Menu config={config} onClose={handleMenuClose} />}
    </div>
  );
}

export default App;
