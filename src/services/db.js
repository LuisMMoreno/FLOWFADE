import Dexie from 'dexie';

export const db = new Dexie('FlowfadeDB');

db.version(2).stores({
  songs: '++id, title, artist, album, format, addedAt, analyzed, bpm, energy, key',
  playlists: '++id, name',
  settings: 'key'
});

/**
 * Servicio para gestionar la persistencia de canciones y metadatos.
 */
export const SongService = {
  async addSong(songData) {
    return await db.songs.add({
      ...songData,
      analyzed: false,
      bpm: 0,
      energy: 0,
      addedAt: Date.now()
    });
  },

  async updateSong(id, updates) {
    return await db.songs.update(id, updates);
  },

  async getSong(id) {
    return await db.songs.get(id);
  },

  async getAllSongs() {
    return await db.songs.toArray();
  },

  async getUnanalyzedSongs() {
    return await db.songs.where('analyzed').equals(0).toArray();
  },

  async deleteSong(id) {
    return await db.songs.delete(id);
  }
};
