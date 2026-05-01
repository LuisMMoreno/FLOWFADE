import Meyda from 'meyda';
import MusicTempo from 'music-tempo';
import { AudioStorageService } from './AudioStorageService';
import { SongService } from './db';

/**
 * Servicio de análisis de audio con conciencia musical.
 * 
 * Detecta:
 * - BPM y grid de beats (via music-tempo)
 * - Energía por sección (contorno de energía)
 * - Puntos de intro/outro (primer/último contenido musical)
 * - Límites de frase (cada 16 beats)
 * - Confianza del beat (qué tan regular es el ritmo)
 * - Waveform para visualización
 */
class AudioAnalysisService {
  constructor() {
    this.isAnalyzing = false;
  }

  async analyzeTrack(song) {
    if (song.analyzed) return song;

    try {
      console.log(`[Analysis] Iniciando análisis de: ${song.title}`);
      const blob = await AudioStorageService.getAudioBlob(song.url);
      const arrayBuffer = await blob.arrayBuffer();

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const analysis = await this.performAnalysis(audioBuffer);

      const updates = {
        ...analysis,
        analyzed: true
      };

      await SongService.updateSong(song.id, updates);
      console.log(`[Analysis] ✅ Análisis completado para: ${song.title}`, updates);

      return { ...song, ...updates };
    } catch (error) {
      console.error(`[Analysis] Error analizando pista ${song.id}:`, error);
      return song;
    }
  }

  async performAnalysis(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // 1. BPM y Beats
    const beatData = this.detectBeats(channelData);

    // 2. Energía global (RMS medio)
    const energy = this.calculateEnergy(channelData);

    // 3. Contorno de energía (energía por sección temporal)
    const energyContour = this.calculateEnergyContour(channelData, sampleRate, 16);

    // 4. Puntos de Intro/Outro con detección mejorada
    const segments = this.detectSegments(channelData, sampleRate);

    // 5. Límites de frase (cada 16 beats)
    const phraseBoundaries = this.detectPhraseBoundaries(beatData.beats);

    // 6. Confianza del beat (regularidad del ritmo)
    const beatConfidence = this.calculateBeatConfidence(beatData.beats);

    // 7. Waveform para UI
    const waveform = this.generateWaveform(channelData, 200);

    return {
      bpm: Math.round(beatData.tempo),
      beatGrid: beatData.beats,
      energy,
      energyContour,
      introPoint: segments.intro,
      outroPoint: segments.outro,
      phraseBoundaries,
      beatConfidence,
      waveformPeaks: waveform,
      duration: audioBuffer.duration
    };
  }

  detectBeats(channelData) {
    try {
      const mt = new MusicTempo(channelData);
      return {
        tempo: mt.tempo,
        beats: mt.beats
      };
    } catch (e) {
      console.warn('[Analysis] Error detectando BPM/Beats:', e);
      return { tempo: 0, beats: [] };
    }
  }

  calculateEnergy(channelData) {
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);
    return Math.min(100, Math.round(rms * 500));
  }

  /**
   * Calcula un contorno de energía dividido en N segmentos.
   * Cada segmento tiene: { time, energy (0-100) }
   * 
   * Esto permite saber dónde están los drops, breakdowns, etc.
   */
  calculateEnergyContour(channelData, sampleRate, segments = 16) {
    const segmentLength = Math.floor(channelData.length / segments);
    const contour = [];

    for (let i = 0; i < segments; i++) {
      const start = i * segmentLength;
      const end = Math.min(start + segmentLength, channelData.length);
      const chunk = channelData.slice(start, end);

      const rms = this.calculateRMS(chunk);
      const energy = Math.min(100, Math.round(rms * 500));
      const time = start / sampleRate;

      contour.push({ time, energy });
    }

    return contour;
  }

  /**
   * Detecta límites de frase basándose en el beatGrid.
   * Una frase musical = 16 beats en 4/4.
   * 
   * Retorna array de timestamps donde empiezan las frases.
   */
  detectPhraseBoundaries(beats) {
    if (!beats || beats.length < 16) return [];

    const boundaries = [];
    const phraseSize = 16;

    for (let i = 0; i < beats.length; i += phraseSize) {
      if (i < beats.length) {
        boundaries.push(beats[i]);
      }
    }

    return boundaries;
  }

  /**
   * Calcula qué tan regular/confiable es el beatGrid.
   * Un beat grid perfecto tiene intervalos casi idénticos.
   * 
   * Retorna 0-1 (0 = irregular, 1 = metrónomo perfecto)
   */
  calculateBeatConfidence(beats) {
    if (!beats || beats.length < 4) return 0;

    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }

    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, iv) => sum + Math.pow(iv - meanInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Coeficiente de variación: stdDev / mean
    // Bajo = regular, Alto = irregular
    const cv = stdDev / meanInterval;

    // Convertir a escala 0-1 (invertida: cv bajo = confianza alta)
    return Math.max(0, Math.min(1, 1 - cv * 5));
  }

  detectSegments(channelData, sampleRate) {
    const bufferLength = channelData.length;
    const windowSize = Math.floor(sampleRate * 2);
    let intro = 0;
    let outro = bufferLength / sampleRate;

    // Buscar primer bloque con energía significativa (> 0.05 RMS)
    for (let i = 0; i < bufferLength; i += windowSize) {
      const chunk = channelData.slice(i, i + windowSize);
      if (this.calculateRMS(chunk) > 0.05) {
        intro = i / sampleRate;
        break;
      }
    }

    // Buscar último bloque con energía significativa (desde el final)
    for (let i = bufferLength - windowSize; i > 0; i -= windowSize) {
      const chunk = channelData.slice(i, i + windowSize);
      if (this.calculateRMS(chunk) > 0.05) {
        outro = (i + windowSize) / sampleRate;
        break;
      }
    }

    return { intro, outro };
  }

  calculateRMS(chunk) {
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) {
      sum += chunk[i] * chunk[i];
    }
    return Math.sqrt(sum / chunk.length);
  }

  generateWaveform(channelData, points) {
    const step = Math.floor(channelData.length / points);
    const peaks = [];
    for (let i = 0; i < points; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const val = Math.abs(channelData[i * step + j]);
        if (val > max) max = val;
      }
      peaks.push(parseFloat(max.toFixed(2)));
    }
    return peaks;
  }

  async analyzeQueue() {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    try {
      const unanalyzed = await SongService.getUnanalyzedSongs();
      for (const song of unanalyzed) {
        await this.analyzeTrack(song);
        // Pequeño respiro para el hilo principal
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isAnalyzing = false;
    }
  }
}

export const audioAnalysisService = new AudioAnalysisService();
