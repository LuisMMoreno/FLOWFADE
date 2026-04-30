/**
 * Motor de decisión DJ.
 * Selecciona la mejor pista siguiente y planea la transición.
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
    this.currentPhase = 'warmup'; // warmup, groove, peak, cooldown
  }

  setMode(mode) {
    if (this.modes[mode]) {
      this.currentMode = mode;
    }
  }

  /**
   * Actualiza la fase de la sesión basada en el tiempo transcurrido.
   */
  updateSessionPhase() {
    const elapsedMinutes = (Date.now() - this.sessionStartTime) / (1000 * 60);
    
    if (elapsedMinutes < 10) this.currentPhase = 'warmup';
    else if (elapsedMinutes < 30) this.currentPhase = 'groove';
    else if (elapsedMinutes < 60) this.currentPhase = 'peak';
    else this.currentPhase = 'cooldown';
  }

  /**
   * Selecciona la mejor canción de la biblioteca para seguir a la actual.
   */
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

    // Selección semi-aleatoria entre los mejores candidatos
    const topCount = Math.min(3, scored.length);
    const selected = scored[Math.floor(Math.random() * topCount)].track;

    this.addToHistory(selected.id);
    return selected;
  }

  calculateMatchScore(trackA, trackB) {
    if (!trackA || !trackB) return 0;

    const mode = this.modes[this.currentMode];
    
    // 1. Similitud de BPM (Prioridad alta para mezclas fluidas)
    const bpmDiff = Math.abs(trackA.bpm - trackB.bpm);
    const bpmScore = Math.max(0, 1 - (bpmDiff / (trackA.bpm * 0.12)));

    // 2. Energía Adaptativa según la fase de la sesión
    let phaseTargetEnergy = mode.targetEnergy;
    if (this.currentPhase === 'warmup') phaseTargetEnergy = Math.min(mode.targetEnergy, 40);
    if (this.currentPhase === 'peak') phaseTargetEnergy = Math.max(mode.targetEnergy, 70);
    if (this.currentPhase === 'cooldown') phaseTargetEnergy = Math.max(0, mode.targetEnergy - 20);

    const energyDiff = Math.abs(trackB.energy - phaseTargetEnergy);
    const energyScore = Math.max(0, 1 - (energyDiff / 50));

    // 3. Coherencia de transición (evitar saltos de energía bruscos respecto a la anterior)
    const flowDiff = Math.abs(trackA.energy - trackB.energy);
    const flowScore = Math.max(0, 1 - (flowDiff / 40));

    return (bpmScore * mode.bpmWeight) + (energyScore * mode.energyWeight * 0.5) + (flowScore * 0.5);
  }

  addToHistory(id) {
    this.history.push(id);
    if (this.history.length > 50) this.history.shift();
  }

  /**
   * Calcula los parámetros de transición óptimos.
   */
  getTransitionPlan(trackA, trackB) {
    if (!trackA || !trackB) return { duration: 5, type: 'crossfade' };

    const energyAvg = (trackA.energy + trackB.energy) / 2;
    
    // Transiciones más largas para energía baja (chill)
    // Transiciones más cortas y agresivas para energía alta
    let duration = 8;
    if (energyAvg > 70) duration = 4;
    else if (energyAvg > 40) duration = 6;

    return {
      duration,
      type: 'equal-power',
      syncBeats: Math.abs(trackA.bpm - trackB.bpm) < (trackA.bpm * 0.08)
    };
  }
}

export const djEngine = new DJEngine();
