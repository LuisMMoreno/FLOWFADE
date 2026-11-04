import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useAudioAnalyser } from './useAudioAnalyser';
import { audioEngine } from '../services/AudioEngine';

// Mock audioEngine
vi.mock('../services/AudioEngine', () => ({
  audioEngine: {
    connectAnalyser: vi.fn(),
    analyserNode: null,
    getFrequencyData: vi.fn(),
  },
}));

// Mock requestAnimationFrame
let rafTime = 0;
global.requestAnimationFrame = vi.fn((cb) => {
  const id = setTimeout(() => {
    rafTime += 16;
    cb(rafTime);
  }, 16);
  return id;
});
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// Mock navigator.userAgent for iOS detection
const originalUserAgent = navigator.userAgent;

describe('useAudioAnalyser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    rafTime = 0;

    // Reset audioEngine mocks
    audioEngine.connectAnalyser.mockResolvedValue(false);
    audioEngine.getFrequencyData.mockReturnValue(null);
    audioEngine.analyserNode = null;

    // Reset user agent
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: originalUserAgent,
    });
  });

  test('returns zero levels when not active', () => {
    const { result } = renderHook(() => useAudioAnalyser(false, false));

    expect(result.current.bassLevel).toBe(0);
    expect(result.current.midLevel).toBe(0);
    expect(result.current.isAnalyserReady).toBe(false);
  });

  test('returns zero levels when active but not playing (real analyser)', () => {
    audioEngine.connectAnalyser.mockResolvedValue(true);
    audioEngine.analyserNode = { frequencyBinCount: 256 };

    const { result } = renderHook(() => useAudioAnalyser(true, false));

    expect(result.current.bassLevel).toBe(0);
    expect(result.current.midLevel).toBe(0);
    expect(result.current.isAnalyserReady).toBe(true);
  });

  test('simulates bass/mid on iOS when playing', () => {
    // Set iOS user agent
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    });

    const { result } = renderHook(() => useAudioAnalyser(true, true));

    // Advance timers to trigger animation frame
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // On iOS, should use simulation when playing
    expect(result.current.bassLevel).toBeGreaterThanOrEqual(0);
    expect(result.current.bassLevel).toBeLessThanOrEqual(1);
    expect(result.current.midLevel).toBeGreaterThanOrEqual(0);
    expect(result.current.midLevel).toBeLessThanOrEqual(1);
    expect(result.current.isAnalyserReady).toBe(true);
  });

  test('simulation returns zero when not playing on iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    });

    const { result } = renderHook(() => useAudioAnalyser(true, false));

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.bassLevel).toBe(0);
    expect(result.current.midLevel).toBe(0);
  });

  test('uses real analyser when available and not iOS', async () => {
    audioEngine.connectAnalyser.mockResolvedValue(true);
    audioEngine.analyserNode = { frequencyBinCount: 256 };

    // Mock frequency data
    const mockData = new Uint8Array(256);
    // Fill with some values for bass (bins 0-10)
    for (let i = 0; i < 10; i++) mockData[i] = 200;
    // Fill with some values for mid (bins 10-60)
    for (let i = 10; i < 60; i++) mockData[i] = 150;

    audioEngine.getFrequencyData.mockReturnValue(mockData);

    const { result } = renderHook(() => useAudioAnalyser(true, true));

    // Wait for connection
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.isAnalyserReady).toBe(true);
    // Bass should be > 0 since we filled bins 0-10 with 200
    expect(result.current.bassLevel).toBeGreaterThan(0);
    // Mid should be > 0 since we filled bins 10-60 with 150
    expect(result.current.midLevel).toBeGreaterThan(0);
  });

  test('falls back to simulation when connectAnalyser fails', async () => {
    audioEngine.connectAnalyser.mockRejectedValue(new Error('Web Audio not available'));

    const { result } = renderHook(() => useAudioAnalyser(true, true));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    // Should still be ready (fallback to simulation)
    expect(result.current.isAnalyserReady).toBe(true);
    expect(result.current.bassLevel).toBeGreaterThanOrEqual(0);
    expect(result.current.midLevel).toBeGreaterThanOrEqual(0);
  });

  test('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useAudioAnalyser(true, true));

    act(() => {
      vi.advanceTimersByTime(50);
    });

    unmount();

    // Should have called cancelAnimationFrame
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  test('stops animation when isActive becomes false', () => {
    const { result, rerender } = renderHook(
      ({ isActive }) => useAudioAnalyser(isActive, true),
      { initialProps: { isActive: true } }
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });

    rerender({ isActive: false });

    expect(result.current.bassLevel).toBe(0);
    expect(result.current.midLevel).toBe(0);
  });
});