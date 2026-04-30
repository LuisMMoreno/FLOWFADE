import React, { useMemo, useCallback } from 'react';
import { usePlayback } from '../hooks/usePlayback';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, ChevronUp } from 'lucide-react';

/**
 * MiniPlayer fijo en la parte inferior.
 * En móvil: tap para expandir al FullPlayerView.
 * En desktop: controles completos con slider de progreso y volumen.
 */
export const Player = () => {
  const {
    currentSong,
    isPlaying,
    queue,
    currentTime,
    duration,
    volume,
    isTransitioning,
    isPlayerExpanded,
    setIsPlayerExpanded,
    togglePlay,
    nextSong,
    previousSong,
    seekTo,
    setVolume
  } = usePlayback();

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

  const formatTime = (timeInSeconds) => {
    const totalSeconds = Math.max(0, Math.floor(timeInSeconds));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (event) => {
    seekTo(Number(event.target.value));
  };

  const handleVolumeChange = (event) => {
    setVolume(Number(event.target.value));
  };

  const handleExpand = useCallback(() => {
    if (currentSong) {
      setIsPlayerExpanded(true);
    }
  }, [currentSong, setIsPlayerExpanded]);

  const handleMobileClick = useCallback((e) => {
    // En móvil, si no se clickeó un botón, expandir
    if (e.target.closest('button') || e.target.closest('input')) return;
    handleExpand();
  }, [handleExpand]);

  // No mostrar cuando el FullPlayer está abierto
  if (isPlayerExpanded) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 z-50 safe-pb"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Mini progress bar (visible en móvil) */}
      {hasSong && (
        <div className="mini-progress-bar" style={{ width: `${progressPercent}%` }} />
      )}

      <div
        className="h-[72px] md:h-24 px-4 sm:px-6 flex items-center justify-between cursor-pointer md:cursor-default"
        onClick={handleMobileClick}
      >
        {/* Información de canción actual */}
        <div className="flex items-center flex-1 min-w-0 mr-4 md:mr-0 md:w-1/3">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-white/5 rounded-lg shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10">
             {currentSong?.cover ? (
               <img src={currentSong.cover} alt={currentSong.title} className="w-full h-full object-cover" />
             ) : (
               <Music size={20} className="text-white/40" />
             )}
          </div>
          <div className="ml-3 min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white truncate tracking-tight">
              {currentSong ? currentSong.title : 'Sin reproducción'}
            </h4>
            <p className="text-xs text-white/60 truncate font-medium mt-0.5">
              {currentSong ? currentSong.artist : 'Selecciona una canción'}
            </p>
          </div>
        </div>

        {/* Controles centrales */}
        <div className="flex items-center justify-end md:justify-center shrink-0 md:flex-1 md:w-1/3 gap-3 md:gap-4">
          {/* Skip Back — solo desktop */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              previousSong();
            }}
            disabled={!canGoPrevious}
            aria-label="Canción anterior"
            className="hidden md:flex w-12 h-12 items-center justify-center text-white/60 hover:text-white active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipBack size={24} className="fill-current" />
          </button>

          {/* Play/Pause — siempre visible */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            disabled={!canPlayPause}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-white active:scale-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPlaying ? (
              <Pause size={28} className="fill-current" />
            ) : (
              <Play size={28} className="fill-current" style={{ marginLeft: '2px' }} />
            )}
          </button>

          {/* Skip Forward — siempre visible en móvil también */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSong();
            }}
            disabled={!canGoNext}
            aria-label="Siguiente canción"
            className="w-12 h-12 flex items-center justify-center text-white hover:text-white/80 active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipForward size={24} className="fill-current" />
          </button>
        </div>
        
        {/* Progress bar — solo desktop */}
        <div className="hidden md:flex absolute bottom-[90px] left-1/2 -translate-x-1/2 w-[400px] items-center space-x-3 text-[11px] text-white/50 font-medium">
          <span className="w-10 text-right tabular-nums">{formatTime(safeCurrentTime)}</span>
          <input
            type="range"
            min="0"
            max={safeDuration || 0}
            step="0.1"
            value={safeCurrentTime}
            onChange={handleSeek}
            disabled={!hasSong || safeDuration <= 0 || isTransitioning}
            aria-label="Progreso de reproducción"
            className="player-slider player-slider-progress flex-1"
            style={{
              '--player-progress': safeDuration > 0 ? `${(safeCurrentTime / safeDuration) * 100}%` : '0%'
            }}
          />
          <span className="w-10 tabular-nums">{formatTime(safeDuration)}</span>
        </div>

        {/* Controles adicionales (Desktop) / Expand (Mobile) */}
        <div className="flex items-center justify-end w-auto md:w-1/3">
          {/* Expand button — solo móvil */}
          {hasSong && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleExpand();
              }}
              className="md:hidden flex items-center justify-center text-white/40 hover:text-white transition-colors ml-2"
              style={{ width: '44px', height: '44px' }}
              aria-label="Expandir reproductor"
            >
              <ChevronUp size={24} />
            </button>
          )}

          {/* Volume — solo desktop */}
          <div className="items-center space-x-3 w-32 hidden lg:flex ml-auto">
            <Volume2 size={18} className="text-white/50" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={safeVolume}
              onChange={handleVolumeChange}
              disabled={!hasSong}
              aria-label="Volumen"
              className="player-slider flex-1"
              style={{ '--player-progress': `${safeVolume * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
