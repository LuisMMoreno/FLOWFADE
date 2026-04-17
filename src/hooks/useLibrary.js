import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { AudioStorageService } from '../services/AudioStorageService';
import { useState } from 'react';

/**
 * Hook para gestionar la biblioteca musical.
 */
export function useLibrary() {
  const [isImporting, setIsImporting] = useState(false);
  
  // Consulta reactiva a la base de datos
  const songs = useLiveQuery(() => db.songs.toArray()) || [];

  /**
   * Importa múltiples archivos y actualiza el estado.
   */
  const importFiles = async (files) => {
    setIsImporting(true);
    try {
      const validExtensions = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'];
      const audioFiles = Array.from(files).filter(f => {
        const extension = f.name.split('.').pop().toLowerCase();
        return f.type.startsWith('audio/') || validExtensions.includes(extension);
      });
      
      if (audioFiles.length === 0) {
        console.warn('No se detectaron archivos de audio válidos.');
        return;
      }

      for (const file of audioFiles) {
        await AudioStorageService.importFile(file);
      }
    } catch (error) {
      console.error('Error en la importación masiva:', error);
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Elimina una canción de la biblioteca y de la cache.
   */
  const removeSong = async (song) => {
    await AudioStorageService.deleteFromCache(song.url);
    await db.songs.delete(song.id);
  };

  return {
    songs,
    isImporting,
    importFiles,
    removeSong
  };
}
