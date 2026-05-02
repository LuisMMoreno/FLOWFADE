import { AudioStorageService } from './AudioStorageService';

const EPSILON_VOLUME = 0.001;
const PROGRESS_EVENT = 'flowfade:playback-progress';
const FADE_TICK_MS = 20; // 50fps para EQ suave

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// --- Psychoacoustic Math ---

// Smoothstep sigmoid — reemplaza progreso lineal
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Curva S más agresiva para transiciones dramáticas
const smootherstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// Equal-power crossfade (ganancia constante percibida)
const equalPowerGain = (t) => ({
  gainA: Math.cos(t * Math.PI * 0.5),
  gainB: Math.sin(t * Math.PI * 0.5)
});

const lerp = (a, b, t) => (1 - t) * a + t * b;

// --- DJ Phase System (Asymmetric) ---

const DJ_PHASES = {
  INTRO: "intro",
  BLEND: "blend",
  TRANSFER: "transfer",
  OUTRO: "outro"
};

/**
 * Mezcla DJ real con curvas no-lineales y fases asimétricas.
 * TRANSFER no es simétrico: B sube más rápido de lo que A baja.
 * Esto evita el sonido "artificial" de un crossfade perfecto.
 */
const computeDJMix = (rawT) => {
  // Aplicar smoothstep al progreso global — no lineal
  const t = smoothstep(0, 1, rawT);

  let powerA, powerB, phase;
  // Curvas de EQ por banda (0 = cut total, 1 = pass total)
  let eqA = { low: 1, mid: 1, high: 1 };
  let eqB = { low: 0, mid: 0, high: 0 };

  if (t < 0.20) {
    // INTRO: B entra solo con highs suaves, sin bass
    const p = smootherstep(0, 1, t / 0.20);
    powerA = 1.0;
    powerB = lerp(0.0, 0.08, p);
    phase = DJ_PHASES.INTRO;

    eqA.low = 1.0;
    eqA.mid = 1.0;
    eqA.high = 1.0;
    // B: solo highs suaves, sin lows ni mids
    eqB.low = 0.0;
    eqB.mid = lerp(0.0, 0.15, p);
    eqB.high = lerp(0.0, 0.5, p);

  } else if (t < 0.55) {
    // BLEND: las dos conviven — lows se intercambian
    const p = smoothstep(0, 1, (t - 0.20) / 0.35);
    const ep = equalPowerGain(p);
    powerA = lerp(1.0, 0.55, p);
    powerB = lerp(0.08, 0.55, p);
    phase = DJ_PHASES.BLEND;

    // EQ cruzado: A baja lows mientras B sube lows
    eqA.low = lerp(1.0, 0.3, smootherstep(0, 1, p));
    eqA.mid = lerp(1.0, 0.7, p);
    eqA.high = lerp(1.0, 0.6, p);

    eqB.low = lerp(0.0, 0.7, smootherstep(0, 1, p));
    eqB.mid = lerp(0.15, 0.8, p);
    eqB.high = lerp(0.5, 0.9, p);

  } else if (t < 0.82) {
    // TRANSFER (ASIMÉTRICO): B sube rápido, A baja lento
    const p = smoothstep(0, 1, (t - 0.55) / 0.27);

    // Asimetría: B usa curva más agresiva que A
    const pB = smootherstep(0, 1, p); // B sube rápido
    const pA = smoothstep(0, 1, p * 0.85); // A baja más lento

    powerA = lerp(0.55, 0.08, pA);
    powerB = lerp(0.55, 1.0, pB);
    phase = DJ_PHASES.TRANSFER;

    // A: lows ya casi muertos
    eqA.low = lerp(0.3, 0.0, pA);
    eqA.mid = lerp(0.7, 0.2, pA);
    eqA.high = lerp(0.6, 0.15, pA);

    // B: toma control total
    eqB.low = lerp(0.7, 1.0, pB);
    eqB.mid = lerp(0.8, 1.0, pB);
    eqB.high = lerp(0.9, 1.0, pB);

  } else {
    // OUTRO: A desaparece (solo residuo de highs)
    const p = smootherstep(0, 1, (t - 0.82) / 0.18);
    powerA = lerp(0.08, 0.0, p);
    powerB = 1.0;
    phase = DJ_PHASES.OUTRO;

    eqA.low = 0.0;
    eqA.mid = lerp(0.2, 0.0, p);
    eqA.high = lerp(0.15, 0.0, p);
    eqB.low = 1.0;
    eqB.mid = 1.0;
    eqB.high = 1.0;
  }

  // Convertir power a amplitude gain (raíz cuadrada = equal power)
  const gainA = Math.sqrt(Math.max(0, powerA));
  const gainB = Math.sqrt(Math.max(0, powerB));

  return { gainA, gainB, phase, eqA, eqB };
};

