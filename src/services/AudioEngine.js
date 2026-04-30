import { AudioStorageService } from './AudioStorageService';

const EPSILON_VOLUME = 0.001;
const PROGRESS_EVENT = 'flowfade:playback-progress';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Motor de audio DJ avanzado.
 * Combina HTMLAudioElement (para iOS background) con Web Audio API (para mezcla precisa).
 */
class AudioEngine {
  constructor() {
    this.audioElements = [];
    this.objectUrls = [null, null];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.currentSongId = null;
    this.masterVolume = 1;
    this.isInitialized = false;

    // Web Audio API Nodes
    this.audioContext = null;
    this.gainNodes = [null, null];
    this.masterGain = null;
    this.sourceNodes = [null, null];
    this.analyserNode = null;

    this.loadRequestId = 0;
    this.activePlaybackId = 0;
    this.fadeInterval = null;
    this.almostEndedTimeout = null;
    this.onEndedCallback = null;
    this.onAlmostEndedCallback = null;
    this.onTransitionStartCallback = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Crear elementos de audio
    this.audioElements = [this.createAudioElement(0), this.createAudioElement(1)];

    // Inicializar Contexto de Audio
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx();
    
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.masterGain.connect(this.analyserNode);

    // Conectar elementos de audio al contexto
    this.audioElements.forEach((audio, i) => {
      const source = this.audioContext.createMediaElementSource(audio);
      const gain = this.audioContext.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.masterGain);
      this.gainNodes[i] = gain;
      this.sourceNodes[i] = source;
    });

    this.isInitialized = true;
  }

  createAudioElement(index) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    // El volumen del elemento HTML se deja al máximo porque controlamos con GainNodes
    audio.volume = 1;

    const emitProgress = () => {
      if (index !== this.currentIndex) return;
      window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, {
        detail: this.getPlaybackSnapshot()
      }));
    };

    audio.addEventListener('timeupdate', emitProgress);
    audio.addEventListener('ended', () => {
      if (index === this.currentIndex && this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    return audio;
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
      const handleLoaded = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error(`Error cargando audio slot ${index}`));
      };
      const cleanup = () => {
        audio.removeEventListener('canplay', handleLoaded);
        audio.removeEventListener('error', handleError);
      };
      audio.addEventListener('canplay', handleLoaded, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      audio.load();
    });

    audio.currentTime = 0;
    return audio;
  }

  resetSlot(index) {
    const audio = this.audioElements[index];
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (this.objectUrls[index]) {
      URL.revokeObjectURL(this.objectUrls[index]);
      this.objectUrls[index] = null;
    }
    if (this.gainNodes[index]) {
      this.gainNodes[index].gain.value = 0;
    }
  }

  async play(song) {
    await this.initialize();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();

    const requestId = ++this.loadRequestId;
    const slot = 0; // Para play directo usamos slot 0
    const audio = await this.prepareSlot(slot, song, requestId);

    if (!audio || requestId !== this.loadRequestId) return false;

    this.stopAll();
    this.currentIndex = slot;
    this.currentSongId = song.id;
    this.gainNodes[slot].gain.value = 1;
    
    await audio.play();
    this.isPlaying = true;
    this.scheduleAlmostEnded(audio, song);
    return true;
  }

  /**
   * Transición suave tipo DJ hacia una nueva canción.
   */
  async transitionTo(nextSong, plan) {
    if (!this.isInitialized) await this.initialize();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();

    const nextIndex = (this.currentIndex + 1) % 2;
    const prevIndex = this.currentIndex;
    const requestId = ++this.loadRequestId;

    if (this.onTransitionStartCallback) this.onTransitionStartCallback(nextSong);

    const nextAudio = await this.prepareSlot(nextIndex, nextSong, requestId);
    if (!nextAudio || requestId !== this.loadRequestId) return false;

    // Sincronización de BPM si es necesario
    if (plan.syncBeats && this.currentSongId) {
      // Aquí ajustaríamos playbackRate si tuviéramos los BPMs
      // Por ahora mantenemos 1.0 pero la estructura está lista
    }

    const duration = plan.duration || 5;
    const now = this.audioContext.currentTime;

    // Rampas de volumen (Equal Power Crossfade)
    this.gainNodes[prevIndex].gain.setValueAtTime(this.gainNodes[prevIndex].gain.value, now);
    this.gainNodes[prevIndex].gain.exponentialRampToValueAtTime(EPSILON_VOLUME, now + duration);

    this.gainNodes[nextIndex].gain.setValueAtTime(EPSILON_VOLUME, now);
    this.gainNodes[nextIndex].gain.exponentialRampToValueAtTime(1, now + duration);

    await nextAudio.play();
    
    setTimeout(() => {
      this.resetSlot(prevIndex);
    }, duration * 1000);

    this.currentIndex = nextIndex;
    this.currentSongId = nextSong.id;
    this.isPlaying = true;
    this.scheduleAlmostEnded(nextAudio, nextSong);
    
    return true;
  }

  scheduleAlmostEnded(audio, song) {
    if (this.almostEndedTimeout) clearTimeout(this.almostEndedTimeout);
    
    const checkInterval = 1000;
    const lookAhead = 15; // Empezar a planear 15 segundos antes del final

    const monitor = () => {
      if (!this.isPlaying || audio !== this.audioElements[this.currentIndex]) return;
      
      const remaining = audio.duration - audio.currentTime;
      if (remaining < lookAhead && this.onAlmostEndedCallback) {
        this.onAlmostEndedCallback(song);
      } else {
        this.almostEndedTimeout = setTimeout(monitor, checkInterval);
      }
    };

    this.almostEndedTimeout = setTimeout(monitor, checkInterval);
  }

  pause() {
    this.audioElements.forEach(a => a.pause());
    this.isPlaying = false;
  }

  async resume() {
    if (this.audioContext?.state === 'suspended') await this.audioContext.resume();
    const audio = this.audioElements[this.currentIndex];
    if (audio) await audio.play();
    this.isPlaying = true;
  }

  stopAll() {
    this.audioElements.forEach((_, i) => this.resetSlot(i));
    this.isPlaying = false;
    this.currentIndex = -1;
    this.currentSongId = null;
  }

  setVolume(val) {
    this.masterVolume = val;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(val, this.audioContext.currentTime, 0.1);
    }
  }

  seek(time) {
    const audio = this.audioElements[this.currentIndex];
    if (audio) audio.currentTime = time;
  }

  getPlaybackSnapshot() {
    const audio = this.audioElements[this.currentIndex];
    return {
      currentTime: audio ? audio.currentTime : 0,
      duration: audio ? audio.duration : 0,
      isPlaying: this.isPlaying,
      volume: this.masterVolume,
      currentSongId: this.currentSongId
    };
  }

  // Visualización
  getFrequencyData() {
    if (!this.analyserNode) return null;
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  setOnEnded(cb) { this.onEndedCallback = cb; }
  setOnAlmostEnded(cb) { this.onAlmostEndedCallback = cb; }
  setOnTransitionStart(cb) { this.onTransitionStartCallback = cb; }
}

export const audioEngine = new AudioEngine();
