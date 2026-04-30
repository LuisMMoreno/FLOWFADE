import Meyda from 'meyda';
import MusicTempo from 'music-tempo';
import { AudioStorageService } from './AudioStorageService';
import { SongService } from './db';

/**
 * Servicio para analizar pistas de audio fuera de línea.
 * Detecta BPM, energía, puntos de mezcla y genera formas de onda.
 */
class AudioAnalysisService {
  constructor() {
    this.isAnalyzing = false;
  }

  /**
   * Analiza una canción y actualiza su registro en la base de datos.
   */
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
      console.log(`[Analysis] Análisis completado para: ${song.title}`, updates);
      
      return { ...song, ...updates };
    } catch (error) {
      console.error(`[Analysis] Error analizando pista ${song.id}:`, error);
      return song;
    }
  }

  /**
   * Ejecuta los algoritmos de análisis sobre el AudioBuffer.
   */
  async performAnalysis(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0); // Usamos el canal izquierdo para simplificar
    const sampleRate = audioBuffer.sampleRate;

    // 1. Detección de BPM y Beats
    const beatData = this.detectBeats(channelData);

    // 2. Cálculo de Energía (RMS medio)
    const energy = this.calculateEnergy(channelData);

    // 3. Puntos de Intro/Outro (Aproximación por umbrales de energía)
    const segments = this.detectSegments(channelData, sampleRate);

    // 4. Generación de Waveform (puntos reducidos para UI)
    const waveform = this.generateWaveform(channelData, 200);

    return {
      bpm: Math.round(beatData.tempo),
      beatGrid: beatData.beats,
      energy: energy,
      introPoint: segments.intro,
      outroPoint: segments.outro,
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
    // Normalizamos energía de 0 a 100
    return Math.min(100, Math.round(rms * 500));
  }

  detectSegments(channelData, sampleRate) {
    const bufferLength = channelData.length;
    const windowSize = Math.floor(sampleRate * 2); // Ventanas de 2 segundos
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

  /**
   * Analiza todas las pistas pendientes de forma secuencial para no saturar memoria.
   */
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
