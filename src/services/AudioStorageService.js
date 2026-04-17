import jsmediatags from 'jsmediatags';
import { SongService } from './db';

// Fallback para resolución de jsmediatags en diferentes entornos (Vite/Browser)
const getJsMediaTags = () => {
  if (window.jsmediatags) return window.jsmediatags;
  if (jsmediatags && jsmediatags.read) return jsmediatags;
  if (jsmediatags && jsmediatags.default && jsmediatags.default.read) return jsmediatags.default;
  return jsmediatags;
};

const AUDIO_CACHE_NAME = 'flowfade-songs-v1';

/**
 * Orquestador de almacenamiento de audio (Cache API + IndexedDB).
 */
export const AudioStorageService = {
  /**
   * Importa un archivo de música, extrae metadatos y lo persiste localmente.
   * @param {File} file - El archivo seleccionado por el usuario.
   */
  async importFile(file) {
    console.log(`[AudioStorage] Iniciando importación: ${file.name} (${file.type || 'tipo desconocido'})`);
    
    return new Promise(async (resolve, reject) => {
      try {
        // 1. Extraer Metadatos
        const metadata = await this.extractMetadata(file);
        console.log(`[AudioStorage] Metadatos extraídos para: ${file.name}`);
        
        // 2. Guardar archivo binario en Cache API
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const songUrl = `/local-song/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        
        // Usamos Response con cabeceras explícitas para evitar problemas en iOS PWA
        const response = new Response(file, {
          headers: {
            'Content-Type': file.type || 'audio/mpeg',
            'Content-Length': file.size.toString()
          }
        });
        
        await cache.put(songUrl, response);
        console.log(`[AudioStorage] Archivo guardado en Cache API: ${songUrl}`);

        // 3. Guardar metadatos en IndexedDB
        const songId = await SongService.addSong({
          ...metadata,
          url: songUrl,
          format: file.type || 'audio/mpeg',
          size: file.size,
          fileName: file.name
        });
        console.log(`[AudioStorage] Registro completado en DB con ID: ${songId}`);

        resolve({ id: songId, ...metadata });
      } catch (error) {
        console.error('[AudioStorage] Error crítico en importación:', error);
        reject(error);
      }
    });
  },

  /**
   * Extrae metadatos ID3 de un archivo de audio.
   */
  async extractMetadata(file) {
    const fallback = {
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Artista Desconocido",
      album: "Álbum Desconocido",
      cover: null
    };

    return new Promise((resolve) => {
      const tags = getJsMediaTags();
      
      // Seguridad: Si la librería no cargó, usamos fallback inmediato
      if (!tags || typeof tags.read !== 'function') {
        console.warn("[AudioStorage] jsmediatags no disponible, usando fallback.");
        return resolve(fallback);
      }

      // Timeout de 3 segundos para evitar bloqueos en iOS
      const timeout = setTimeout(() => {
        console.warn("[AudioStorage] Timeout extrayendo metadatos, usando fallback.");
        resolve(fallback);
      }, 3000);

      try {
        tags.read(file, {
          onSuccess: (tag) => {
            clearTimeout(timeout);
            const { title, artist, album, picture } = tag.tags;
            let cover = null;

            if (picture) {
              try {
                const { data, format } = picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) {
                  base64String += String.fromCharCode(data[i]);
                }
                cover = `data:${format};base64,${window.btoa(base64String)}`;
              } catch (e) {
                console.warn("[AudioStorage] Error procesando portada:", e);
              }
            }

            resolve({
              title: title || fallback.title,
              artist: artist || fallback.artist,
              album: album || fallback.album,
              cover: cover
            });
          },
          onError: (error) => {
            clearTimeout(timeout);
            console.warn("[AudioStorage] Error ID3:", error.type, error.info);
            resolve(fallback);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        console.error("[AudioStorage] Error fatal en tags.read:", err);
        resolve(fallback);
      }
    });
  },

  /**
   * Obtiene el Blob de audio desde la Cache API.
   */
  async getAudioBlob(url) {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const response = await cache.match(url);
    if (!response) throw new Error("Audio no encontrado en cache.");
    return await response.blob();
  },

  /**
   * Obtiene todos los archivos de audio en cache para debugging/gestión.
   */
  async deleteFromCache(url) {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    return await cache.delete(url);
  }
};
