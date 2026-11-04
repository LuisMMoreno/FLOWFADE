# FLOWFADE Architecture Document

## Overview

FLOWFADE is a Progressive Web App (PWA) music player featuring DJ-style crossfade transitions with musical intelligence. This document describes the system architecture, data flows, and key design decisions.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Environment                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  React UI    │  │  React       │  │  Service Worker      │  │
│  │  Components  │◄─┤  Context     │  │  (Workbox)           │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         ▼                 ▼                      ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Custom Hooks                          │  │
│  │  useLibrary  useAudioAnalyser  usePlaybackHelpers       │  │
│  │  useAlbumColors                                           │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐            │
│  │ AudioEngine│    │  DJEngine  │    │AudioStorage│            │
│  │ (Core)     │    │ (Brain)    │    │ Service    │            │
│  └─────┬──────┘    └─────┬──────┘    └─────┬──────┘            │
│        │                 │                 │                     │
│        ▼                 ▼                 ▼                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Web Audio API Graph                         │  │
│  │  HTMLAudio ×2 → MediaElementSource → EQ(3) → Gain →     │  │
│  │  AnalyserNode → Destination                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐            │
│  │ IndexedDB  │    │ Cache API  │    │MediaSession│            │
│  │ (Dexie)    │    │ (Audio)    │    │ API        │            │
│  └────────────┘    └────────────┘    └────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. AudioEngine (`src/services/AudioEngine.js`)

**Responsibility**: Low-level audio playback, Web Audio graph management, crossfade execution.

#### Dual-Slot Design
```javascript
// Two audio elements for gapless transitions
this.audioElements = [audioElement0, audioElement1];
this.currentIndex = -1; // Which slot is "current"
```

#### Web Audio Graph (per slot)
```
HTMLAudioElement
      │
      ▼
MediaElementSourceNode
      │
      ▼
BiquadFilter (lowshelf) ──────► BiquadFilter (peaking) ──────► BiquadFilter (highshelf)
      │                              │                              │
      └──────────────┬───────────────┴──────────────────────────────┘
                     ▼
              GainNode (slot volume)
                     │
                     ▼
              AnalyserNode (shared)
                     │
                     ▼
            AudioDestinationNode
```

#### Key Methods

| Method | Description |
|--------|-------------|
| `playSync(song, options)` | Main entry: loads, beat-syncs, crossfades |
| `play(song, crossfade)` | Simplified API |
| `pause()` | Pauses all slots, tracks paused slots |
| `stopAll()` | Hard stop, resets all state |
| `seek(time)` | Seeks current track |
| `setVolume(value)` | Master volume (0-1) |
| `setSlotEQ(index, {low,mid,high})` | 3-band EQ per slot |
| `connectAnalyser()` | Initializes Web Audio graph |
| `getFrequencyData()` | Returns Uint8Array for visualization |

#### Crossfade Algorithm (`computeDJMix`)

```javascript
// Four asymmetric phases
const DJ_PHASES = {
  INTRO:    { range: [0.00, 0.20], curve: 'smootherstep' },
  BLEND:    { range: [0.20, 0.55], curve: 'smoothstep' },
  TRANSFER: { range: [0.55, 0.82], curve: 'asymmetric' },
  OUTRO:    { range: [0.82, 1.00], curve: 'smootherstep' }
};
```

**TRANSFER phase asymmetry**:
- Track B (incoming): `smootherstep` — rises **fast**
- Track A (outgoing): `smoothstep` × 0.85 — falls **slow**
- Prevents "hole" in the mix where both tracks are quiet

#### EQ During Crossfade
Each phase defines EQ curves for both tracks:
- **INTRO**: B = highs only (no bass/mid)
- **BLEND**: A lows ↓, B lows ↑ (bass swap)
- **TRANSFER**: A → near zero, B → full
- **OUTRO**: A → zero, B → flat

---

### 2. DJEngine (`src/services/DJEngine.js`)

**Responsibility**: Musical intelligence — track selection, transition planning, session flow.

