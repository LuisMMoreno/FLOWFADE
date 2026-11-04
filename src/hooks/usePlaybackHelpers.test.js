import { renderHook } from '@testing-library/react';
import { usePlaybackHelpers } from './usePlaybackHelpers';

describe('usePlaybackHelpers', () => {
  const mockSong = { id: '1', title: 'Test Song', artist: 'Test Artist' };
  const mockQueue = [
    { id: '1', title: 'Song 1' },
    { id: '2', title: 'Song 2' },
    { id: '3', title: 'Song 3' },
  ];

  test('returns correct values for playing song at index 0', () => {
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: mockSong,
        queue: mockQueue,
        currentTime: 30,
        duration: 180,
        volume: 0.5,
        isTransitioning: false,
      })
    );

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.hasSong).toBe(true);
    expect(result.current.canPlayPause).toBe(true);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.safeDuration).toBe(180);
    expect(result.current.safeCurrentTime).toBe(30);
    expect(result.current.safeVolume).toBe(0.5);
    expect(result.current.progressPercent).toBeCloseTo(16.67, 1);
  });

  test('returns correct values for song at index 1', () => {
    const songAtIndex1 = mockQueue[1];
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: songAtIndex1,
        queue: mockQueue,
        currentTime: 60,
        duration: 240,
        volume: 0.8,
        isTransitioning: false,
      })
    );

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.canGoNext).toBe(true);
  });

  test('returns correct values for last song in queue', () => {
    const songAtIndex2 = mockQueue[2];
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: songAtIndex2,
        queue: mockQueue,
        currentTime: 120,
        duration: 200,
        volume: 1,
        isTransitioning: false,
      })
    );

    expect(result.current.currentIndex).toBe(2);
    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.canGoNext).toBe(false);
  });

  test('returns -1 for song not in queue', () => {
    const otherSong = { id: '999', title: 'Not in queue' };
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: otherSong,
        queue: mockQueue,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isTransitioning: false,
      })
    );

    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });

  test('returns false for canPlayPause when transitioning', () => {
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: mockSong,
        queue: mockQueue,
        currentTime: 30,
        duration: 180,
        volume: 0.5,
        isTransitioning: true,
      })
    );

    expect(result.current.canPlayPause).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });

  test('handles null currentSong', () => {
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: null,
        queue: mockQueue,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isTransitioning: false,
      })
    );

    expect(result.current.hasSong).toBe(false);
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.canPlayPause).toBe(false);
    expect(result.current.safeDuration).toBe(0);
    expect(result.current.safeCurrentTime).toBe(0);
    expect(result.current.progressPercent).toBe(0);
  });

  test('handles empty queue', () => {
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: mockSong,
        queue: [],
        currentTime: 30,
        duration: 180,
        volume: 0.5,
        isTransitioning: false,
      })
    );

    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });

  test('handles null/undefined queue', () => {
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: mockSong,
        queue: null,
        currentTime: 30,
        duration: 180,
        volume: 0.5,
        isTransitioning: false,
      })
    );

    expect(result.current.currentIndex).toBe(-1);
  });

  test('clamps currentTime to duration', () => {
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: mockSong,
        queue: mockQueue,
        currentTime: 200, // Greater than duration
        duration: 180,
        volume: 0.5,
        isTransitioning: false,
      })
    );

    expect(result.current.safeCurrentTime).toBe(180);
    expect(result.current.progressPercent).toBe(100);
  });

  test('handles NaN volume', () => {
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: mockSong,
        queue: mockQueue,
        currentTime: 30,
        duration: 180,
        volume: NaN,
        isTransitioning: false,
      })
    );

    expect(result.current.safeVolume).toBe(1);
  });

  test('formatTime function works correctly', () => {
    const { result } = renderHook(() =>
      usePlaybackHelpers({
        currentSong: mockSong,
        queue: mockQueue,
        currentTime: 90,
        duration: 180,
        volume: 0.5,
        isTransitioning: false,
      })
    );

    expect(result.current.formatTime(0)).toBe('0:00');
    expect(result.current.formatTime(30)).toBe('0:30');
    expect(result.current.formatTime(60)).toBe('1:00');
    expect(result.current.formatTime(90)).toBe('1:30');
    expect(result.current.formatTime(125)).toBe('2:05');
  });

  test('updates when props change', () => {
    const { result, rerender } = renderHook(
      ({ currentTime }) =>
        usePlaybackHelpers({
          currentSong: mockSong,
          queue: mockQueue,
          currentTime,
          duration: 180,
          volume: 0.5,
          isTransitioning: false,
        }),
      { initialProps: { currentTime: 30 } }
    );

    expect(result.current.safeCurrentTime).toBe(30);
    expect(result.current.progressPercent).toBeCloseTo(16.67, 1);

    rerender({ currentTime: 90 });

    expect(result.current.safeCurrentTime).toBe(90);
    expect(result.current.progressPercent).toBe(50);
  });
});