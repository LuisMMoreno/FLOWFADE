import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePlayback } from '../hooks/usePlayback';
import { useAlbumColors } from '../hooks/useAlbumColors';
import { useAudioAnalyser } from '../hooks/useAudioAnalyser';
import { WaveBackground } from './WaveBackground';
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
  Wand2,
  Activity
} from 'lucide-react';

/**
 * Vista de pantalla completa "Now Playing".
 * Se expande desde el MiniPlayer con animación.
 */
export const FullPlayerView = () => {
  const {
    currentSong,
    isPlaying,
    queue,
    currentTime,
    duration,
    isTransitioning,
    isPlayerExpanded,
    isDJMode,
    toggleDJMode,
    setIsPlayerExpanded,
    togglePlay,
    nextSong,
    previousSong,
    seekTo
  } = usePlayback();

  // Extracción de colores del álbum
  const {
    primaryColor,
    secondaryColor,
    primaryRgb,
    secondaryRgb,
    gradient
  } = useAlbumColors(currentSong?.cover || null);

  // Análisis de audio
  const { bassLevel, midLevel } = useAudioAnalyser(isPlayerExpanded, isPlaying);

  const currentIndex = useMemo(() => {
    if (!currentSong || !Array.isArray(queue)) return -1;
    return queue.findIndex((song) => song.id === currentSong.id);
  }, [currentSong, queue]);

  const hasSong = Boolean(currentSong);
  const canPlayPause = hasSong && !isTransitioning;
  const canGoPrevious = currentIndex > 0 && !isTransitioning;
  const canGoNext = (currentIndex !== -1 && currentIndex < queue.length - 1 || isDJMode) && !isTransitioning;
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
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{
        type: 'spring',
        damping: 32,
        stiffness: 300,
        mass: 0.8
      }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 400) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-[60] flex flex-col select-none overflow-hidden"
      style={{
        touchAction: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {/* === Capa 1: Carátula desenfocada de fondo === */}
      <div
        className="fullplayer-bg-blur"
        style={{
          backgroundImage: currentSong.cover
            ? `url(${currentSong.cover})`
            : gradient
        }}
      />

      {/* === Capa 2: Ondas de fluido === */}
      <WaveBackground
        bassLevel={bassLevel}
        midLevel={midLevel}
        primaryRgb={primaryRgb}
        secondaryRgb={secondaryRgb}
        isPlaying={isPlaying}
      />

      {/* === Capa 3: Overlay glassmorphism === */}
      <div className="fullplayer-glass-overlay" style={{ zIndex: 2 }} />

      {/* === Capa 4: Contenido === */}
      <div
        className="relative flex flex-col h-full"
        style={{
          zIndex: 3,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        {/* --- Drag Handle & Close Button --- */}
        <div className="flex items-center justify-center px-6 pt-2 pb-4">
          <button
            onClick={handleClose}
            className="absolute left-6 p-2 text-white/60 hover:text-white transition-colors"
            style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Cerrar reproductor"
          >
            <ChevronDown size={28} />
          </button>

          {/* Pill drag indicator */}
          <div
            style={{
              width: '40px',
              height: '5px',
              borderRadius: '3px',
              background: 'rgba(255, 255, 255, 0.3)'
            }}
          />

          <div className="absolute right-6 text-white/40 text-xs font-medium uppercase tracking-wider">
            Now Playing
          </div>
        </div>

        {/* --- Album Art --- */}
        <div className="flex-1 flex items-center justify-center px-8 min-h-0">
          <div
            className="album-art-shadow gpu-accelerated"
            style={{
              width: '100%',
              maxWidth: '320px',
              aspectRatio: '1 / 1',
              borderRadius: '24px',
              overflow: 'hidden',
              flexShrink: 0,
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
                <Music size={80} className="text-white/30" />
              </div>
            )}
          </div>
        </div>

        {/* --- Song Info --- */}
        <div className="px-8 pt-6 pb-2 relative">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h2
                className="text-2xl font-bold text-white truncate"
                style={{ lineHeight: '1.2' }}
              >
                {currentSong.title}
              </h2>
              <p className="text-base text-white/60 truncate mt-1 font-medium">
                {currentSong.artist}
              </p>
            </div>
            
            {currentSong.bpm > 0 && (
              <div className="flex flex-col items-end text-white/40 ml-4">
                <span className="text-xs font-bold tracking-tighter flex items-center gap-1">
                  <Activity size={10} />
                  {currentSong.bpm}
                </span>
                <span className="text-[8px] uppercase tracking-widest font-bold">BPM</span>
              </div>
            )}
          </div>
        </div>

        {/* --- Progress Slider --- */}
        <div className="px-8 pt-4 pb-2">
          <input
            type="range"
            min="0"
            max={safeDuration || 0}
            step="0.1"
            value={safeCurrentTime}
            onChange={handleSeek}
            disabled={!hasSong || safeDuration <= 0 || isTransitioning}
            aria-label="Progreso de reproducción"
            className="fullplayer-slider"
            style={{
              '--player-progress': `${progressPercent}%`
            }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-white/50 font-medium tabular-nums">
              {formatTime(safeCurrentTime)}
            </span>
            <span className="text-xs text-white/50 font-medium tabular-nums">
              {formatTime(safeDuration)}
            </span>
          </div>
        </div>

        {/* --- Transport Controls --- */}
        <div className="flex items-center justify-center px-8 py-4" style={{ gap: '32px' }}>
          {/* Previous */}
          <button
            type="button"
            onClick={previousSong}
            disabled={!canGoPrevious}
            aria-label="Canción anterior"
            className="flex items-center justify-center text-white hover:text-white/80 active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ width: '44px', height: '44px' }}
          >
            <SkipBack size={28} className="fill-current" />
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canPlayPause}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            className="flex items-center justify-center bg-white rounded-full text-black hover:scale-105 active:scale-95 transition-all shadow-2xl disabled:bg-white/70 disabled:text-black/60 disabled:cursor-not-allowed"
            style={{ width: '64px', height: '64px' }}
          >
            {isPlaying ? (
              <Pause size={30} className="fill-current" />
            ) : (
              <Play size={30} className="fill-current" style={{ marginLeft: '3px' }} />
            )}
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={nextSong}
            disabled={!canGoNext}
            aria-label="Siguiente canción"
            className="flex items-center justify-center text-white hover:text-white/80 active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ width: '44px', height: '44px' }}
          >
            <SkipForward size={28} className="fill-current" />
          </button>
        </div>

        {/* --- Utility Buttons --- */}
        <div className="flex items-center justify-center px-8 pb-4" style={{ gap: '48px' }}>
          <button
            type="button"
            onClick={toggleDJMode}
            aria-label="Modo DJ"
            className={`flex flex-col items-center justify-center transition-all ${isDJMode ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
            style={{ width: '44px', height: '44px' }}
          >
            <Wand2 size={20} className={isDJMode ? 'animate-pulse' : ''} />
            <span className="text-[8px] font-bold mt-1 uppercase tracking-tighter">Auto DJ</span>
          </button>
          <button
            type="button"
            aria-label="Letras"
            className="flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            style={{ width: '44px', height: '44px' }}
          >
            <Mic2 size={20} />
          </button>
          <button
            type="button"
            aria-label="Cola de reproducción"
            className="flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            style={{ width: '44px', height: '44px' }}
          >
            <ListMusic size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