#### BPM Compatibility Scoring
```javascript
calculateBPMCompatibility(bpmA, bpmB) {
  // Checks ratios: 1x (exact), 2x (double), 0.5x (half)
  // Returns: 1.0 (exact), 0.95 (±4%), 0.8 (±8%), 0.4 (±12%), 0.1 (incompatible)
}
```

#### Transition Planning
```javascript
getTransitionPlan(trackA, trackB) {
  // Returns:
  // - duration: 4-20s based on musical phrases (8 bars @ avg BPM)
  // - type: 'power-swap' | 'smooth-decay' | 'buildup' | 'ethereal' | 'blend'
  // - syncBeats: boolean (BPM diff < 8%)
  // - playbackRate: trackA.bpm / trackB.bpm (for beat-sync)
  // - phrasesCount: 1-3 phrases
}
```

#### Session Phases
| Phase | Time Range | Target Energy |
|-------|------------|---------------|
| **warmup** | 0-10 min | ≤40 |
| **groove** | 10-30 min | mode target |
| **peak** | 30-60 min | ≥70 |
| **cooldown** | 60+ min | mode target -20 |

#### Modes
| Mode | BPM Weight | Energy Weight | Target Energy |
|------|------------|---------------|---------------|
| CHILL | 0.5 | 0.5 | 30 |
| BALANCED | 0.6 | 0.4 | 50 |
| ENERGY | 0.3 | 0.7 | 80 |

---

### 3. AudioStorageService (`src/services/AudioStorageService.js`)

**Responsibility**: Persistent audio file storage using IndexedDB + Cache API.

#### Storage Strategy
```
Import File
     │
     ▼
┌─────────────────┐
│  IndexedDB      │  ← Metadata (title, artist, duration, blob URL)
│  (Dexie)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cache API      │  ← Actual audio blob (offline playback)
│  (audio-cache)  │
└─────────────────┘
```

#### Key Methods
```javascript
importFile(file)        // Stores blob + metadata
getAudioBlob(url)       // Retrieves blob from Cache API
deleteFromCache(url)    // Removes from cache
getAllSongs()           // Returns all metadata from IndexedDB
```

---

### 4. AudioAnalysisService (`src/services/AudioAnalysisService.js`)

**Responsibility**: BPM detection, energy analysis, beat grid generation.

#### Pipeline
```
Audio File
     │
     ▼
music-tempo (Web Worker)
     │
     ├──► BPM (with confidence)
     ├──► Beats array (timestamps)
     └──► Energy profile (RMS per segment)
     │
     ▼
Store in IndexedDB (song.analyzed = true)
```

---

### 5. ColorExtractionService (`src/services/ColorExtractionService.js`)

**Responsibility**: Dominant color extraction from album art for UI theming.

#### K-means Clustering (k=2)
```javascript
_kMeans(pixelData, k) {
  // 1. Filter pixels: remove near-black (<25) and near-white (>230)
  // 2. Initialize centroids (k-means++)
  // 3. Iterate: assign → recompute centroids
  // 4. Convert RGB → HSL
  // 5. Adjust for contrast (WCAG AA)
  // 6. Return { primary, secondary, gradient }
}
```

#### Output Structure
```javascript
{
  primary: '#1db954',        // HEX
  secondary: '#191414',      // HEX
  primaryRgb: [29, 185, 84], // RGB array
  secondaryRgb: [25, 20, 20],
  gradient: 'linear-gradient(135deg, #1db954, #191414)'
}
```

---

### 6. MediaSessionService (`src/services/MediaSessionService.js`)

**Responsibility**: Lock screen controls, hardware media keys, notification metadata.

#### Features
- `setMetadata(title, artist, artwork, album)`
- `setPositionState(duration, position, rate)`
- Action handlers: play, pause, seekto, previoustrack, nexttrack
- Automatic artwork fallback to extracted colors

---

## React Architecture

### State Management: Context + Hooks

