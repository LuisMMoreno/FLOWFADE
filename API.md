# FLOWFADE API Reference

## Core Services

### AudioEngine

**Singleton**: `audioEngine` (imported from `src/services/AudioEngine.js`)

#### Initialization
```javascript
await audioEngine.initialize()
// Creates 2 HTMLAudioElement instances, sets up event listeners
```

#### Playback Control
```javascript
// Main API - plays with crossfade and beat-sync
await audioEngine.playSync(song, {
  crossfade: 12,        // seconds (0 = no crossfade)
  offset: 0,            // start position in seconds
  playbackRate: 1.0     // 0.92-1.08 for beat-sync
})

// Simplified API
await audioEngine.play(song, crossfade)  // crossfade: number|boolean

// Resume paused slots
await audioEngine.playCurrent()

// Pause all, remember which were playing
audioEngine.pause()

// Hard stop - reset everything
audioEngine.stopAll()
```

#### Volume & EQ
```javascript
// Master volume (0-1), applies to all slots
audioEngine.setVolume(0.8)

// Per-slot volume (0-1)
audioEngine.setSlotVolume(slotIndex, 0.5)

// 3-band EQ per slot (0-1 per band)
audioEngine.setSlotEQ(slotIndex, { low: 1, mid: 0.5, high: 0.8 })

// Reset EQ to flat (0dB all bands)
audioEngine.resetSlotEQ(slotIndex)
```

#### Seeking & Progress
```javascript
// Seek current track (clamped to duration)
audioEngine.seek(45.5)

// Get current playback state
const snapshot = audioEngine.getPlaybackSnapshot()
// Returns: { currentTime, duration, volume, isPlaying }

// Check if audio is actually playing (not paused/ended)
const playing = audioEngine.getIsActuallyPlaying()
```

#### Callbacks
```javascript
// Called when current track ends naturally
audioEngine.setOnEnded(() => { /* play next */ })

// Called when track is within crossfadeDuration of ending
audioEngine.setOnAlmostEnded(() => { /* prepare next */ })
```

#### Web Audio Analyser
```javascript
// Initialize Web Audio graph (returns false on iOS)
const connected = audioEngine.connectAnalyser()

// Get raw FFT data (Uint8Array, length = frequencyBinCount)
const data = audioEngine.getFrequencyData()

// Convenience methods
const bass = audioEngine.getBassLevel()   // 0-1 (bins 0-10)
const mid = audioEngine.getMidLevel()     // 0-1 (bins 10-60)
```

#### Events
```javascript
// Listen for playback progress (fires on timeupdate, play, pause, seek, etc)
window.addEventListener('flowfade:playback-progress', (e) => {
  const { currentTime, duration, volume, isPlaying } = e.detail
})
```

---

### DJEngine

**Singleton**: `djEngine` (imported from `src/services/DJEngine.js`)

#### Mode Management
```javascript
// Set DJ mode: 'CHILL' | 'ENERGY' | 'BALANCED'
djEngine.setMode('ENERGY')

// Current mode
djEngine.currentMode  // 'BALANCED'
```

#### Track Selection
```javascript
// Returns best next track based on current track, library, history, session phase
const nextTrack = djEngine.selectNextTrack(currentTrack, library)
// Returns: Song | null
```

#### Analysis
```javascript
// BPM compatibility (0.1 - 1.0)
const score = djEngine.calculateBPMCompatibility(120, 124)  // 0.95

// Match score for two tracks (weighted by mode)
const score = djEngine.calculateMatchScore(trackA, trackB)
// Returns: number (can exceed 1.0, not a probability)

// Transition plan between two tracks
const plan = djEngine.getTransitionPlan(trackA, trackB)
// Returns: TransitionPlan
```

#### Session Phase
```javascript
// Updates internal phase based on session start time
djEngine.updateSessionPhase()

// Current phase: 'warmup' | 'groove' | 'peak' | 'cooldown'
djEngine.currentPhase

// History management
djEngine.addToHistory(trackId)
djEngine.history  // Array of recent track IDs (max 50)
```

---

### DJController

**Singleton**: `djController` (imported from `src/services/DJController.js`)

High-level automation combining AudioEngine + DJEngine.

