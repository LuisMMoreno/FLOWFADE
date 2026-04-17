import { AudioStorageService } from './AudioStorageService';

const EPSILON_VOLUME = 0.001;
const PROGRESS_EVENT = 'flowfade:playback-progress';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Motor de audio orientado a iOS background:
 * - HTMLAudioElement persistente como salida audible principal.
 * - Crossfade mediante rampas de volumen entre dos elementos.
 */
class AudioEngine {
  constructor() {
    this.audioElements = [];
    this.objectUrls = [null, null];
    this.slotVolumes = [0, 0];
    this.currentIndex = -1;
    this.crossfadeDuration = 5;
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

  updateElementVolume(index) {
    const audio = this.audioElements[index];
    if (!audio) return;

    const volume = clamp(this.slotVolumes[index] * this.masterVolume, 0, 1);
    audio.volume = volume;
  }

  setSlotVolume(index, value) {
    this.slotVolumes[index] = clamp(value, 0, 1);
    this.updateElementVolume(index);
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

    try {
      audio.pause();
    } catch (error) {
      console.warn('[AudioEngine] No se pudo pausar el slot.', error);
    }

    audio.removeAttribute('src');
    audio.load();
    this.revokeObjectUrl(index);
    this.setSlotVolume(index, 0);
  }

  async prepareSlot(index, song, requestId) {
    const audio = this.audioElements[index];
    const blob = await AudioStorageService.getAudioBlob(song.url);

    if (requestId !== this.loadRequestId) {
      return null;
    }

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
        reject(new Error(`No se pudo cargar el audio para "${song.title}".`));
      };

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

    audio.currentTime = 0;
    return audio;
  }

  scheduleTrackCallbacks(audio, playbackId) {
    this.clearAlmostEndedTimeout();

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;

    audio.onended = () => {
      if (playbackId !== this.activePlaybackId) return;

      this.isPlaying = false;
      this.emitProgress();

      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };

    if (duration > this.crossfadeDuration && this.onAlmostEndedCallback) {
      const remainingMs = Math.max(0, (duration - audio.currentTime - this.crossfadeDuration) * 1000);
      this.almostEndedTimeout = setTimeout(() => {
        if (playbackId !== this.activePlaybackId) return;
        this.onAlmostEndedCallback();
      }, remainingMs);
    }
  }

  async play(song, crossfade = false) {
    await this.initialize();

    const requestId = ++this.loadRequestId;
    const nextIndex = this.currentIndex === -1 ? 0 : (this.currentIndex + 1) % 2;
    const previousIndex = this.currentIndex;
    const nextAudio = await this.prepareSlot(nextIndex, song, requestId);

    if (!nextAudio || requestId !== this.loadRequestId) {
      return false;
    }

    const playbackId = ++this.activePlaybackId;
    this.scheduleTrackCallbacks(nextAudio, playbackId);

    if (crossfade && previousIndex !== -1 && this.audioElements[previousIndex]?.src) {
      this.clearFadeInterval();
      this.setSlotVolume(nextIndex, 0);
      await nextAudio.play();

      const fadeMs = this.crossfadeDuration * 1000;
      const startTime = Date.now();

      this.fadeInterval = setInterval(() => {
        if (playbackId !== this.activePlaybackId) {
          this.clearFadeInterval();
          return;
        }

        const progress = clamp((Date.now() - startTime) / fadeMs, 0, 1);
        this.setSlotVolume(previousIndex, 1 - progress);
        this.setSlotVolume(nextIndex, progress);

        if (progress >= 1) {
          this.clearFadeInterval();
          this.resetSlot(previousIndex);
        }
      }, 50);
    } else {
      this.audioElements.forEach((_, index) => {
        if (index !== nextIndex) {
          this.resetSlot(index);
        }
      });

      this.setSlotVolume(nextIndex, 1);
      await nextAudio.play();
    }

    this.currentIndex = nextIndex;
    this.currentSongId = song.id;
    this.isPlaying = true;
    this.pausedSlots = [];
    this.emitProgress();
    return true;
  }

  async playCurrent() {
    await this.initialize();

    const slotsToResume = this.pausedSlots.length > 0
      ? [...this.pausedSlots]
      : [this.currentIndex].filter((index) => index !== -1 && this.audioElements[index]?.src);

    if (slotsToResume.length === 0) return false;

    await Promise.all(slotsToResume.map(async (index) => {
      const audio = this.audioElements[index];
      if (audio && audio.paused) {
        await audio.play();
      }
    }));

    this.pausedSlots = [];
    this.isPlaying = true;
    this.emitProgress();
    return true;
  }

  async unpause() {
    return this.playCurrent();
  }

  pause() {
    if (!this.isInitialized) return false;

    this.pausedSlots = this.audioElements
      .map((audio, index) => (!audio.paused ? index : null))
      .filter((value) => value !== null);

    this.audioElements.forEach((audio) => {
      try {
        audio.pause();
      } catch (error) {
        console.warn('[AudioEngine] No se pudo pausar un elemento de audio.', error);
      }
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

  setOnEnded(callback) {
    this.onEndedCallback = callback;
  }

  setOnAlmostEnded(callback) {
    this.onAlmostEndedCallback = callback;
  }
}

export const audioEngine = new AudioEngine();
