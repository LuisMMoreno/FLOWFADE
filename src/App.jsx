import React from 'react';
import { Sidebar } from './components/Sidebar';
import { LibraryView } from './components/LibraryView';
import { Player } from './components/Player';
import { FullPlayerView } from './components/FullPlayerView';
import { usePlayback } from './hooks/usePlayback';
import { AnimatePresence } from 'framer-motion';

function App() {
  const { isPlayerExpanded, currentSong } = usePlayback();

  return (
    <div className="flex h-screen bg-black overflow-hidden select-none">
      {/* Sidebar - Oculto en móviles para simplificar MVP */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        <LibraryView />
      </main>

      {/* Persistent MiniPlayer */}
      <Player />

      {/* Full Player Overlay */}
      <AnimatePresence>
        {isPlayerExpanded && currentSong && (
          <FullPlayerView key="full-player" />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
