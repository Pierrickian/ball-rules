import { useEffect, useState } from "react";
import { APK_DOWNLOAD_URL, OVERLAY, DOWNLOAD_APK_BTN } from "./menuStyles";
import type { MenuProps, MenuView } from "./menuTypes";
import { MainMenu } from "./MainMenu";
import { EvolutionMenu } from "./EvolutionMenu";
import { RulesMenu } from "./RulesMenu";
import { BallsMenu } from "./BallsMenu";
import { TerrainMenu } from "./TerrainMenu";
import { PlayerColorsMenu } from "./PlayerColorsMenu";
import { HowToAskMenu } from "./HowToAskMenu";
import { ReleaseNotesMenu } from "./ReleaseNotesMenu";
import { LevelsMenu } from "./LevelsMenu";
import { BossMenu } from "./BossMenu";
import { EffectsMenu } from "./EffectsMenu";
import { DifficultyMenu } from "./DifficultyMenu";
import { RuntimeSettingsMenu } from "./RuntimeSettingsMenu";
import { RetryMenu } from "./RetryMenu";
import { LanguageMenu } from "./LanguageMenu";
import { useI18n } from "../i18n";

function DownloadApkButton() {
  const { t } = useI18n();
  return (
    <a href={APK_DOWNLOAD_URL} target="_blank" rel="noreferrer" style={DOWNLOAD_APK_BTN}>
      {t("menu.downloadApk")}
    </a>
  );
}

export function Menu({
  config,
  onClose,
  onArenaChange,
  onTerrainDistributionPlay,
  onLevelSelect,
  onLevelWeightsChange,
  onPlayBossRush,
  onDifficultyChange,
  retryReason,
  onRetry,
  onSkipLevel,
  onGoToBoss,
  difficulty,
  hpAdjustment,
  onHpAdjustmentChange,
  evolutionRequest,
  evolutionInitialText,
  currentLevelNumber,
  currentLevelIndex,
  ballEffect,
  grenadeEffect,
  onBallEffectChange,
  onGrenadeEffectChange,
  debugExplosionTexture,
  onDebugExplosionTextureChange,
  language,
  onLanguageChange,
  runtimeModifiers,
  onRuntimeModifiersChange,
  onRuntimeModifiersReset,
}: MenuProps) {
  const [view, setView] = useState<MenuView>(evolutionInitialText ? "evolution" : "main");

  useEffect(() => {
    if (evolutionInitialText) {
      setView("evolution");
    }
  }, [evolutionInitialText]);

  return (
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <DownloadApkButton />
      {view === "main" && (
        <MainMenu
          onSettings={() => setView("settings")}
          onRetry={() => setView("retry")}
          onLanguage={() => setView("language")}
          onEvolution={() => { setView("evolution"); }}
          onRules={() => setView("rules")}
          onLevels={() => setView("levels")}
          onBoss={() => setView("boss")}
          onBalls={() => setView("balls")}
          onTerrain={() => setView("terrain")}
          onPlayerColors={() => setView("player_colors")}
          onHowToAsk={() => setView("how_to_ask")}
          onReleaseNotes={() => setView("release_notes")}
          onEffects={() => setView("effects")}
          onDifficulty={() => setView("difficulty")}
          onClose={onClose}
        />
      )}
      {view === "settings"       && <RuntimeSettingsMenu runtimeModifiers={runtimeModifiers} onRuntimeModifiersChange={onRuntimeModifiersChange} onReset={onRuntimeModifiersReset} onBack={() => setView("main")} />}
      {view === "retry"          && <RetryMenu reason={retryReason} levelNumber={currentLevelNumber} onRetry={onRetry} onSkipLevel={onSkipLevel} onGoToBoss={onGoToBoss} onBack={() => setView("main")} />}
      {view === "language"       && <LanguageMenu language={language} onLanguageChange={onLanguageChange} onBack={() => setView("main")} />}
      {view === "evolution"      && <EvolutionMenu evolutionRequest={evolutionRequest} initialText={evolutionInitialText} currentLevelNumber={currentLevelNumber} difficulty={difficulty} hpAdjustment={hpAdjustment} onBack={() => setView("main")} />}
      {view === "rules"          && <RulesMenu      config={config} onBack={() => setView("main")} />}
      {view === "levels"         && <LevelsMenu config={config} currentLevelIndex={currentLevelIndex} onLevelSelect={onLevelSelect} onLevelWeightsChange={onLevelWeightsChange} onTerrainDistributionPlay={onTerrainDistributionPlay} onClose={onClose} onBack={() => setView("main")} />}
      {view === "boss"           && <BossMenu config={config} onPlayBossRush={onPlayBossRush} onClose={onClose} onBack={() => setView("main")} />}
      {view === "balls"          && <BallsMenu  config={config} onBack={() => setView("main")} />}
      {view === "terrain"        && <TerrainMenu    config={config} onArenaChange={onArenaChange} onBack={() => setView("main")} />}
      {view === "player_colors"  && <PlayerColorsMenu  config={config} onTerrainDistributionPlay={onTerrainDistributionPlay} onClose={onClose} onBack={() => setView("main")} />}
      {view === "how_to_ask"     && <HowToAskMenu onBack={() => setView("main")} />}
      {view === "release_notes"  && <ReleaseNotesMenu config={config} onBack={() => setView("main")} />}
      {view === "effects"        && <EffectsMenu ballEffect={ballEffect} grenadeEffect={grenadeEffect} debugExplosionTexture={debugExplosionTexture} onDebugExplosionTextureChange={onDebugExplosionTextureChange} onBallEffectChange={onBallEffectChange} onGrenadeEffectChange={onGrenadeEffectChange} onBack={() => setView("main")} />}
      {view === "difficulty"     && <DifficultyMenu config={config} difficulty={difficulty} hpAdjustment={hpAdjustment} onChange={onDifficultyChange} onHpAdjustmentChange={onHpAdjustmentChange} onBack={() => setView("main")} onClose={onClose} />}
    </div>
  );
}
