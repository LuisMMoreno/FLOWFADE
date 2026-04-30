import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { audioEngine } from '../services/AudioEngine';
import { MediaSessionService } from '../services/MediaSessionService';

export const PlaybackContext = createContext();

let globalQueue = [];
let globalCurrentIndex = -1;

export const PlaybackProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(globalQueue[globalCurrentIndex] || null);
  const [isPlaying, setIsPlaying] = useState(audioEngine.isPlaying);
  const [queue, setQueue] = useState(globalQueue);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(audioEngine.getPlaybackSnapshot().volume);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

  const currentSongRef = useRef(currentSong);
  const transitionTokenRef = useRef(0);
  const commandChainRef = useRef(Promise.resolve());

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // Bloqueo de scroll cuando el FullPlayer está abierto
  useEffect(() => {
    if (isPlayerExpanded) {
      document.body.classList.add('body-scroll-locked');
    } else {
      document.body.classList.remove('body-scroll-locked');
    }
    return () => {
      document.body.classList.remove('body-scroll-locked');
    };
  }, [isPlayerExpanded]);

  const togglePlayerExpanded = useCallback(() => {
    setIsPlayerExpanded((prev) => !prev);
  }, []);

  const syncFromEngine = useCallback(() => {
    const snapshot = audioEngine.getPlaybackSnapshot();
    setCurrentTime(snapshot.currentTime);
    setDuration(snapshot.duration);
    setVolumeState(snapshot.volume);
    setIsPlaying(audioEngine.getIsActuallyPlaying());
  }, []);

  useEffect(() => {
    const eventName = audioEngine.getProgressEventName();
    const handleProgress = (event) => {
      const snapshot = event.detail || audioEngine.getPlaybackSnapshot();
      setCurrentTime(snapshot.currentTime);
      setDuration(snapshot.duration);
      setVolumeState(snapshot.volume);
      setIsPlaying(snapshot.isPlaying && audioEngine.getIsActuallyPlaying());
    };

    window.addEventListener(eventName, handleProgress);
    syncFromEngine();

    return () => {
      window.removeEventListener(eventName, handleProgress);
    };
  }, [syncFromEngine]);

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

  const playAtIndex = useCallback(async (songList, index, crossfade = false) => {
    if (!songList[index]) return false;

    globalQueue = [...songList];
    globalCurrentIndex = index;
    setQueue(globalQueue);

    const song = globalQueue[globalCurrentIndex];
    const didPlay = await audioEngine.play(song, crossfade);

    if (!didPlay) return false;

    setCurrentSong(song);
    syncFromEngine();
    syncMediaSessionState(true);
    return true;
  }, [syncFromEngine, syncMediaSessionState]);

  const stopPlayback = useCallback(() => {
    audioEngine.stopAll();
    globalCurrentIndex = -1;
    setCurrentSong(null);
    syncFromEngine();
    syncMediaSessionState(false);
    MediaSessionService.clearMetadata();
  }, [syncFromEngine, syncMediaSessionState]);

  const nextSong = useCallback(() => enqueueCommand(async (token) => {
    const nextIndex = globalCurrentIndex + 1;

    if (nextIndex >= globalQueue.length) {
      stopPlayback();
      return;
    }

    const didPlay = await playAtIndex(globalQueue, nextIndex, false);
    if (!didPlay || token !== transitionTokenRef.current) return;
  }), [enqueueCommand, playAtIndex, stopPlayback]);

  const autoNext = useCallback(() => enqueueCommand(async (token) => {
    const nextIndex = globalCurrentIndex + 1;

    if (nextIndex >= globalQueue.length) {
      return;
    }

    const didPlay = await playAtIndex(globalQueue, nextIndex, true);
    if (!didPlay || token !== transitionTokenRef.current) return;
  }), [enqueueCommand, playAtIndex]);

  const previousSong = useCallback(() => enqueueCommand(async (token) => {
    const previousIndex = globalCurrentIndex - 1;
    if (previousIndex < 0) return;

    const didPlay = await playAtIndex(globalQueue, previousIndex, false);
    if (!didPlay || token !== transitionTokenRef.current) return;
  }), [enqueueCommand, playAtIndex]);

  const pausePlayback = useCallback(() => enqueueCommand(async () => {
    const changed = audioEngine.pause();
    if (!changed) return;

    syncFromEngine();
    syncMediaSessionState(false);
  }), [enqueueCommand, syncFromEngine, syncMediaSessionState]);

  const resumePlayback = useCallback(() => enqueueCommand(async () => {
    if (!currentSongRef.current) return;

    const didResume = await audioEngine.unpause();
    if (!didResume) return;

    syncFromEngine();
    syncMediaSessionState(true);
  }), [enqueueCommand, syncFromEngine, syncMediaSessionState]);

  const togglePlay = useCallback(async () => {
    if (audioEngine.getIsActuallyPlaying()) {
      await pausePlayback();
    } else if (currentSongRef.current) {
      await resumePlayback();
    }
  }, [pausePlayback, resumePlayback]);

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
    syncFromEngine();
  }, [syncFromEngine]);

  useEffect(() => {
    if (currentSong) {
      MediaSessionService.updateMetadata(currentSong, {
        onPlay: resumePlayback,
        onPause: pausePlayback,
        onNext: nextSong,
        onPrevious: previousSong
      });
      syncMediaSessionState(isPlaying);
      MediaSessionService.updatePositionState({ currentTime, duration });
    } else {
      MediaSessionService.clearMetadata();
    }
  }, [currentSong, currentTime, duration, isPlaying, nextSong, pausePlayback, previousSong, resumePlayback, syncMediaSessionState]);

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
    setIsPlayerExpanded,
    togglePlayerExpanded,
    playFromList,
    nextSong,
    previousSong,
    togglePlay,
    pausePlayback,
    resumePlayback,
    seekTo,
    setVolume
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
};

