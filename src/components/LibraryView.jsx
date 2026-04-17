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
      <header className="px-6 py-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6 transition-all">
        <div>
          <h2 className="text-[10px] md:text-sm uppercase tracking-[0.2em] text-primary font-bold mb-1 md:mb-2 opacity-90">
            Tu Colección
          </h2>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
            Biblioteca
          </h1>
        </div>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="flex items-center justify-center space-x-2 bg-primary hover:bg-primary/80 text-black font-bold px-5 md:px-8 py-3 md:py-4 rounded-full transition-all active:scale-95 disabled:opacity-50 w-full md:w-auto shadow-xl"
        >
          <Plus size={20} />
          <span className="text-sm md:text-base">{isImporting ? 'Importando...' : 'Añadir música'}</span>
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

      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-32">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-accent/20 rounded-3xl">
            <Music size={48} className="text-accent mb-4" />
            <p className="text-accent">Tu biblioteca está vacía. Añade algunos archivos .mp3</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-accent border-b border-accent/10 text-xs uppercase tracking-widest">
                <th className="py-3 font-medium w-12">#</th>
                <th className="py-3 font-medium">Título</th>
                <th className="py-3 font-medium hidden md:table-cell">Álbum</th>
                <th className="py-3 font-medium text-right pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {songs.map((song, index) => {
                  const isCurrent = currentSong?.id === song.id;
                  return (
                    <motion.tr 
                      key={song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onClick={() => handlePlaySong(index)}
                      className={`group hover:bg-white/5 transition-colors rounded-lg overflow-hidden ${isTransitioning ? 'cursor-wait opacity-70' : 'cursor-pointer'} ${isCurrent ? 'bg-white/5' : ''}`}
                    >
                      <td className="py-3 text-accent text-sm">
                        <div className="relative w-8 h-8 flex items-center justify-center">
                          {isCurrent && isPlaying ? (
                             <Pause size={16} className="text-primary fill-primary" />
                          ) : isCurrent ? (
                             <Play size={16} className="text-primary fill-primary" />
                          ) : (
                            <>
                              <span className="group-hover:hidden">{index + 1}</span>
                              <Play size={16} className="hidden group-hover:block text-white fill-white" />
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center space-x-3">
                          {song.cover ? (
                            <img src={song.cover} alt={song.title} className="w-10 h-10 rounded shadow-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-accent/20 rounded flex items-center justify-center">
                              <Music size={16} className="text-accent" />
                            </div>
                          )}
                          <div>
                            <p className={`text-sm font-medium line-clamp-1 ${isCurrent ? 'text-primary' : 'text-white'}`}>{song.title}</p>
                            <p className="text-xs text-accent line-clamp-1">{song.artist}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-accent text-sm hidden md:table-cell">
                        {song.album}
                      </td>
                      <td className="py-3 text-right pr-4">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSong(song);
                          }}
                          className="p-2 text-accent hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
