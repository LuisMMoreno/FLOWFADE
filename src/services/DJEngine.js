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
  }

  setMode(mode) {
    if (this.modes[mode]) {
      this.currentMode = mode;
    }
  }

  /**
   * Selecciona la mejor canción de la biblioteca para seguir a la actual.
   */
  selectNextTrack(currentTrack, library) {
    if (!library || library.length === 0) return null;

    const candidates = library.filter(t => 
      t.id !== currentTrack?.id && 
      !this.history.slice(-5).includes(t.id) &&
      t.analyzed
    );

    if (candidates.length === 0) {
      // Fallback a cualquier canción si no hay analizadas o suficientes
      return library[Math.floor(Math.random() * library.length)];
    }

    const scored = candidates.map(track => ({
      track,
      score: this.calculateMatchScore(currentTrack, track)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Tomar una de las 3 mejores para evitar repetitividad determinista
    const topCount = Math.min(3, scored.length);
    const selected = scored[Math.floor(Math.random() * topCount)].track;

    this.addToHistory(selected.id);
    return selected;
  }

  calculateMatchScore(trackA, trackB) {
    if (!trackA || !trackB) return 0;

    const mode = this.modes[this.currentMode];
    
    // 1. Similitud de BPM (0 a 1)
    // Penalización por diferencia de BPM. Ideal < 5%.
    const bpmDiff = Math.abs(trackA.bpm - trackB.bpm);
    const bpmScore = Math.max(0, 1 - (bpmDiff / (trackA.bpm * 0.1)));

    // 2. Similitud de Energía (0 a 1)
    const energyDiff = Math.abs(trackA.energy - trackB.energy);
    const energyScore = Math.max(0, 1 - (energyDiff / 50));

    // 3. Proximidad al objetivo del modo
    const targetDiff = Math.abs(trackB.energy - mode.targetEnergy);
    const targetScore = Math.max(0, 1 - (targetDiff / 100));

    return (bpmScore * mode.bpmWeight) + (energyScore * mode.energyWeight * 0.7) + (targetScore * 0.3);
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
