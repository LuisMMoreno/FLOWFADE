import { useContext } from 'react';
import { PlaybackContext } from '../store/PlaybackContext';

/**
 * Hook para acceder al estado y funciones de reproducción global.
 */
export function usePlayback() {
  const context = useContext(PlaybackContext);
  
  if (!context) {
    throw new Error('usePlayback debe usarse dentro de un PlaybackProvider');
  }

  return context;
}