```
PlaybackContext (src/store/PlaybackContext.jsx)
├── State
│   ├── currentSong: Song | null
│   ├── queue: Song[]
│   ├── currentTime: number
│   ├── duration: number
│   ├── volume: number
│   ├── isPlaying: boolean
│   ├── isTransitioning: boolean
│   └── bassLevel, midLevel: number
│
├── Actions (wrapped in useCallback)
│   ├── play(song)
│   ├── pause()
│   ├── next()
│   ├── previous()
│   ├── seek(time)
│   ├── setVolume(value)
│   └── importFiles(files)
│
└── Providers
    ├── AudioEngine (singleton)
    ├── DJEngine (singleton)
    └── MediaSessionService (singleton)
```

### Shared Hooks

#### `usePlaybackHelpers` (`src/hooks/usePlaybackHelpers.js`)
Extracts duplicated logic from `Player.jsx` and `FullPlayerView.jsx`:
```javascript
{
  currentIndex,      // Index of currentSong in queue
  hasSong,           // Boolean
  canPlayPause,      // !isTransitioning && hasSong
  canGoPrevious,     // currentIndex > 0
  canGoNext,         // currentIndex < queue.length - 1
  safeDuration,      // duration || 0
  safeCurrentTime,   // clamped to duration
  safeVolume,        // NaN-safe
  progressPercent,   // (currentTime / duration) * 100
  formatTime(sec)    // MM:SS formatter
}
```

#### `useAudioAnalyser` (`src/hooks/useAudioAnalyser.js`)
- **Desktop/Android**: Real Web Audio AnalyserNode (FFT)
- **iOS**: Generative simulation (preserves background audio)
- Returns: `{ bassLevel, midLevel, isAnalyserReady }`

#### `useLibrary` (`src/hooks/useLibrary.js`)
- Reactive song list via `dexie-react-hooks` `useLiveQuery`
- File import with MIME/extension validation
- Delete with cache cleanup

---

## Data Flow: Playing a Track

```
User clicks track in LibraryView
         │
         ▼
PlaybackContext.play(song)
         │
         ▼
DJController.getTransitionPlan(current, next)
         │
         ▼
AudioEngine.playSync(song, { crossfade, playbackRate })
         │
         ├──────────────────┐
         ▼                  ▼
   Slot A (current)    Slot B (next)
   ─────────────────────────────────
   1. prepareSlot()     1. prepareSlot()
      - fetch blob         - fetch blob
      - create object URL  - create object URL
      - load audio         - load audio
   2. schedule callbacks  2. set playbackRate (beat-sync)
   3. setSlotVolume(0)    3. setSlotEQ({0,0,0}) (muted)
         │                  │
         └────────┬─────────┘
                  ▼
         setInterval (20ms = 50fps)
         │
         ├─ computeDJMix(progress)
         │   └─ Returns { gainA, gainB, phase, eqA, eqB }
         │
         ├─ setSlotVolume(prev, gainA)
         ├─ setSlotVolume(next, gainB)
         ├─ setSlotEQ(prev, eqA)
         ├─ setSlotEQ(next, eqB)
         │
         └─ progress >= 1.0 → clearInterval, reset prev slot
                  │
                  ▼
         Update PlaybackContext state
         Dispatch CustomEvent 'flowfade:playback-progress'
         Update MediaSession metadata
```

---

## PWA Architecture

### Service Worker (Workbox)
```javascript
// vite.config.js
manifest: {
  name: 'FLOWFADE',
  short_name: 'FLOWFADE',
  display: 'standalone',
  background_color: '#121212',
  theme_color: '#1db954'
}

// Cache Strategies
'Audio files'      → CacheFirst        (offline-first)
'JS/CSS/HTML'      → StaleWhileRevalidate
'Manifest/API'     → NetworkFirst
```

### Offline Audio Playback
1. User imports tracks → stored in IndexedDB + Cache API
2. Service Worker caches audio blobs on first play
3. Subsequent plays serve from cache (no network)
4. `CacheFirst` strategy ensures instant startup

---

## Testing Architecture

### Test Stack
- **Vitest 2** — Fast, Vite-native test runner
- **React Testing Library** — Component testing
- **jsdom** — DOM simulation
- **@vitest/coverage-v8** — Native V8 coverage

