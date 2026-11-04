import { vi } from 'vitest';
import { audioEngine } from './AudioEngine';
import { AudioStorageService } from './AudioStorageService';

vi.mock('./AudioStorageService', () => ({
  AudioStorageService: {
    getAudioBlob: vi.fn(),
    importFile: vi.fn(),
    deleteFromCache: vi.fn(),
  },
}));

vi.mock('./DJEngine', () => ({
  DJEngine: vi.fn().mockImplementation(() => ({
    getTransitionPlan: vi.fn().mockReturnValue({ duration: 8, type: 'blend' }),
  })),
}));

// Mock AudioContext
const mockAudioContext = {
  createAnalyser: vi.fn().mockReturnValue({
    fftSize: 512,
    smoothingTimeConstant: 0.82,
    frequencyBinCount: 256,
    getByteFrequencyData: vi.fn(),
    connect: vi.fn(),
  }),
  createMediaElementSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
  }),
  createGain: vi.fn().mockReturnValue({
    gain: { value: 1, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
    connect: vi.fn(),
  }),
  createBiquadFilter: vi.fn().mockReturnValue({
    type: 'lowshelf',
    frequency: { value: 0 },
    gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
    connect: vi.fn(),
  }),
  destination: {},
  state: 'running',
  resume: vi.fn(),
  currentTime: 0,
};

global.AudioContext = vi.fn(() => mockAudioContext);
global.webkitAudioContext = global.AudioContext;

// Mock URL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock HTMLAudioElement
const mockAudioElement = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  removeAttribute: vi.fn(),
  setAttribute: vi.fn(),
  volume: 1,
  currentTime: 0,
  duration: 180,
  playbackRate: 1,
  paused: true,
  ended: false,
  src: '',
  preload: 'auto',
  loop: false,
  playsInline: true,
};

global.Audio = vi.fn(() => mockAudioElement);

