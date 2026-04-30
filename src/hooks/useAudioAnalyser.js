import { useRef, useCallback, useEffect, useState } from 'react';
import { audioEngine } from '../services/AudioEngine';

/**
 * Hook que provee datos de análisis de audio (bass, mid, frecuencias).
 * Usa AnalyserNode real cuando está disponible (desktop/Android),
 * con fallback a simulación generativa para iOS.
 *
 * @param {boolean} isActive - Si true, activa el loop de análisis.
 * @param {boolean} isPlaying - Estado actual de reproducción.
 * @returns {{ bassLevel: number, midLevel: number, isAnalyserReady: boolean }}
 */
export function useAudioAnalyser(isActive, isPlaying) {
  const [bassLevel, setBassLevel] = useState(0);
  const [midLevel, setMidLevel] = useState(0);
  const [isAnalyserReady, setIsAnalyserReady] = useState(false);

  const rafIdRef = useRef(null);
  const analyserConnectedRef = useRef(false);
  const simulationTimeRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const useRealAnalyserRef = useRef(false);

  // Intentar conectar el analizador real (no-iOS)
  const tryConnectAnalyser = useCallback(() => {
    if (analyserConnectedRef.current) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
      // iOS: usar simulación para no interferir con background playback
      analyserConnectedRef.current = true;
      useRealAnalyserRef.current = false;
      setIsAnalyserReady(true);
      return;
    }

    try {
      const connected = audioEngine.connectAnalyser();
      analyserConnectedRef.current = true;
      useRealAnalyserRef.current = connected;
      setIsAnalyserReady(true);
    } catch (error) {
      console.warn('[useAudioAnalyser] Fallback a simulación:', error);
      analyserConnectedRef.current = true;
      useRealAnalyserRef.current = false;
      setIsAnalyserReady(true);
    }
  }, []);

  // Loop de análisis
  useEffect(() => {
    if (!isActive) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setBassLevel(0);
      setMidLevel(0);
      return;
    }

    tryConnectAnalyser();

    const tick = (timestamp) => {
      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      if (useRealAnalyserRef.current && audioEngine.analyserNode) {
        // --- Modo Real: leer datos FFT ---
        const data = audioEngine.getFrequencyData();

        if (data) {
          // Bass: bins 0-10 (~0-200Hz con FFT 512 a 44100Hz)
          let bassSum = 0;
          const bassEnd = Math.min(10, data.length);
          for (let i = 0; i < bassEnd; i++) {
            bassSum += data[i];
          }
          const rawBass = bassSum / (bassEnd * 255);

          // Mid: bins 10-60 (~200Hz-2600Hz)
          let midSum = 0;
          const midStart = 10;
          const midEnd = Math.min(60, data.length);
          for (let i = midStart; i < midEnd; i++) {
            midSum += data[i];
          }
          const rawMid = midSum / ((midEnd - midStart) * 255);

          setBassLevel(rawBass);
          setMidLevel(rawMid);
        }
      } else {
        // --- Modo Simulado: ondas generativas ---
        if (isPlaying) {
          simulationTimeRef.current += delta;
        }

        const t = simulationTimeRef.current;
        const playingFactor = isPlaying ? 1 : 0;

        // Simular bass con múltiples frecuencias (se siente como un beat)
        const bassPulse =
          (Math.sin(t * 2.1) * 0.3 +
           Math.sin(t * 3.7) * 0.2 +
           Math.sin(t * 0.8) * 0.25 +
           Math.sin(t * 5.3 + 1.2) * 0.15 +
           0.5) * playingFactor;

        // Simular mid con variaciones más suaves
        const midPulse =
          (Math.sin(t * 1.3 + 0.7) * 0.25 +
           Math.sin(t * 2.9 + 2.1) * 0.2 +
           Math.sin(t * 4.1) * 0.15 +
           Math.sin(t * 0.5 + 0.3) * 0.2 +
           0.45) * playingFactor;

        setBassLevel(Math.max(0, Math.min(1, bassPulse)));
        setMidLevel(Math.max(0, Math.min(1, midPulse)));
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lastTimestampRef.current = 0;
    };
  }, [isActive, isPlaying, tryConnectAnalyser]);

  return { bassLevel, midLevel, isAnalyserReady };
}
