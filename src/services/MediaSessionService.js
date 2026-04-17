/**
 * Servicio para gestionar la API de Media Session.
 * Permite controlar la reproducción desde la pantalla de bloqueo y centro de control.
 */
export const MediaSessionService = {
  /**
   * Actualiza los metadatos de la sesión de medios actual.
   * @param {Object} song - Objeto de la canción actual.
   * @param {Function} handlers - Objeto con handlers para acciones (play, pause, next, prev).
   */
  updateMetadata(song, handlers) {
    if (!('mediaSession' in navigator)) return;

    const { title, artist, album, cover } = song;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'Canción Desconocida',
      artist: artist || 'Artista Desconocido',
      album: album || 'Flowfade Library',
      artwork: cover ? [
        { src: cover, sizes: '512x512', type: 'image/png' }
      ] : [
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }
      ]
    });

    // Configurar controladores de acción
    this.setupHandlers(handlers);
  },

  clearMetadata() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = null;
    this.setupHandlers({});
    this.updatePlaybackState('none');
  },

  /**
   * Configura los manejadores de eventos para la pantalla de bloqueo.
   */
  setupHandlers(handlers) {
    if (!('mediaSession' in navigator)) return;

    const actions = [
      ['play', handlers.onPlay],
      ['pause', handlers.onPause],
      ['previoustrack', handlers.onPrevious],
      ['nexttrack', handlers.onNext],
      ['seekbackward', handlers.onSeekBackward],
      ['seekforward', handlers.onSeekForward],
    ];

    for (const [action, handler] of actions) {
      try {
        if (handler) {
          navigator.mediaSession.setActionHandler(action, handler);
        } else {
          navigator.mediaSession.setActionHandler(action, null);
        }
      } catch (error) {
        console.warn(`MediaSession action "${action}" no soportada.`, error);
      }
    }
  },

  /**
   * Actualiza el estado de reproducción (playing, paused, none).
   */
  updatePlaybackState(state) {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = state;
    } catch (error) {
      console.warn('No se pudo actualizar mediaSession.playbackState.', error);
    }
  },

  updatePositionState({ duration, currentTime }) {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;

    try {
      if (!Number.isFinite(duration) || duration <= 0) return;

      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(currentTime, duration)
      });
    } catch (error) {
      console.warn('No se pudo actualizar mediaSession.setPositionState.', error);
    }
  }
};
