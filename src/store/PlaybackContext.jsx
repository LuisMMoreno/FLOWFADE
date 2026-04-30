import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { audioEngine } from '../services/AudioEngine';
import { MediaSessionService } from '../services/MediaSessionService';
import { djEngine } from '../services/DJEngine';
import { audioAnalysisService } from '../services/AudioAnalysisService';

export const PlaybackContext = createContext();

let globalQueue = [];
let globalCurrentIndex = -1;

export const PlaybackProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(globalQueue[globalCurrentIndex] || null);
  const [isPlaying, setIsPlaying] = useState(audioEngine.isPlaying);
  const [queue, setQueue] = useState(globalQueue);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isDJMode, setIsDJMode] = useState(true); // DJ Mode activado por defecto

  const currentSongRef = useRef(currentSong);
  const transitionTokenRef = useRef(0);
  const commandChainRef = useRef(Promise.resolve());

  // Iniciar análisis en segundo plano al cargar el proveedor
  useEffect(() => {
    audioAnalysisService.analyzeQueue();
  }, [queue.length]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const toggleDJMode = useCallback(() => {
    setIsDJMode(prev => !prev);
  }, []);

  const syncFromEngine = useCallback(() => {
    const snapshot = audioEngine.getPlaybackSnapshot();
    setCurrentTime(snapshot.currentTime);
    setDuration(snapshot.duration);
    setIsPlaying(audioEngine.isPlaying);
  }, []);

  useEffect(() => {
    const handleProgress = (event) => {
      const snapshot = event.detail;
      setCurrentTime(snapshot.currentTime);
      setDuration(snapshot.duration);
      setIsPlaying(snapshot.isPlaying);
    };

    window.addEventListener('flowfade:playback-progress', handleProgress);
    return () => window.removeEventListener('flowfade:playback-progress', handleProgress);
  }, []);

  const syncMediaSessionState = useCallback((playing) => {
    MediaSessionService.updatePlaybackState(playing ? 'playing' : 'paused');
  }, []);

  const enqueueCommand = useCallback((command) => {
    const token = ++transitionTokenRef.current;
    setIsTransitioning(true);

    const run = async () => {
      try {
        await command(token);
      } finally {
        if (token === transitionTokenRef.current) {
          setIsTransitioning(false);
        }
      }
    };

    commandChainRef.current = commandChainRef.current
      .catch(() => {})
      .then(run);

    return commandChainRef.current;
  }, []);

  const playAtIndex = useCallback(async (songList, index, transition = false) => {
    if (!songList[index]) return false;

    globalQueue = [...songList];
    globalCurrentIndex = index;
    setQueue(globalQueue);

    const song = globalQueue[globalCurrentIndex];
    let didPlay = false;

    if (transition && isDJMode) {
      const plan = djEngine.getTransitionPlan(currentSongRef.current, song);
      didPlay = await audioEngine.transitionTo(song, plan);
    } else {
      didPlay = await audioEngine.play(song);
    }

    if (!didPlay) return false;

    setCurrentSong(song);
    syncMediaSessionState(true);
    return true;
  }, [isDJMode, syncMediaSessionState]);

  const stopPlayback = useCallback(() => {
    audioEngine.stopAll();
    globalCurrentIndex = -1;
    setCurrentSong(null);
    syncMediaSessionState(false);
    MediaSessionService.clearMetadata();
  }, [syncMediaSessionState]);

  const nextSong = useCallback(() => enqueueCommand(async (token) => {
    let nextIndex = globalCurrentIndex + 1;
    let nextSong = globalQueue[nextIndex];

    if (isDJMode) {
      nextSong = djEngine.selectNextTrack(currentSongRef.current, globalQueue);
      nextIndex = globalQueue.findIndex(s => s.id === nextSong?.id);
    }

    if (!nextSong) {
      stopPlayback();
      return;
    }

    const didPlay = await playAtIndex(globalQueue, nextIndex, true);
    if (!didPlay || token !== transitionTokenRef.current) return;
  }), [enqueueCommand, isDJMode, playAtIndex, stopPlayback]);

  const autoNext = useCallback(() => enqueueCommand(async (token) => {
    if (isTransitioning) return;

    let nextSong = null;
    let nextIndex = -1;

    if (isDJMode) {
      nextSong = djEngine.selectNextTrack(currentSongRef.current, globalQueue);
      nextIndex = globalQueue.findIndex(s => s.id === nextSong?.id);
    } else {
      nextIndex = globalCurrentIndex + 1;
      nextSong = globalQueue[nextIndex];
    }

    if (!nextSong) return;

    await playAtIndex(globalQueue, nextIndex, true);
  }), [enqueueCommand, isDJMode, isTransitioning, playAtIndex]);

  const previousSong = useCallback(() => enqueueCommand(async (token) => {
    const previousIndex = globalCurrentIndex - 1;
    if (previousIndex < 0) return;

    const didPlay = await playAtIndex(globalQueue, previousIndex, false);
    if (!didPlay || token !== transitionTokenRef.current) return;
  }), [enqueueCommand, playAtIndex]);

  const togglePlay = useCallback(async () => {
    if (audioEngine.isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
      syncMediaSessionState(false);
    } else if (currentSongRef.current) {
      await audioEngine.resume();
      setIsPlaying(true);
      syncMediaSessionState(true);
    }
  }, [syncMediaSessionState]);

  const playFromList = useCallback((songList, index) => enqueueCommand(async (token) => {
    const didPlay = await playAtIndex(songList, index, false);
    if (!didPlay || token !== transitionTokenRef.current) return;
  }), [enqueueCommand, playAtIndex]);

  const seekTo = useCallback((timeInSeconds) => {
    audioEngine.seek(timeInSeconds);
    syncFromEngine();
  }, [syncFromEngine]);

  const setVolume = useCallback((value) => {
    audioEngine.setVolume(value);
    setVolumeState(value);
  }, []);

  useEffect(() => {
    if (currentSong) {
      MediaSessionService.updateMetadata(currentSong, {
        onPlay: togglePlay,
        onPause: togglePlay,
        onNext: nextSong,
        onPrevious: previousSong
      });
      syncMediaSessionState(isPlaying);
    }
  }, [currentSong, isPlaying, nextSong, previousSong, togglePlay, syncMediaSessionState]);

  useEffect(() => {
    audioEngine.setOnEnded(() => {
      nextSong();
    });

    audioEngine.setOnAlmostEnded(() => {
      autoNext();
    });

    return () => {
      audioEngine.setOnEnded(null);
      audioEngine.setOnAlmostEnded(null);
    };
  }, [autoNext, nextSong]);

  const value = {
    currentSong,
    isPlaying,
    queue,
    currentTime,
    duration,
    volume,
    isTransitioning,
    isPlayerExpanded,
    isDJMode,
    setIsPlayerExpanded,
    toggleDJMode,
    playFromList,
    nextSong,
    previousSong,
    togglePlay,
    seekTo,
    setVolume
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
};

