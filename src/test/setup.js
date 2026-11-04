import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock navigator.mediaSession
if (!navigator.mediaSession) {
  navigator.mediaSession = {
    metadata: null,
    playbackState: 'none',
    setActionHandler: vi.fn(),
    setPositionState: vi.fn(),
  };
}

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
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
}));

global.webkitAudioContext = global.AudioContext;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock caches API
global.caches = {
  open: vi.fn().mockResolvedValue({
    put: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(new Response()),
    delete: vi.fn().mockResolvedValue(true),
  }),
};

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id));

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning: ReactDOM.render is no longer supported') ||
      args[0]?.includes?.('act(...)')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});