```javascript
// Start DJ mode with a library
await djController.start(library, options)
// options: { mode: 'BALANCED', crossfade: 12 }

// Stop DJ mode
djController.stop()

// Manually trigger next track
await djController.next()

// Get current status
djController.getStatus()
// Returns: { currentTrack, nextTrack, phase, mode, isPlaying }
```

---

### AudioStorageService

**Static class**: `AudioStorageService` (imported from `src/services/AudioStorageService.js`)

```javascript
// Import a File object (from input[type=file] or drag-drop)
await AudioStorageService.importFile(file)
// Stores in IndexedDB + Cache API, triggers analysis

// Get audio blob for playback
const blob = await AudioStorageService.getAudioBlob(blobUrl)

// Delete from cache (call after removing from IndexedDB)
await AudioStorageService.deleteFromCache(blobUrl)

// Get all songs metadata
const songs = await AudioStorageService.getAllSongs()
```

---

### AudioAnalysisService

**Static class**: `AudioAnalysisService` (imported from `src/services/AudioAnalysisService.js`)

```javascript
// Analyze a song (runs in background via music-tempo worker)
await AudioAnalysisService.analyzeSong(song)
// Updates song with: bpm, beats[], energy, analyzed: true

// Cancel ongoing analysis
AudioAnalysisService.cancelAnalysis(songId)
```

---

### ColorExtractionService

**Static class**: `ColorExtractionService` (imported from `src/services/ColorExtractionService.js`)

```javascript
// Extract colors from image URL (album art)
const colors = await ColorExtractionService.extractColors(imageUrl)
// Returns: ColorPalette

// Get default fallback colors
const defaults = ColorExtractionService.getDefaultColors()
// Returns: { primary: '#1db954', secondary: '#191414', ... }
```

**ColorPalette**:
```typescript
{
  primary: string;        // HEX - dominant color
  secondary: string;      // HEX - secondary color
  primaryRgb: [r, g, b];  // RGB array (0-255)
  secondaryRgb: [r, g, b];
  gradient: string;       // CSS linear-gradient string
}
```

---

### MediaSessionService

**Static class**: `MediaSessionService` (imported from `src/services/MediaSessionService.js`)

```javascript
// Set metadata for lock screen / notifications
MediaSessionService.setMetadata({
  title: 'Song Title',
  artist: 'Artist Name',
  album: 'Album Name',
  artwork: [ { src: 'url', sizes: '512x512', type: 'image/png' } ]
})

// Update playback state for position scrubbing
MediaSessionService.setPositionState({
  duration: 180,
  position: 45,
  playbackRate: 1.0
})

// Set playback state: 'playing' | 'paused' | 'none'
MediaSessionService.setPlaybackState('playing')

// Clear all metadata
MediaSessionService.clear()
```

---

## React Context

### PlaybackContext

**Provider**: `PlaybackProvider` (from `src/store/PlaybackContext.jsx`)

```jsx
import { PlaybackProvider, usePlayback } from './store/PlaybackContext'

// In App.jsx
<PlaybackProvider>
  <App />
</PlaybackProvider>

// In any component
const {
  // State
  currentSong,      // Song | null
  queue,            // Song[]
  currentTime,      // number
  duration,         // number
  volume,           // number (0-1)
  isPlaying,        // boolean
  isTransitioning,  // boolean
  bassLevel,        // number (0-1)
  midLevel,         // number (0-1)

  // Actions
  play,             // (song) => Promise
  pause,            // () => void
  next,             // () => Promise
  previous,         // () => Promise
  seek,             // (time) => void
  setVolume,        // (vol) => void
  importFiles,      // (FileList) => Promise
  removeSong,       // (song) => Promise
  togglePlayPause,  // () => Promise
} = usePlayback()
```

---

## Custom Hooks

### usePlaybackHelpers

```javascript
import { usePlaybackHelpers } from './hooks/usePlaybackHelpers'

const {
  currentIndex,        // Index of currentSong in queue (-1 if not found)
  hasSong,             // Boolean
  canPlayPause,        // !isTransitioning && hasSong
  canGoPrevious,       // currentIndex > 0
  canGoNext,           // currentIndex < queue.length - 1
  safeDuration,        // duration || 0
  safeCurrentTime,     // Math.min(currentTime, duration)
  safeVolume,          // isNaN(volume) ? 1 : volume
  progressPercent,     // (safeCurrentTime / safeDuration) * 100
  formatTime,          // (seconds) => 'MM:SS'
} = usePlaybackHelpers({
  currentSong,
  queue,
  currentTime,
  duration,
  volume,
  isTransitioning
})
```