### Mock Strategy (`src/test/setup.js`)
```javascript
// Web Audio API
global.AudioContext = vi.fn(() => mockAudioContext);

// HTMLAudioElement
global.Audio = vi.fn(() => mockAudioElement);

// Browser APIs
global.URL.createObjectURL = vi.fn(() => 'blob:mock');
global.caches = mockCaches;
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16));

// MediaSession
navigator.mediaSession = { ... };

// React warnings suppression
console.error = filteredConsoleError;
```

### Coverage Targets
| Module | Statements | Branches | Functions |
|--------|------------|----------|-----------|
| usePlaybackHelpers | 100% | 100% | 100% |
| formatTime | 100% | 100% | 100% |
| useAudioAnalyser | 94% | 86% | 100% |
| useLibrary | 98% | 83% | 100% |
| DJEngine | 81% | 75% | 75% |
| AudioEngine | 63% | 65% | 68% |
| ColorExtractionService | 62% | 87% | 44% |

---

## Performance Considerations

### Audio Latency
- **Web Audio**: ~10-20ms (professional grade)
- **HTMLAudioElement fallback**: ~100-200ms
- **Beat-sync**: `playbackRate` adjustment avoids resampling artifacts

### Memory Management
- **Object URLs**: Revoked on slot reset (`URL.revokeObjectURL`)
- **Audio elements**: Reused (pool of 2), not recreated
- **AnalyserNode**: Single shared instance
- **Animation frames**: Cancelled on unmount/deactivation

### Bundle Size (Production)
```
dist/
├── index.html                    1.2 KB
├── assets/
│   ├── index-[hash].js          462 KB (gzipped: ~140 KB)
│   ├── index-[hash].css          24 KB (gzipped: ~5 KB)
│   └── vendor-[hash].js          (code-split)
└── sw.js                         (service worker)
```

---

## Security

- **CSP**: No inline scripts (Vite handles hashes)
- **Audio files**: Blob URLs (same-origin, revoked after use)
- **IndexedDB**: User-scoped, no cross-origin access
- **Service Worker**: HTTPS only (PWA requirement)

---

## Future Extensibility

### Plugin Points
1. **AudioEngine** — Swap crossfade algorithms
2. **DJEngine** — Add new transition types, ML-based selection
3. **ColorExtractionService** — Replace K-means with ML color palette
4. **MediaSessionService** — Add custom actions (like, share, queue)

### Potential Features
- Collaborative queue (WebRTC)
- Cloud sync (IndexedDB → remote)
- Visualizer shaders (WebGL)
- Lyrics sync (LRC parsing)
- Equalizer presets (genre-based)

---

## Deployment

### Build
```bash
npm run build
# Output: dist/ (static files + service worker)
```

### Hosting Requirements
- **HTTPS** (required for PWA, Service Worker, Media Session)
- **Cache-Control headers** for static assets
- **Service Worker scope** at root (/)
- **Manifest** served with `application/manifest+json`

### Recommended Platforms
- Vercel / Netlify (zero-config)
- Cloudflare Pages
- GitHub Pages (with custom domain + HTTPS)
- Any static host with HTTPS

---

## Appendix: Key Types

```typescript
// Song metadata (stored in IndexedDB)
interface Song {
  id: number;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;      // blob URL
  url: string;           // blob URL (audio)
  duration: number;
  bpm?: number;
  energy?: number;       // 0-100
  analyzed: boolean;
  dateAdded: number;
}

// DJ Transition Plan
interface TransitionPlan {
  duration: number;      // seconds (4-20)
  type: 'power-swap' | 'smooth-decay' | 'buildup' | 'ethereal' | 'blend';
  syncBeats: boolean;
  playbackRate: number;  // trackA.bpm / trackB.bpm
  phrasesCount: number;
  barDuration: number;
  beatDuration: number;
}

// Color Extraction Result
interface ColorPalette {
  primary: string;       // HEX
  secondary: string;     // HEX
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  gradient: string;      // CSS gradient
}

// Playback Snapshot (CustomEvent detail)
interface PlaybackSnapshot {
  currentTime: number;
  duration: number;
  volume: number;
  isPlaying: boolean;
}
```