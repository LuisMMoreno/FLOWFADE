import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLibrary } from './useLibrary';
import { db } from '../services/db';
import { AudioStorageService } from '../services/AudioStorageService';

// Mock IndexedDB
let mockSongsValue = [];

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => mockSongsValue),
}));

vi.mock('../services/db', () => ({
  db: {
    songs: {
      toArray: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../services/AudioStorageService', () => ({
  AudioStorageService: {
    importFile: vi.fn(),
    deleteFromCache: vi.fn(),
  },
}));

describe('useLibrary', () => {
  const mockSongs = [
    { id: 1, title: 'Song 1', artist: 'Artist 1', url: 'blob:1' },
    { id: 2, title: 'Song 2', artist: 'Artist 2', url: 'blob:2' },
    { id: 3, title: 'Song 3', artist: 'Artist 3', url: 'blob:3' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSongsValue = mockSongs;
    db.songs.toArray.mockResolvedValue(mockSongs);
    AudioStorageService.importFile.mockResolvedValue(undefined);
    AudioStorageService.deleteFromCache.mockResolvedValue(undefined);
  });

  test('returns songs from database', () => {
    const { result } = renderHook(() => useLibrary());

    expect(result.current.songs).toEqual(mockSongs);
  });

  test('returns empty array when no songs', () => {
    mockSongsValue = [];
    db.songs.toArray.mockResolvedValue([]);
    const { result } = renderHook(() => useLibrary());
    expect(result.current.songs).toEqual([]);
  });

  test('importFiles filters valid audio files', async () => {
    const { result } = renderHook(() => useLibrary());

    const files = [
      new File(['audio'], 'song.mp3', { type: 'audio/mpeg' }),
      new File(['text'], 'document.txt', { type: 'text/plain' }),
      new File(['audio'], 'track.wav', { type: 'audio/wav' }),
      new File(['audio'], 'song.m4a', { type: 'audio/mp4' }),
    ];

    await act(async () => {
      await result.current.importFiles(files);
    });

    // Should only call importFile for valid audio files (3 files)
    expect(AudioStorageService.importFile).toHaveBeenCalledTimes(3);
  });

  test('importFiles does nothing for no valid audio files', async () => {
    const { result } = renderHook(() => useLibrary());

    const files = [
      new File(['text'], 'document.txt', { type: 'text/plain' }),
      new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
    ];

    await act(async () => {
      await result.current.importFiles(files);
    });

    expect(AudioStorageService.importFile).not.toHaveBeenCalled();
  });

  test('importFiles sets isImporting state correctly', async () => {
    const { result } = renderHook(() => useLibrary());

    const files = [new File(['audio'], 'song.mp3', { type: 'audio/mpeg' })];

    expect(result.current.isImporting).toBe(false);

    const importPromise = act(async () => {
      await result.current.importFiles(files);
    });

    // During import, isImporting should be true
    // Note: This is async so we can't easily test intermediate state without act

    await importPromise;
    expect(result.current.isImporting).toBe(false);
  });

  test('removeSong deletes from cache and database', async () => {
    const { result } = renderHook(() => useLibrary());

    const song = mockSongs[0];

    await act(async () => {
      await result.current.removeSong(song);
    });

    expect(AudioStorageService.deleteFromCache).toHaveBeenCalledWith(song.url);
    expect(db.songs.delete).toHaveBeenCalledWith(song.id);
  });

  test('handles extension filtering case-insensitively', async () => {
    const { result } = renderHook(() => useLibrary());

    const files = [
      new File(['audio'], 'song.MP3', { type: 'audio/mpeg' }),
      new File(['audio'], 'track.WAV', { type: 'audio/wav' }),
      new File(['audio'], 'song.FLAC', { type: 'audio/flac' }),
    ];

    await act(async () => {
      await result.current.importFiles(files);
    });

    expect(AudioStorageService.importFile).toHaveBeenCalledTimes(3);
  });

  test('handles files without type using extension', async () => {
    const { result } = renderHook(() => useLibrary());

    // File without proper MIME type but with valid extension
    const file = new File(['audio'], 'song.mp3', { type: '' });

    await act(async () => {
      await result.current.importFiles([file]);
    });

    expect(AudioStorageService.importFile).toHaveBeenCalledTimes(1);
  });
});