### useAudioAnalyser

```javascript
import { useAudioAnalyser } from './hooks/useAudioAnalyser'

const { bassLevel, midLevel, isAnalyserReady } = useAudioAnalyser(
  isActive,    // boolean - start/stop analysis
  isPlaying    // boolean - only animate when playing
)
// Returns: { bassLevel: 0-1, midLevel: 0-1, isAnalyserReady: boolean }
```

### useLibrary

```javascript
import { useLibrary } from './hooks/useLibrary'

const {
  songs,           // Song[] (reactive via Dexie useLiveQuery)
  isImporting,     // boolean
  importFiles,     // (FileList) => Promise
  removeSong,      // (song) => Promise
} = useLibrary()
```

### useAlbumColors

```javascript
import { useAlbumColors } from './hooks/useAlbumColors'

const { colors, isExtracting } = useAlbumColors(imageUrl)
// colors: ColorPalette | null
// isExtracting: boolean
```

---

## Utility Functions

### formatTime

```javascript
import { formatTime } from './utils/formatTime'

formatTime(0)      // '0:00'
formatTime(30)     // '0:30'
formatTime(60)     // '1:00'
formatTime(90)     // '1:30'
formatTime(125)    // '2:05'
formatTime(3661)   // '61:01'
formatTime(-5)     // '0:00' (clamped)
formatTime(90.7)   // '1:30' (floored)
```

---

## Types

### Song
```typescript
interface Song {
  id: number;              // Auto-increment (IndexedDB)
  title: string;
  artist: string;
  album?: string;
  artwork?: string;        // blob: URL
  url: string;             // blob: URL (audio file)
  duration: number;        // seconds
  bpm?: number;
  energy?: number;         // 0-100
  analyzed: boolean;
  dateAdded: number;       // timestamp
}
```

### TransitionPlan
```typescript
interface TransitionPlan {
  duration: number;        // 4-20 seconds
  type: 'power-swap' | 'smooth-decay' | 'buildup' | 'ethereal' | 'blend';
  syncBeats: boolean;      // BPM diff < 8%
  playbackRate: number;    // trackA.bpm / trackB.bpm
  phrasesCount: number;    // 1-3
  barDuration: number;     // seconds per 4 beats
  beatDuration: number;    // seconds per beat
}
```

### ColorPalette
```typescript
interface ColorPalette {
  primary: string;         // HEX
  secondary: string;       // HEX
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  gradient: string;        // CSS gradient
}
```

### PlaybackSnapshot
```typescript
interface PlaybackSnapshot {
  currentTime: number;
  duration: number;
  volume: number;
  isPlaying: boolean;
}
```

---

## Events

### Custom Events

| Event Name | Detail | Description |
|------------|--------|-------------|
| `flowfade:playback-progress` | `PlaybackSnapshot` | Fired on timeupdate, play, pause, seek, ended |

### Usage
```javascript
window.addEventListener('flowfade:playback-progress', (e) => {
  const { currentTime, duration, volume, isPlaying } = e.detail
  // Update UI, save position, etc.
})
```

---

## Error Handling

### Common Patterns

```javascript
// AudioEngine methods return boolean for success
const success = await audioEngine.playSync(song, options)
if (!success) {
  // Handle: load cancelled, blob not found, etc.
}

// Storage operations throw on failure
try {
  await AudioStorageService.importFile(file)
} catch (error) {
  // Handle: quota exceeded, invalid file, etc.
}

// Analysis runs in background, check song.analyzed
if (!song.analyzed) {
  // Show "analyzing..." state
  await AudioAnalysisService.analyzeSong(song)
}
```

---

## Browser Compatibility Notes

| Feature | Fallback |
|---------|----------|
| Web Audio API | HTMLAudioElement volume (no EQ, no analyser) |
| MediaSession API | No-op (silently ignored) |
| Cache API | Memory-only (no offline) |
| IndexedDB | In-memory array (no persistence) |
| requestAnimationFrame | setTimeout 16ms |
| Blob URLs | Object URLs (same behavior) |

**iOS Specific**:
- Web Audio disabled to preserve background audio
- Analyser uses generative simulation
- `play()` requires user gesture (handled by UI)