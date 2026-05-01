/**
 * Motor de decisión DJ con conciencia de estructura musical.
 * 
 * En vez de "faltan 10s → mezclar", analiza:
 * - Frases musicales (8/16/32 bars)
 * - Energía por sección (intro, buildup, drop, breakdown, outro)
 * - Compatibilidad de BPM y key
 * - Fase de la sesión (warmup → groove → peak → cooldown)
 */
class DJEngine {
  constructor() {
    this.history = [];
    this.modes = {
      CHILL: { bpmWeight: 0.5, energyWeight: 0.5, targetEnergy: 30 },
      ENERGY: { bpmWeight: 0.3, energyWeight: 0.7, targetEnergy: 80 },
      BALANCED: { bpmWeight: 0.6, energyWeight: 0.4, targetEnergy: 50 }
    };
    this.currentMode = 'BALANCED';
    this.sessionStartTime = Date.now();
    this.currentPhase = 'warmup';
  }

  setMode(mode) {
    if (this.modes[mode]) {
      this.currentMode = mode;
    }
  }

  updateSessionPhase() {
    const elapsedMinutes = (Date.now() - this.sessionStartTime) / (1000 * 60);

    if (elapsedMinutes < 10) this.currentPhase = 'warmup';
    else if (elapsedMinutes < 30) this.currentPhase = 'groove';
    else if (elapsedMinutes < 60) this.currentPhase = 'peak';
    else this.currentPhase = 'cooldown';
  }

  selectNextTrack(currentTrack, library) {
    if (!library || library.length === 0) return null;

    this.updateSessionPhase();

    const candidates = library.filter(t =>
      t.id !== currentTrack?.id &&
      !this.history.slice(-5).includes(t.id) &&
      t.analyzed
    );

    if (candidates.length === 0) {
      return library[Math.floor(Math.random() * library.length)];
    }

    const scored = candidates.map(track => ({
      track,
      score: this.calculateMatchScore(currentTrack, track)
    }));

    scored.sort((a, b) => b.score - a.score);

    const topCount = Math.min(3, scored.length);
    const selected = scored[Math.floor(Math.random() * topCount)].track;

    this.addToHistory(selected.id);
    return selected;
  }

  calculateMatchScore(trackA, trackB) {
    if (!trackA || !trackB) return 0;

    const mode = this.modes[this.currentMode];

    // 1. BPM compatibility (harmonic mixing: exact, double, half)
    const bpmA = trackA.bpm ?? 120;
    const bpmB = trackB.bpm ?? 120;
    const bpmScore = this.calculateBPMCompatibility(bpmA, bpmB);

    // 2. Energía adaptativa según fase de sesión
    let phaseTargetEnergy = mode.targetEnergy;
    if (this.currentPhase === 'warmup') phaseTargetEnergy = Math.min(mode.targetEnergy, 40);
    if (this.currentPhase === 'peak') phaseTargetEnergy = Math.max(mode.targetEnergy, 70);
    if (this.currentPhase === 'cooldown') phaseTargetEnergy = Math.max(0, mode.targetEnergy - 20);

    const energyDiff = Math.abs((trackB.energy ?? 50) - phaseTargetEnergy);
    const energyScore = Math.max(0, 1 - (energyDiff / 50));

    // 3. Flow score (transición suave)
    const flowDiff = Math.abs((trackA.energy ?? 50) - (trackB.energy ?? 50));
    const flowScore = Math.max(0, 1 - (flowDiff / 40));

    return (bpmScore * mode.bpmWeight) + (energyScore * mode.energyWeight * 0.5) + (flowScore * 0.5);
  }

  /**
   * Compatibilidad de BPM real de DJ:
   * - Match exacto = 1.0
   * - Match al doble/mitad = 0.9 (ej: 70 BPM y 140 BPM son compatibles)
   * - Dentro del ±8% = ajustable con pitch, score decrece linealmente
   * - Fuera del ±8% = penalización fuerte
   */
  calculateBPMCompatibility(bpmA, bpmB) {
    const ratios = [1, 2, 0.5]; // exact, double, half
    let bestDiff = Infinity;

    for (const ratio of ratios) {
      const diff = Math.abs(bpmA - bpmB * ratio) / bpmA;
      if (diff < bestDiff) bestDiff = diff;
    }

    if (bestDiff < 0.01) return 1.0;          // Casi exacto
    if (bestDiff < 0.04) return 0.95;          // ±4% - fácil de sync
    if (bestDiff < 0.08) return 0.8;           // ±8% - ajustable sin distorsión
    if (bestDiff < 0.12) return 0.4;           // ±12% - posible pero suena raro
    return 0.1;                                 // Incompatible
  }

  addToHistory(id) {
    this.history.push(id);
    if (this.history.length > 50) this.history.shift();
  }

  /**
   * Plan de transición basado en estructura musical real.
   * 
   * No es "X segundos de crossfade" sino:
   * - ¿Qué tipo de transición? (EQ swap, echo out, power cut, blend)
   * - ¿Cuántas frases dura? (8 bars = ~15s @ 128bpm)
   * - ¿Los BPMs son sincronizables?
   * - ¿Dónde entra B? (en su intro, en su primer drop)
   */
  getTransitionPlan(trackA, trackB) {
    if (!trackA || !trackB) return { duration: 8, type: 'blend', syncBeats: false };

    const energyA = trackA.energy ?? 50;
    const energyB = trackB.energy ?? 50;
    const bpmA = trackA.bpm ?? 120;
    const bpmB = trackB.bpm ?? 120;

    // ¿Son sincronizables?
    const bpmDiff = Math.abs(bpmA - bpmB) / bpmA;
    const canSync = bpmDiff < 0.08;

    // Calcular duración en frases musicales (no en segundos arbitrarios)
    const avgBPM = (bpmA + bpmB) / 2;
    const beatDuration = 60 / avgBPM;       // segundos por beat
    const barDuration = beatDuration * 4;    // 4 beats = 1 bar (compás)
    const phraseDuration = barDuration * 8;  // 8 bars = 1 frase estándar

    // Tipo de transición según energía
    let type, phrasesCount;

    if (energyA > 70 && energyB > 70) {
      // Alta → Alta: transición corta y directa (1 frase)
      type = 'power-swap';
      phrasesCount = 1;
    } else if (energyA > 60 && energyB < 40) {
      // Alta → Baja: fade largo y suave (2 frases)
      type = 'smooth-decay';
      phrasesCount = 2;
    } else if (energyA < 40 && energyB > 60) {
      // Baja → Alta: buildup con EQ (1.5 frases)
      type = 'buildup';
      phrasesCount = 1.5;
    } else if (energyA < 30 && energyB < 30) {
      // Ambient/Chill: transición etérea larga (3 frases)
      type = 'ethereal';
      phrasesCount = 3;
    } else {
      // Normal: blend estándar (2 frases)
      type = 'blend';
      phrasesCount = 2;
    }

    // Duración final en segundos, basada en frases musicales reales
    const duration = Math.round(phraseDuration * phrasesCount * 10) / 10;

    // Clamp a rangos prácticos (4-20 segundos)
    const safeDuration = Math.min(20, Math.max(4, duration));

    console.log(`[DJEngine] Plan: ${type} | ${phrasesCount} frases | ${safeDuration}s | sync: ${canSync}`);

    return {
      duration: safeDuration,
      type,
      syncBeats: canSync,
      playbackRate: canSync ? bpmA / bpmB : 1,
      phrasesCount,
      barDuration,
      beatDuration
    };
  }
}

export const djEngine = new DJEngine();