// --- 3-Band EQ Node Chain ---

/**
 * Crea una cadena de 3 filtros BiquadFilter (low/mid/high)
 * que permiten controlar cada banda independientemente.
 * 
 * Topología: source → lowShelf → peaking(mid) → highShelf → output
 */
function createEQChain(audioContext) {
  const low = audioContext.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 320;   // Frecuencia de corte bass
  low.gain.value = 0;

  const mid = audioContext.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1000;  // Centro de medios
  mid.Q.value = 0.5;           // Q ancho para cubrir banda media
  mid.gain.value = 0;

  const high = audioContext.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 3200; // Frecuencia de corte highs
  high.gain.value = 0;

  // Conectar en cadena
  low.connect(mid);
  mid.connect(high);

  return { low, mid, high, input: low, output: high };
}

/**
 * Convierte un valor de ganancia lineal (0-1) a dB para BiquadFilter.
 * 0 = -40dB (prácticamente mudo), 1 = 0dB (sin cambio)
 */
function linearToEQGain(linear) {
  if (linear <= 0.01) return -40;
  if (linear >= 0.99) return 0;
  // Curva logarítmica para percepción natural
  return 20 * Math.log10(linear);
}


// =============== AUDIO ENGINE ===============

class AudioEngine {
  constructor() {
    this.audioElements = [];
    this.objectUrls = [null, null];
    this.slotVolumes = [0, 0];
    this.currentIndex = -1;
    this.crossfadeDuration = 12;
    this.isPlaying = false;
    this.currentSongId = null;
    this.masterVolume = 1;
    this.isInitialized = false;

    this.loadRequestId = 0;
    this.activePlaybackId = 0;
    this.pausedSlots = [];
    this.fadeInterval = null;
    this.almostEndedTimeout = null;
    this.onEndedCallback = null;
    this.onAlmostEndedCallback = null;

    // Web Audio API graph
    this.audioContext = null;
    this.analyserNode = null;
    this.sourceNodes = [null, null];
    this.gainNodes = [null, null];
    this.eqChains = [null, null];
    this.isAnalyserActive = false;
    this.isWebAudioConnected = false;
  }

  createAudioElement(index) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = false;
    audio.playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.volume = EPSILON_VOLUME;

