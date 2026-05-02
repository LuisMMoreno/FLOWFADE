import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayback } from '../hooks/usePlayback';
import { useAlbumColors } from '../hooks/useAlbumColors';
import { useAudioAnalyser } from '../hooks/useAudioAnalyser';
import { WaveBackground } from './WaveBackground';
import { djEngine } from '../services/DJEngine';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Music,
  Shuffle,
  ListMusic,
  Mic2,
  Zap,
  MoreHorizontal
} from 'lucide-react';

export const FullPlayerView = () => {
  const {
    currentSong,
    isPlaying,
    queue,
    currentTime,
    duration,
    isTransitioning,
    isPlayerExpanded,
    setIsPlayerExpanded,
    togglePlay,
    nextSong,
    previousSong,
    seekTo
  } = usePlayback();

  const djPhase = djEngine.currentPhase;
  const isSyncReady = Boolean(currentSong?.beatGrid);

  const {
    primaryColor,
    secondaryColor,
    primaryRgb,
    secondaryRgb,
    gradient
  } = useAlbumColors(currentSong?.cover || null);

  const { bassLevel, midLevel } = useAudioAnalyser(isPlayerExpanded, isPlaying);

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

  const formatTime = (timeInSeconds) => {
    const totalSeconds = Math.max(0, Math.floor(timeInSeconds));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback((event) => {
    seekTo(Number(event.target.value));
  }, [seekTo]);

  const handleClose = useCallback(() => {
    setIsPlayerExpanded(false);
  }, [setIsPlayerExpanded]);

  if (!currentSong || !isPlayerExpanded) return null;

  const progressPercent = safeDuration > 0 ? (safeCurrentTime / safeDuration) * 100 : 0;

  return (
    <motion.div
      id="full-player-view"
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 280, mass: 0.8 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 400) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-[60] flex flex-col select-none overflow-hidden bg-[#0a0a0a] transform-gpu"
      style={{ touchAction: 'none', WebkitUserSelect: 'none', willChange: 'transform, opacity' }}
    >
      {/* 1. Background Layer: Blurred Album Art (Optimizado para iOS) */}
      <div
        className="absolute inset-0 z-0 opacity-70 transition-all duration-1000 ease-out transform-gpu pointer-events-none"
        style={{
          backgroundImage: currentSong.cover ? `url(${currentSong.cover})` : gradient,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(32px) brightness(0.5)',
          willChange: 'transform',
          transform: 'scale(1.15) translateZ(0)'
        }}
      />

      {/* 2. Fluid Wave Integration (Optimizado: removido mix-blend-screen que causaba lag severo en iOS) */}
      <div className="absolute inset-0 z-0 opacity-90 pointer-events-none transform-gpu" style={{ transform: 'translateZ(0)' }}>
        <WaveBackground
          bassLevel={bassLevel}
          midLevel={midLevel}
          primaryRgb={primaryRgb}
          secondaryRgb={secondaryRgb}
          isPlaying={isPlaying}
        />
      </div>

      {/* 3. Gradient Overlay for contrast and OLED true blacks */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />

      {/* 4. Main Content Area */}
      <div className="relative z-10 flex flex-col h-full w-full max-w-xl mx-auto pt-safe pb-safe">
        
        {/* Top Header - Glass pill */}
        <div className="flex items-center justify-between px-6 py-4 mt-2">
          <button
            onClick={handleClose}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-white/20 active:scale-95 transition-all shadow-lg"
          >
            <ChevronDown size={28} />
          </button>
          
          <div className="flex flex-col items-center justify-center px-6 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]">
            <span className="text-[10px] font-black text-white/60 tracking-[0.2em] uppercase">Now Playing</span>
            {isSyncReady && (
              <div className="flex items-center gap-1.5 mt-0.5 text-yellow-400">
                <Zap size={12} className="fill-current" />
                <span className="text-[10px] font-bold tracking-wider">SYNC ON</span>
              </div>
            )}
          </div>
          
          <button className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-white/20 active:scale-95 transition-all shadow-lg">
            <MoreHorizontal size={24} />
          </button>
        </div>

        {/* Center Album Art Stage */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 min-h-0 w-full relative group">
          <motion.div 
            className="relative w-full max-w-[360px] aspect-square rounded-[36px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] border border-white/10"
            animate={{ scale: isPlaying ? 1 : 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          >
            {currentSong.cover ? (
              <img
                src={currentSong.cover}
                alt={currentSong.title}
                className="w-full h-full object-cover"
                draggable="false"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: gradient }}
              >
                <Music size={100} className="text-white/30" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Bottom Glassmorphic Control Panel */}
        <div 
          className="w-full bg-black/40 backdrop-blur-lg rounded-t-[48px] border-t border-white/10 px-6 sm:px-8 pt-8 pb-10 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden transform-gpu"
          style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        >
          
          {/* Subtle top reflection */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Track Info */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col min-w-0 pr-4">
              <h2 className="text-3xl font-black text-white truncate tracking-tight mb-1 drop-shadow-md">
                {currentSong.title}
              </h2>
              <p className="text-lg text-white/60 font-medium truncate drop-shadow-sm">
                {currentSong.artist}
              </p>
            </div>
            
            <div className="flex flex-col items-end shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/5 flex flex-col items-center">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Phase</span>
                <span className="text-sm font-bold text-white uppercase tracking-tighter shadow-sm">{djPhase}</span>
              </div>
            </div>
          </div>

          {/* Scrubber / Progress */}
          <div className="mb-8 relative group cursor-pointer">
            <input
              type="range"
              min="0"
              max={safeDuration || 0}
              step="0.1"
              value={safeCurrentTime}
              onChange={handleSeek}
              disabled={!hasSong || safeDuration <= 0 || isTransitioning}
              aria-label="Progreso de reproducción"
              className="absolute w-full h-full opacity-0 cursor-pointer z-10"
            />
            {/* Custom Slider Track */}
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full relative transition-all duration-100 ease-linear"
                style={{ width: `${progressPercent}%` }}
              >
                {/* Glow effect on the active track */}
                <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white opacity-50 blur-sm" />
              </div>
            </div>
            
            <div className="flex justify-between mt-3 px-1">
              <span className="text-[11px] font-semibold text-white/50 tracking-wider tabular-nums">
                {formatTime(safeCurrentTime)}
              </span>
              <span className="text-[11px] font-semibold text-white/50 tracking-wider tabular-nums">
                {formatTime(safeDuration)}
              </span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between px-2 mb-8">
            <button
              type="button"
              aria-label="Aleatorio"
              className="text-white/40 hover:text-white active:scale-90 transition-all"
            >
              <Shuffle size={24} />
            </button>

            <div className="flex items-center gap-6 sm:gap-8">
              <button
                type="button"
                onClick={previousSong}
                disabled={!canGoPrevious}
                aria-label="Canción anterior"
                className="text-white/80 hover:text-white active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipBack size={36} className="fill-current" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!canPlayPause}
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                className="w-20 h-20 flex items-center justify-center bg-white rounded-full text-black hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <Pause size={36} className="fill-current" />
                ) : (
                  <Play size={36} className="fill-current ml-2" />
                )}
              </button>

              <button
                type="button"
                onClick={nextSong}
                disabled={!canGoNext}
                aria-label="Siguiente canción"
                className="text-white/80 hover:text-white active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipForward size={36} className="fill-current" />
              </button>
            </div>

            <button
              type="button"
              aria-label="Cola de reproducción"
              className="text-white/40 hover:text-white active:scale-90 transition-all"
            >
              <ListMusic size={24} />
            </button>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-center gap-8 text-white/30">
            <button className="hover:text-white active:scale-95 transition-all flex items-center gap-2">
              <Mic2 size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">Letras</span>
            </button>
          </div>

        </div>
      </div>
    </motion.div>
  );
};
