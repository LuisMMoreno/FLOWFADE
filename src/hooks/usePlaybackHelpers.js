import { useMemo } from 'react';
import { formatTime } from '../utils/formatTime';

/**
 * Hook que provee utilidades comunes derivadas del estado de reproducción.
 * Evita duplicación de lógica entre Player y FullPlayerView.
 */
export function usePlaybackHelpers({ currentSong, queue, currentTime, duration, volume, isTransitioning }) {
  const currentIndex = useMemo(() => {
    if (!currentSong || !Array.isArray(queue)) return -1;
    return queue.findIndex((song) => song.id === currentSong.id);
  }, [currentSong, queue]);

  const hasSong = Boolean(currentSong);
  const canPlayPause = hasSong && !isTransitioning;
  const canGoPrevious = currentIndex > 0 && !isTransitioning;
  const canGoNext = currentIndex !== -1 && currentIndex < queue.length - 1 && !isTransitioning;
  const safeDuration = duration || 0;
  const safeCurrentTime = Math.min(currentTime || 0, safeDuration || 0);
  const safeVolume = Number.isFinite(volume) ? volume : 1;
  const progressPercent = safeDuration > 0 ? (safeCurrentTime / safeDuration) * 100 : 0;

  return {
    currentIndex,
    hasSong,
    canPlayPause,
    canGoPrevious,
    canGoNext,
    safeDuration,
    safeCurrentTime,
    safeVolume,
    progressPercent,
    formatTime
  };
}