    const emitProgress = () => {
      if (index !== this.currentIndex) return;
      window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, {
        detail: this.getPlaybackSnapshot()
      }));
    };

    audio.addEventListener('timeupdate', emitProgress);
    audio.addEventListener('loadedmetadata', emitProgress);
    audio.addEventListener('play', emitProgress);
    audio.addEventListener('pause', emitProgress);
    audio.addEventListener('seeking', emitProgress);
    audio.addEventListener('seeked', emitProgress);
    audio.addEventListener('ended', emitProgress);

    return audio;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.audioElements = [this.createAudioElement(0), this.createAudioElement(1)];
    this.isInitialized = true;
  }

  getProgressEventName() {
    return PROGRESS_EVENT;
  }

  clearAlmostEndedTimeout() {
    if (this.almostEndedTimeout) {
      clearTimeout(this.almostEndedTimeout);
      this.almostEndedTimeout = null;
    }
  }

  clearFadeInterval() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  revokeObjectUrl(index) {
    if (this.objectUrls[index]) {
      URL.revokeObjectURL(this.objectUrls[index]);
      this.objectUrls[index] = null;
    }
  }

  // --- Web Audio Graph Setup ---

  /**
   * Inicializa el grafo Web Audio con EQ de 3 bandas por slot.
   * Solo se activa en plataformas que lo soportan (no iOS background).
   * 
   * Grafo por slot:
   * HTMLAudio → MediaElementSource → EQ(low→mid→high) → GainNode → Analyser → destination
   */
  ensureWebAudioGraph() {
    if (this.isWebAudioConnected) return true;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      console.warn('[AudioEngine] Web Audio / Analyser deshabilitado en iOS para preservar background audio y rendimiento.');
      return false;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      if (!this.analyserNode) {
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 512;
        this.analyserNode.smoothingTimeConstant = 0.82;
        this.analyserNode.connect(this.audioContext.destination);
      }

      this.audioElements.forEach((audio, i) => {
        if (this.sourceNodes[i] || !audio) return;

        try {
          // Source
          const source = this.audioContext.createMediaElementSource(audio);
          this.sourceNodes[i] = source;

          // EQ Chain (3 bandas)
          const eq = createEQChain(this.audioContext);
          this.eqChains[i] = eq;

          // Gain Node (volumen del slot)
          const gain = this.audioContext.createGain();
          gain.gain.value = EPSILON_VOLUME;
          this.gainNodes[i] = gain;

          // Conectar: source → EQ → gain → analyser (→ destination)
          source.connect(eq.input);
          eq.output.connect(gain);
          gain.connect(this.analyserNode);

          // Importante: cuando usamos Web Audio, el volumen del
          // HTMLAudioElement debe ser 1 (el control va por GainNode)
          audio.volume = 1;
        } catch (e) {
          console.warn(`[AudioEngine] Error conectando slot ${i} a Web Audio:`, e);
        }
      });

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.isWebAudioConnected = true;
      this.isAnalyserActive = true;
      return true;
    } catch (error) {
      console.warn('[AudioEngine] Web Audio no disponible:', error);
      return false;
    }
  }

  // --- Volume & EQ Control ---

  updateElementVolume(index) {
    const vol = clamp(this.slotVolumes[index] * this.masterVolume, 0, 1);

    if (this.isWebAudioConnected && this.gainNodes[index]) {
      // Web Audio: controlar via GainNode (más preciso, no clicks)
      const gain = this.gainNodes[index];
      const now = this.audioContext.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(Math.max(EPSILON_VOLUME, vol), now, 0.015);
    } else {
      // Fallback: HTMLAudioElement.volume
      const audio = this.audioElements[index];
      if (audio) audio.volume = Math.max(EPSILON_VOLUME, vol);
    }
  }

  setSlotVolume(index, value) {
    this.slotVolumes[index] = clamp(value, 0, 1);
    this.updateElementVolume(index);
  }

  /**
   * Aplica EQ de 3 bandas a un slot.
   * @param {number} index - Slot (0 o 1)
   * @param {{ low: number, mid: number, high: number }} eq - Valores 0-1 por banda
   */
  setSlotEQ(index, eq) {
    if (!this.isWebAudioConnected || !this.eqChains[index]) return;

    const chain = this.eqChains[index];
    const now = this.audioContext.currentTime;

    const lowDB = linearToEQGain(eq.low);
    const midDB = linearToEQGain(eq.mid);
    const highDB = linearToEQGain(eq.high);

    // Rampas suaves para evitar clicks/pops
    chain.low.gain.cancelScheduledValues(now);
    chain.low.gain.setTargetAtTime(lowDB, now, 0.03);

    chain.mid.gain.cancelScheduledValues(now);
    chain.mid.gain.setTargetAtTime(midDB, now, 0.03);

    chain.high.gain.cancelScheduledValues(now);
    chain.high.gain.setTargetAtTime(highDB, now, 0.03);
  }

  /**
   * Resetea EQ de un slot a flat (0dB en todas las bandas).
   */
  resetSlotEQ(index) {
    this.setSlotEQ(index, { low: 1, mid: 1, high: 1 });
  }

  emitProgress() {
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, {
      detail: this.getPlaybackSnapshot()
    }));
  }

  resetSlot(index) {
    const audio = this.audioElements[index];
    if (!audio) return;

    audio.onended = null;
    audio.playbackRate = 1.0;

    try {
      audio.pause();
    } catch (error) {
      console.warn('[AudioEngine] No se pudo pausar el slot.', error);
    }

    // Resetear EQ a flat
    this.resetSlotEQ(index);

    audio.removeAttribute('src');
    audio.load();
    this.revokeObjectUrl(index);
    this.setSlotVolume(index, 0);
  }

  async prepareSlot(index, song, requestId) {
    const audio = this.audioElements[index];
    const blob = await AudioStorageService.getAudioBlob(song.url);

    if (requestId !== this.loadRequestId) return null;

    const objectUrl = URL.createObjectURL(blob);
    this.resetSlot(index);
    this.objectUrls[index] = objectUrl;
    audio.src = objectUrl;

    await new Promise((resolve, reject) => {
      const handleLoaded = () => { cleanup(); resolve(); };
      const handleError = () => { cleanup(); reject(new Error(`Error cargando "${song.title}".`)); };
      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', handleLoaded);
        audio.removeEventListener('canplay', handleLoaded);
        audio.removeEventListener('error', handleError);
      };
      audio.addEventListener('loadedmetadata', handleLoaded, { once: true });
      audio.addEventListener('canplay', handleLoaded, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      audio.load();
    });

    if (requestId !== this.loadRequestId) {
      this.resetSlot(index);
      return null;
    }

    return audio;
  }

  scheduleTrackCallbacks(audio, playbackId) {
    this.clearAlmostEndedTimeout();
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;

    audio.onended = () => {
      if (playbackId !== this.activePlaybackId) return;
      this.isPlaying = false;
      this.emitProgress();
      if (this.onEndedCallback) this.onEndedCallback();
    };

    if (duration > this.crossfadeDuration && this.onAlmostEndedCallback) {
      const remainingMs = Math.max(0, (duration - audio.currentTime - this.crossfadeDuration) * 1000);
      this.almostEndedTimeout = setTimeout(() => {
        if (playbackId !== this.activePlaybackId) return;
        this.onAlmostEndedCallback();
      }, remainingMs);
    }
  }

  // --- DJ Transition Core ---

  async playSync(song, options = {}) {
    const { crossfade = 0, offset = 0, playbackRate = 1.0 } = options;
    await this.initialize();

    // Intentar activar Web Audio (EQ de 3 bandas)
    this.ensureWebAudioGraph();

    const requestId = ++this.loadRequestId;
    const nextIndex = this.currentIndex === -1 ? 0 : (this.currentIndex + 1) % 2;
    const previousIndex = this.currentIndex;

    const nextAudio = await this.prepareSlot(nextIndex, song, requestId);
    if (!nextAudio || requestId !== this.loadRequestId) return false;

    nextAudio.currentTime = offset;

    // Beat sync: ajustar playbackRate para match de BPM
    if (playbackRate !== 1.0) {
      const safeRate = clamp(playbackRate, 0.92, 1.08);
      nextAudio.playbackRate = safeRate;
      console.log(`[DJ BeatSync] playbackRate ajustado: ${safeRate.toFixed(4)}`);
    }

    const playbackId = ++this.activePlaybackId;
    this.scheduleTrackCallbacks(nextAudio, playbackId);

    const isBackground = typeof document !== 'undefined' && document.hidden;
    const shouldCrossfade = crossfade > 0 && !isBackground;

    if (shouldCrossfade && previousIndex !== -1 && this.audioElements[previousIndex]?.src) {
      this.clearFadeInterval();
      this.setSlotVolume(nextIndex, 0);

      // Resetear EQ de B a mudo
      this.setSlotEQ(nextIndex, { low: 0, mid: 0, high: 0 });

      await nextAudio.play();

      const fadeMs = crossfade * 1000;
      const startTime = Date.now();
      let lastPhase = "";

      console.log(`[DJ Mix] 🎛️ Iniciando mezcla DJ de ${crossfade}s con EQ dinámico`);

      this.fadeInterval = setInterval(() => {
        if (playbackId !== this.activePlaybackId) {
          this.clearFadeInterval();
          return;
        }

        const elapsed = Date.now() - startTime;
        const rawProgress = clamp(elapsed / fadeMs, 0, 1);
        const { gainA, gainB, phase, eqA, eqB } = computeDJMix(rawProgress);

        if (phase !== lastPhase) {
          console.log(`[DJ Mix] Phase: ${phase.toUpperCase()} | ${(rawProgress * 100).toFixed(0)}%`);
          console.log(`[DJ Mix] Gains → A: ${gainA.toFixed(3)} B: ${gainB.toFixed(3)}`);
          console.log(`[DJ Mix] EQ-A → L:${eqA.low.toFixed(2)} M:${eqA.mid.toFixed(2)} H:${eqA.high.toFixed(2)}`);
          console.log(`[DJ Mix] EQ-B → L:${eqB.low.toFixed(2)} M:${eqB.mid.toFixed(2)} H:${eqB.high.toFixed(2)}`);
          lastPhase = phase;
        }

        // Aplicar volúmenes
        this.setSlotVolume(previousIndex, gainA);
        this.setSlotVolume(nextIndex, gainB);

        // Aplicar EQ de 3 bandas (si Web Audio está activo)
        this.setSlotEQ(previousIndex, eqA);
        this.setSlotEQ(nextIndex, eqB);

        if (rawProgress >= 1) {
          this.clearFadeInterval();
          this.resetSlot(previousIndex);
          this.resetSlotEQ(nextIndex); // B vuelve a flat
          console.log(`[DJ Mix] ✅ Mezcla completada`);
        }
      }, FADE_TICK_MS);
    } else {
      this.audioElements.forEach((_, index) => { if (index !== nextIndex) this.resetSlot(index); });
      this.setSlotVolume(nextIndex, 1);
      this.resetSlotEQ(nextIndex);
      await nextAudio.play();
    }

    this.currentIndex = nextIndex;
    this.currentSongId = song.id;
    this.isPlaying = true;
    this.emitProgress();
    return true;
  }

  async play(song, crossfade = false) {
    const duration = typeof crossfade === 'number' ? crossfade : (crossfade ? this.crossfadeDuration : 0);
    return this.playSync(song, { crossfade: duration });
  }

  async playCurrent() {
    await this.initialize();
    const slotsToResume = this.pausedSlots.length > 0
      ? [...this.pausedSlots]
      : [this.currentIndex].filter((index) => index !== -1 && this.audioElements[index]?.src);

    if (slotsToResume.length === 0) return false;

    await Promise.all(slotsToResume.map(async (index) => {
      const audio = this.audioElements[index];
      if (audio && audio.paused) await audio.play();
    }));

    this.pausedSlots = [];
    this.isPlaying = true;
    this.emitProgress();
    return true;
  }

  async unpause() { return this.playCurrent(); }

  pause() {
    if (!this.isInitialized) return false;
    this.pausedSlots = this.audioElements
      .map((audio, index) => (!audio.paused ? index : null))
      .filter((value) => value !== null);

    this.audioElements.forEach((audio) => {
      try { audio.pause(); } catch (error) {}
    });

    this.isPlaying = false;
    this.emitProgress();
    return true;
  }

  stopAll() {
    if (!this.isInitialized) return;
    this.clearAlmostEndedTimeout();
    this.clearFadeInterval();
    this.loadRequestId++;
    this.activePlaybackId++;
    this.audioElements.forEach((_, index) => this.resetSlot(index));
    this.currentIndex = -1;
    this.currentSongId = null;
    this.pausedSlots = [];
    this.isPlaying = false;
    this.emitProgress();
  }

  setVolume(value) {
    this.masterVolume = clamp(value, 0, 1);
    this.slotVolumes.forEach((_, index) => this.updateElementVolume(index));
    this.emitProgress();
  }

  seek(timeInSeconds) {
    const audio = this.audioElements[this.currentIndex];
    if (!audio) return;
    const safeTime = clamp(timeInSeconds, 0, Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.currentTime = safeTime;
    this.scheduleTrackCallbacks(audio, this.activePlaybackId);
    this.emitProgress();
  }

  getPlaybackSnapshot() {
    const audio = this.audioElements[this.currentIndex];
    return {
      currentTime: audio ? audio.currentTime : 0,
      duration: audio && Number.isFinite(audio.duration) ? audio.duration : 0,
      volume: this.masterVolume,
      isPlaying: this.isPlaying
    };
  }

  getIsActuallyPlaying() {
    if (this.currentIndex === -1) return false;
    const audio = this.audioElements[this.currentIndex];
    return Boolean(audio && !audio.paused && !audio.ended);
  }

  setOnEnded(callback) { this.onEndedCallback = callback; }
  setOnAlmostEnded(callback) { this.onAlmostEndedCallback = callback; }

  // --- Analyser API (compatible con useAudioAnalyser) ---

  connectAnalyser() {
    return this.ensureWebAudioGraph();
  }

  getFrequencyData() {
    if (!this.analyserNode || !this.isAnalyserActive) return null;
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getBassLevel() {
    const data = this.getFrequencyData();
    if (!data) return 0;
    let sum = 0;
    const end = Math.min(10, data.length);
    for (let i = 0; i < end; i++) sum += data[i];
    return sum / (end * 255);
  }

  getMidLevel() {
    const data = this.getFrequencyData();
    if (!data) return 0;
    let sum = 0;
    const start = 10;
    const end = Math.min(60, data.length);
    for (let i = start; i < end; i++) sum += data[i];
    return sum / ((end - start) * 255);
  }
}

export const audioEngine = new AudioEngine();
