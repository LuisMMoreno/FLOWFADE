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
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-8 py-2 min-h-0 w-full relative group">
          <motion.div
            className="relative aspect-square rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
            animate={{ scale: isPlaying ? 1 : 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            style={{
              width: '100%',
              maxWidth: 'min(380px, 45vh)' // Garantiza que sea siempre un cuadro perfecto y no se achate
            }}
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

        {/* Bottom Floating Container */}
        <div className="w-full px-6 sm:px-8 pb-6 flex flex-col relative z-20">

          {/* Track Info (Left aligned) */}
          <div className="flex flex-col mb-6">
            <h2 className="text-[28px] sm:text-3xl font-black text-white truncate tracking-tight mb-0.5 drop-shadow-md">
              {currentSong.title}
            </h2>
            <p className="text-lg text-white/70 font-medium truncate drop-shadow-sm mb-3">
              {currentSong.artist}
            </p>


          </div>

          {/* Scrubber / Progress */}
          <div className="mb-6 relative group cursor-pointer py-2">
            <input
              type="range"
              min="0"
              max={safeDuration || 0}
              step="0.1"
              value={safeCurrentTime}
              onChange={handleSeek}
              disabled={!hasSong || safeDuration <= 0 || isTransitioning}
              aria-label="Progreso de reproducción"
              className="absolute w-full h-full opacity-0 cursor-pointer z-10 top-0 left-0"
            />
            {/* Custom Slider Track */}
            <div className="relative h-2 w-full bg-white/20 rounded-full">
              <div
                className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-100 ease-linear"
                style={{ width: `${progressPercent}%` }}
              ></div>
              <div
                className="absolute top-1/2 -mt-2 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-100 ease-linear"
                style={{ left: `calc(${progressPercent}% - 8px)` }}
              ></div>
            </div>

            <div className="flex justify-between mt-2">
              <span className="text-xs font-bold text-white tracking-wide tabular-nums drop-shadow-sm">
                {formatTime(safeCurrentTime)}
              </span>
              <span className="text-xs font-bold text-white tracking-wide tabular-nums drop-shadow-sm">
                {formatTime(safeDuration)}
              </span>
            </div>
          </div>

          {/* Glassmorphic Transport Controls Dock */}
          <div className="w-full bg-white/10 backdrop-blur-xl rounded-[32px] border border-white/10 px-5 sm:px-6 py-5 mb-6 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            {/* Shuffle */}
            <button
              type="button"
              aria-label="Aleatorio"
              className="flex flex-col items-center gap-1.5 text-white/60 hover:text-white active:scale-90 transition-all"
            >
              <Shuffle size={20} />
              <span className="text-[10px] font-medium tracking-wide">Shuffle</span>
            </button>

            {/* Previous */}
            <button
              type="button"
              onClick={previousSong}
              disabled={!canGoPrevious}
              aria-label="Canción anterior"
              className="flex flex-col items-center gap-1.5 text-white/90 hover:text-white active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipBack size={24} className="fill-current" />
              <span className="text-[10px] font-medium tracking-wide">Previous</span>
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={!canPlayPause}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
              className="w-[68px] h-[68px] flex items-center justify-center bg-white rounded-full text-black hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPlaying ? (
                <Pause size={30} className="fill-current" />
              ) : (
                <Play size={30} className="fill-current ml-1.5" />
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={nextSong}
              disabled={!canGoNext}
              aria-label="Siguiente canción"
              className="flex flex-col items-center gap-1.5 text-white/90 hover:text-white active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipForward size={24} className="fill-current" />
              <span className="text-[10px] font-medium tracking-wide">Next</span>
            </button>

            {/* Playlist */}
            <button
              type="button"
              aria-label="Cola de reproducción"
              className="flex flex-col items-center gap-1.5 text-white/60 hover:text-white active:scale-90 transition-all"
            >
              <ListMusic size={20} />
              <span className="text-[10px] font-medium tracking-wide">Playlist</span>
            </button>
          </div>



        </div>
      </div>
    </motion.div>
  );
};