describe('AudioEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset audioEngine state
    audioEngine.audioElements = [];
    audioEngine.objectUrls = [null, null];
    audioEngine.slotVolumes = [0, 0];
    audioEngine.currentIndex = -1;
    audioEngine.isPlaying = false;
    audioEngine.currentSongId = null;
    audioEngine.masterVolume = 1;
    audioEngine.isInitialized = false;
    audioEngine.loadRequestId = 0;
    audioEngine.activePlaybackId = 0;
    audioEngine.pausedSlots = [];
    audioEngine.fadeInterval = null;
    audioEngine.almostEndedTimeout = null;
    audioEngine.onEndedCallback = null;
    audioEngine.onAlmostEndedCallback = null;
    audioEngine.audioContext = null;
    audioEngine.analyserNode = null;
    audioEngine.sourceNodes = [null, null];
    audioEngine.gainNodes = [null, null];
    audioEngine.eqChains = [null, null];
    audioEngine.isAnalyserActive = false;
    audioEngine.isWebAudioConnected = false;

    AudioStorageService.getAudioBlob.mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clear any intervals
    if (audioEngine.fadeInterval) {
      clearInterval(audioEngine.fadeInterval);
    }
    if (audioEngine.almostEndedTimeout) {
      clearTimeout(audioEngine.almostEndedTimeout);
    }
  });

  describe('initialize', () => {
    test('creates two audio elements on initialize', async () => {
      await audioEngine.initialize();

      expect(audioEngine.audioElements).toHaveLength(2);
      expect(audioEngine.isInitialized).toBe(true);
      expect(global.Audio).toHaveBeenCalledTimes(2);
    });

    test('does not reinitialize if already initialized', async () => {
      await audioEngine.initialize();
      const elements = audioEngine.audioElements;
      await audioEngine.initialize();
      expect(audioEngine.audioElements).toBe(elements);
    });
  });

  describe('setVolume', () => {
    test('sets master volume and updates elements', async () => {
      await audioEngine.initialize();
      audioEngine.setVolume(0.5);

      expect(audioEngine.masterVolume).toBe(0.5);
    });

    test('clamps volume to 0-1 range', async () => {
      await audioEngine.initialize();
      audioEngine.setVolume(1.5);
      expect(audioEngine.masterVolume).toBe(1);

      audioEngine.setVolume(-0.5);
      expect(audioEngine.masterVolume).toBe(0);
    });
  });

  describe('seek', () => {
    test('seeks to valid time', async () => {
      await audioEngine.initialize();
      // Set a song as current
      audioEngine.currentIndex = 0;
      audioEngine.audioElements[0] = mockAudioElement;
      mockAudioElement.duration = 180;
      mockAudioElement.currentTime = 0;

      audioEngine.seek(60);

      expect(mockAudioElement.currentTime).toBe(60);
    });

    test('clamps seek time to duration', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = 0;
      audioEngine.audioElements[0] = mockAudioElement;
      mockAudioElement.duration = 180;

      audioEngine.seek(200); // Beyond duration

      expect(mockAudioElement.currentTime).toBe(180);
    });

    test('clamps seek time to 0 minimum', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = 0;
      audioEngine.audioElements[0] = mockAudioElement;
      mockAudioElement.duration = 180;

      audioEngine.seek(-10);

      expect(mockAudioElement.currentTime).toBe(0);
    });
  });

  describe('pause', () => {
    test('pauses all playing audio elements', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = 0;
      audioEngine.audioElements[0] = mockAudioElement;
      mockAudioElement.paused = false;
      audioEngine.isPlaying = true;

      audioEngine.pause();

      expect(mockAudioElement.pause).toHaveBeenCalled();
      expect(audioEngine.isPlaying).toBe(false);
      expect(audioEngine.pausedSlots).toContain(0);
    });
  });

  describe('stopAll', () => {
    test('stops all audio and resets state', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = 0;
      audioEngine.currentSongId = 'song1';
      audioEngine.isPlaying = true;
      audioEngine.audioElements[0] = mockAudioElement;

      audioEngine.stopAll();

      expect(audioEngine.currentIndex).toBe(-1);
      expect(audioEngine.currentSongId).toBeNull();
      expect(audioEngine.isPlaying).toBe(false);
      expect(audioEngine.pausedSlots).toEqual([]);
      expect(mockAudioElement.pause).toHaveBeenCalled();
    });
  });

  describe('playCurrent', () => {
    test('resumes paused slots', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = 0;
      audioEngine.audioElements[0] = mockAudioElement;
      mockAudioElement.paused = true;
      audioEngine.pausedSlots = [0];

      await audioEngine.playCurrent();

      expect(mockAudioElement.play).toHaveBeenCalled();
      expect(audioEngine.isPlaying).toBe(true);
      expect(audioEngine.pausedSlots).toEqual([]);
    });
  });

  describe('getPlaybackSnapshot', () => {
    test('returns current playback state', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = 0;
      audioEngine.audioElements[0] = mockAudioElement;
      mockAudioElement.currentTime = 60;
      mockAudioElement.duration = 180;
      audioEngine.masterVolume = 0.8;
      audioEngine.isPlaying = true;

      const snapshot = audioEngine.getPlaybackSnapshot();

      expect(snapshot.currentTime).toBe(60);
      expect(snapshot.duration).toBe(180);
      expect(snapshot.volume).toBe(0.8);
      expect(snapshot.isPlaying).toBe(true);
    });

    test('returns zeros when no current song', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = -1;

      const snapshot = audioEngine.getPlaybackSnapshot();

      expect(snapshot.currentTime).toBe(0);
      expect(snapshot.duration).toBe(0);
      expect(snapshot.volume).toBe(1);
      expect(snapshot.isPlaying).toBe(false);
    });
  });

  describe('getIsActuallyPlaying', () => {
    test('returns true when audio is playing', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = 0;
      audioEngine.audioElements[0] = mockAudioElement;
      mockAudioElement.paused = false;
      mockAudioElement.ended = false;

      expect(audioEngine.getIsActuallyPlaying()).toBe(true);
    });

    test('returns false when audio is paused', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = 0;
      audioEngine.audioElements[0] = mockAudioElement;
      mockAudioElement.paused = true;

      expect(audioEngine.getIsActuallyPlaying()).toBe(false);
    });

    test('returns false when no current song', async () => {
      await audioEngine.initialize();
      audioEngine.currentIndex = -1;

      expect(audioEngine.getIsActuallyPlaying()).toBe(false);
    });
  });

  describe('EQ functions', () => {
    test('setSlotEQ applies EQ values', async () => {
      await audioEngine.initialize();
      audioEngine.isWebAudioConnected = true;
      audioEngine.eqChains[0] = {
        low: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } },
        mid: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } },
        high: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } },
      };
      audioEngine.audioContext = mockAudioContext;

      audioEngine.setSlotEQ(0, { low: 0.5, mid: 0.8, high: 0.3 });

      expect(audioEngine.eqChains[0].low.gain.setTargetAtTime).toHaveBeenCalled();
      expect(audioEngine.eqChains[0].mid.gain.setTargetAtTime).toHaveBeenCalled();
      expect(audioEngine.eqChains[0].high.gain.setTargetAtTime).toHaveBeenCalled();
    });

    test('resetSlotEQ sets flat EQ', async () => {
      await audioEngine.initialize();
      audioEngine.isWebAudioConnected = true;
      audioEngine.eqChains[0] = {
        low: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } },
        mid: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } },
        high: { gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } },
      };
      audioEngine.audioContext = mockAudioContext;

      audioEngine.resetSlotEQ(0);

      // Should call setTargetAtTime with 0dB (linear 1.0)
      expect(audioEngine.eqChains[0].low.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number));
    });
  });

  describe('Analyser API', () => {
    test('connectAnalyser returns true when Web Audio is available', async () => {
      await audioEngine.initialize();
      const result = audioEngine.connectAnalyser();
      expect(result).toBe(true);
    });

    test('getFrequencyData returns data when analyser is active', async () => {
      await audioEngine.initialize();
      audioEngine.analyserNode = mockAudioContext.createAnalyser();
      audioEngine.isAnalyserActive = true;

      const mockData = new Uint8Array(256);
      mockAudioContext.createAnalyser().getByteFrequencyData.mockImplementation((arr) => arr.set(mockData));

      const data = audioEngine.getFrequencyData();

      expect(data).toBeInstanceOf(Uint8Array);
    });

    test('getFrequencyData returns null when analyser not active', async () => {
      await audioEngine.initialize();
      audioEngine.isAnalyserActive = false;

      const data = audioEngine.getFrequencyData();

      expect(data).toBeNull();
    });

    test('getBassLevel calculates average of first 10 bins', async () => {
      await audioEngine.initialize();
      audioEngine.analyserNode = mockAudioContext.createAnalyser();
      audioEngine.isAnalyserActive = true;

      const mockData = new Uint8Array(256);
      for (let i = 0; i < 10; i++) mockData[i] = 255; // Max bass
      mockAudioContext.createAnalyser().getByteFrequencyData.mockImplementation((arr) => arr.set(mockData));

      const bass = audioEngine.getBassLevel();

      expect(bass).toBeCloseTo(1, 1);
    });

    test('getMidLevel calculates average of bins 10-60', async () => {
      await audioEngine.initialize();
      audioEngine.analyserNode = mockAudioContext.createAnalyser();
      audioEngine.isAnalyserActive = true;

      const mockData = new Uint8Array(256);
      for (let i = 10; i < 60; i++) mockData[i] = 128; // Mid level
      mockAudioContext.createAnalyser().getByteFrequencyData.mockImplementation((arr) => arr.set(mockData));

      const mid = audioEngine.getMidLevel();

      expect(mid).toBeCloseTo(0.5, 1);
    });
  });

  });