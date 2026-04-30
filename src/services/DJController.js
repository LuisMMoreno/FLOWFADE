import { audioEngine } from './AudioEngine';
import { djEngine } from './DJEngine';

/**
 * Controlador de alto nivel para la lógica de mezcla DJ.
 * Coordina el AudioEngine basándose en datos musicales (beats, frases, energía).
 */
class DJController {
  constructor() {
    this.isDJEnabled = true;
    this.currentTransition = null;
    this.schedulingInterval = null;
  }

  setDJEnabled(enabled) {
    this.isDJEnabled = enabled;
  }

  /**
   * Inicia el monitoreo musical para decidir cuándo transicionar.
   */
  startScheduler(currentSong, onTransitionReady) {
    this.stopScheduler();

    if (!this.isDJEnabled || !currentSong || !currentSong.beatGrid) {
      return;
    }

    this.schedulingInterval = setInterval(() => {
      const snapshot = audioEngine.getPlaybackSnapshot();
      const currentTime = snapshot.currentTime;
      const duration = snapshot.duration;

      // Buscar punto de transición ideal (outro o cerca del final)
      const outroPoint = currentSong.outroPoint || (duration - 15);
      
      if (currentTime >= outroPoint - 10 && !this.currentTransition) {
        // Estamos cerca del final, buscar el próximo límite de frase
        const nextPhraseTime = this.findNextPhraseBoundary(currentSong, currentTime);
        
        // Si falta poco para la frase (menos de 1 segundo), avisar
        if (nextPhraseTime && (nextPhraseTime - currentTime) < 1.0) {
          this.currentTransition = true;
          onTransitionReady(nextPhraseTime);
        }
      }
    }, 200);
  }

  stopScheduler() {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }
    this.currentTransition = null;
  }

  /**
   * Encuentra el tiempo del próximo inicio de frase (cada 16 beats).
   */
  findNextPhraseBoundary(song, currentTime) {
    if (!song.beatGrid || song.beatGrid.length === 0) return null;

    // Buscamos el índice del beat actual
    const beatIndex = song.beatGrid.findIndex(b => b >= currentTime);
    if (beatIndex === -1) return null;

    // Una frase suele ser de 16 o 32 beats.
    // Buscamos el próximo múltiplo de 16 desde el inicio.
    const phraseSize = 16;
    const nextPhraseBeatIndex = Math.ceil(beatIndex / phraseSize) * phraseSize;

    if (nextPhraseBeatIndex < song.beatGrid.length) {
      return song.beatGrid[nextPhraseBeatIndex];
    }

    return song.beatGrid[song.beatGrid.length - 1];
  }

  /**
   * Ejecuta una transición sincronizada entre dos pistas.
   */
  async performSyncTransition(songA, songB, targetTimeA) {
    console.log(`[DJController] Iniciando transición sincronizada a los ${targetTimeA}s`);

    const plan = djEngine.getTransitionPlan(songA, songB);
    
    // Calcular el desfase necesario para que el primer beat de B coincida con targetTimeA
    const startOffsetB = songB.introPoint || (songB.beatGrid ? songB.beatGrid[0] : 0);
    
    // Ajustar playbackRate para sincronizar BPMs si es posible
    const playbackRate = songA.bpm && songB.bpm ? songA.bpm / songB.bpm : 1;
    
    // Limitar el ajuste de pitch a ±8% por calidad musical
    const safeRate = Math.min(1.08, Math.max(0.92, playbackRate));

    // Programar en el AudioEngine
    const now = audioEngine.getPlaybackSnapshot().currentTime;
    const delay = Math.max(0, targetTimeA - now);

    return new Promise((resolve) => {
      setTimeout(async () => {
        const success = await audioEngine.playSync(songB, {
          crossfade: plan.duration,
          offset: startOffsetB,
          playbackRate: safeRate
        });
        resolve(success);
      }, delay * 1000);
    });
  }
}

export const djController = new DJController();
