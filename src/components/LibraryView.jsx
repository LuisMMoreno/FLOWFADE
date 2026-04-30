import React, { useRef } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { usePlayback } from '../hooks/usePlayback';
import { Plus, Music, Play, Trash2, Clock, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LibraryView = () => {
  const { songs, isImporting, importFiles, removeSong } = useLibrary();
  const { playFromList, currentSong, isPlaying, isTransitioning } = usePlayback();
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      importFiles(e.target.files);
    }
  };

  const handlePlaySong = (index) => {
    if (isTransitioning) return;
    playFromList(songs, index);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-surface to-background overflow-hidden safe-pt">
      <header className="px-6 py-8 md:px-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6 transition-all">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-primary/80 font-bold mb-2">
            Tu Colección
          </h2>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-none">
            Biblioteca
          </h1>
        </div>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="flex items-center justify-center gap-3 bg-white hover:bg-white/90 text-black font-bold px-6 py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 w-full sm:w-auto shadow-xl"
        >
          <Plus size={22} className="shrink-0" />
          <span className="text-base">{isImporting ? 'Importando...' : 'Añadir música'}</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          multiple 
          accept="audio/*, .mp3, .m4a, .wav, .aac" 
          className="hidden" 
        />
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-[140px] scroll-smooth">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-white/10 rounded-3xl text-center">
            <Music size={48} className="text-white/40 mb-4" />
            <p className="text-white/60 font-medium">Tu biblioteca está vacía.</p>
            <p className="text-white/40 text-sm mt-1">Añade algunos archivos de audio.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-8">
              <AnimatePresence>
                {songs.map((song, index) => {
                  const isCurrent = currentSong?.id === song.id;
                  return (
                    <motion.div 
                      key={song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => handlePlaySong(index)}
                      className={`group flex items-center justify-between p-3 rounded-2xl transition-all active:scale-[0.98] ${isTransitioning ? 'cursor-wait opacity-70' : 'cursor-pointer hover:bg-white/5'} ${isCurrent ? 'bg-white/10 shadow-lg' : ''}`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden shadow-md flex items-center justify-center bg-white/5">
                          {song.cover ? (
                            <img src={song.cover} alt={song.title} className="w-full h-full object-cover" />
                          ) : (
                            <Music size={24} className="text-white/40" />
                          )}
                          
                          {/* Play overlay */}
                          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm transition-opacity ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {isCurrent && isPlaying ? (
                              <Pause size={24} className="text-white fill-white" />
                            ) : (
                              <Play size={24} className="text-white fill-white" style={{ marginLeft: '3px' }} />
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col flex-1 min-w-0 justify-center">
                          <p className={`text-base font-bold truncate tracking-tight ${isCurrent ? 'text-primary' : 'text-white'}`}>
                            {song.title}
                          </p>
                          <p className="text-sm text-white/60 truncate font-medium mt-0.5">
                            {song.artist}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center shrink-0 ml-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSong(song);
                          }}
                          className="w-12 h-12 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all active:scale-90"
                          aria-label="Eliminar canción"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
        )}
      </div>
    </div>
  );
};
