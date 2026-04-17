import React, { useMemo } from 'react';
import { usePlayback } from '../hooks/usePlayback';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music } from 'lucide-react';

export const Player = () => {
  const {
    currentSong,
    isPlaying,
    queue,
    currentTime,
    duration,
    volume,
    isTransitioning,
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

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 h-20 md:h-24 px-4 flex items-center justify-between z-50 safe-pb">
      {/* Información de canción actual */}
      <div className="flex items-center w-[45%] md:w-1/3 min-w-0 mr-2">
        <div className="w-12 h-12 md:w-14 md:h-14 bg-accent/20 rounded shadow-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5">
           {currentSong?.cover ? (
             <img src={currentSong.cover} alt={currentSong.title} className="w-full h-full object-cover" />
           ) : (
             <Music size={20} className="text-accent" />
           )}
        </div>
        <div className="ml-3 min-w-0">
          <h4 className="text-[13px] md:text-sm font-bold text-white truncate">
            {currentSong ? currentSong.title : 'Sin reproducción'}
          </h4>
          <p className="text-[11px] md:text-xs text-accent truncate">
            {currentSong ? currentSong.artist : 'Selecciona una canción'}
          </p>
        </div>
      </div>

      {/* Controles centrales */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-[600px] md:w-1/3">
        <div className="flex items-center space-x-3 md:space-x-4">
          <button
            type="button"
            onClick={previousSong}
            disabled={!canGoPrevious}
            aria-label="Canción anterior"
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-accent hover:text-white active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <SkipBack size={20} className="fill-current" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canPlayPause}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            className="w-11 h-11 md:w-12 md:h-12 flex items-center justify-center bg-white rounded-full text-black hover:scale-105 active:scale-95 transition-all shadow-lg disabled:bg-white/70 disabled:text-black/60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
          >
            {isPlaying ? (
              <Pause size={22} className="fill-current" />
            ) : (
              <Play size={22} className="fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={nextSong}
            disabled={!canGoNext}
            aria-label="Siguiente canción"
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-accent hover:text-white active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <SkipForward size={20} className="fill-current" />
          </button>
        </div>
        
        <div className="w-full mt-2 hidden md:flex items-center space-x-2 text-[10px] text-accent font-medium">
          <span className="w-9 text-right tabular-nums">{formatTime(safeCurrentTime)}</span>
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
          <span className="w-9 tabular-nums">{formatTime(safeDuration)}</span>
        </div>
      </div>

      {/* Controles adicionales */}
      <div className="flex items-center justify-end w-[20%] md:w-1/3">
        <div className="items-center space-x-2 w-32 hidden lg:flex">
          <Volume2 size={16} className="text-accent" />
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
  );
};
