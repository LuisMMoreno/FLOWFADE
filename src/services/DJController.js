import { audioEngine } from './AudioEngine';
import { djEngine } from './DJEngine';

/**
 * Controlador de alto nivel para mezcla DJ.
 * 
 * Coordina el AudioEngine con decisiones musicales:
 * - Detecta cuándo transicionar basándose en estructura musical
 * - Sincroniza por límites de frase (no por "faltan X segundos")
 * - Ajusta playbackRate para beat matching
 * - Calcula el offset de B para que entre en un punto musical correcto
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
   * 
   * En vez de "faltan 10s → mezclar", busca:
   * 1. ¿Estamos cerca del outro de A?
   * 2. ¿Cuál es el próximo límite de frase?
   * 3. ¿Cabe una transición completa antes del final?
   */
  startScheduler(currentSong, nextSong, onTransitionReady) {
    this.stopScheduler();

    if (!this.isDJEnabled || !currentSong || !nextSong) {
      return;
    }

    const plan = djEngine.getTransitionPlan(currentSong, nextSong);

    this.schedulingInterval = setInterval(() => {
      const snapshot = audioEngine.getPlaybackSnapshot();
      const currentTime = snapshot.currentTime;
      const duration = snapshot.duration;

      if (!duration || duration <= 0) return;

      // Punto de transición: basado en outroPoint del análisis o calculado
      const transitionDuration = plan.duration || 8;
      const safetyMargin = 2; // margen para que no se corte
      const triggerPoint = currentSong.outroPoint
        ? Math.min(currentSong.outroPoint, duration - transitionDuration - safetyMargin)
        : (duration - transitionDuration - safetyMargin);

      if (currentTime >= triggerPoint && !this.currentTransition) {
        if (currentSong.beatGrid && currentSong.beatGrid.length > 0) {
          // Buscar el próximo límite de frase para entrar limpio
          const nextPhraseTime = this.findNextPhraseBoundary(currentSong, currentTime);

          if (nextPhraseTime) {
            const timeToPhrase = nextPhraseTime - currentTime;

            // Si estamos a menos de 2 segundos de la frase, ¡es el momento!
            if (timeToPhrase < 2.0) {
              this.currentTransition = true;
              console.log(`[DJController] 🎯 Transición en límite de frase: ${nextPhraseTime.toFixed(2)}s`);
              onTransitionReady(nextPhraseTime);
            }
            // Si la frase está lejos pero ya estamos en zona de peligro, ir ya
            else if (currentTime >= duration - transitionDuration - 1) {
              this.currentTransition = true;
              console.log(`[DJController] ⚡ Transición de emergencia en ${currentTime.toFixed(2)}s`);
              onTransitionReady(currentTime + 0.5);
            }
          } else {
            // No encontramos frase, transicionar pronto
            this.currentTransition = true;
            onTransitionReady(currentTime + 1);
          }
        } else {
          // Sin beatGrid: transicionar con 1s de gracia
          this.currentTransition = true;
          onTransitionReady(currentTime + 1);
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
   * Encuentra el tiempo del próximo inicio de frase.
   * 
   * Una frase musical estándar = 16 beats (4 compases de 4/4).
   * En EDM/Pop, los cambios de sección ocurren cada 32 beats.
   * Usamos 16 como unidad base y preferimos 32 si está disponible.
   */
  findNextPhraseBoundary(song, currentTime) {
    if (!song.beatGrid || song.beatGrid.length === 0) return null;

    // Buscar el beat actual
    const beatIndex = song.beatGrid.findIndex(b => b >= currentTime);
    if (beatIndex === -1) return null;

    // Probar primero con frases de 32 beats (cambios de sección)
    const phraseSizes = [32, 16, 8]; // Del más musical al mínimo

    for (const phraseSize of phraseSizes) {
      const nextPhraseBeatIndex = Math.ceil((beatIndex + 1) / phraseSize) * phraseSize;

      if (nextPhraseBeatIndex < song.beatGrid.length) {
        const phraseTime = song.beatGrid[nextPhraseBeatIndex];
        const timeToPhrase = phraseTime - currentTime;

        // Solo usar esta frase si no está demasiado lejos (máx 20s)
        if (timeToPhrase > 0 && timeToPhrase < 20) {
          return phraseTime;
        }
      }
    }

    // Fallback: próximo beat disponible
    return song.beatGrid[beatIndex];
  }

  /**
   * Ejecuta una transición sincronizada entre dos pistas.
   * 
   * Proceso:
   * 1. Obtener plan de transición del DJEngine
   * 2. Calcular playbackRate para sincronizar BPMs
   * 3. Calcular offset de B (intro point o primer beat)
   * 4. Esperar al momento exacto y lanzar la mezcla
   */
  async performSyncTransition(songA, songB, targetTimeA) {
    console.log(`[DJController] 🎛️ Transición sincronizada a los ${targetTimeA.toFixed(2)}s`);

    const plan = djEngine.getTransitionPlan(songA, songB);

    // Calcular dónde debe empezar B
    // Si B tiene introPoint (silencio inicial), saltarlo
    // Si B tiene beatGrid, empezar desde el primer beat
    let startOffsetB = 0;
    if (songB.introPoint && songB.introPoint > 0.5) {
      startOffsetB = songB.introPoint;
    } else if (songB.beatGrid && songB.beatGrid.length > 0) {
      // Empezar 1 beat antes del primer beat para que entre natural
      startOffsetB = Math.max(0, songB.beatGrid[0] - 0.1);
    }

    // PlaybackRate para beat sync
    let playbackRate = 1.0;
    if (plan.syncBeats && songA.bpm && songB.bpm) {
      playbackRate = songA.bpm / songB.bpm;
      // Limitar a ±8% para no distorsionar la música
      playbackRate = Math.min(1.08, Math.max(0.92, playbackRate));
      console.log(`[DJController] BeatSync: ${songA.bpm} → ${songB.bpm} BPM (rate: ${playbackRate.toFixed(4)})`);
    }

    // Esperar al momento exacto
    const now = audioEngine.getPlaybackSnapshot().currentTime;
    const delay = Math.max(0, targetTimeA - now);

    return new Promise((resolve) => {
      setTimeout(async () => {
        const success = await audioEngine.playSync(songB, {
          crossfade: plan.duration,
          offset: startOffsetB,
          playbackRate
        });
        resolve(success);
      }, delay * 1000);
    });
  }
}

export const djController = new DJController();
