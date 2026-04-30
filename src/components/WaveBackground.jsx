import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Fondo de ondas orgánicas reactivas al ritmo.
 * Renderiza en Canvas 2D con optimización GPU.
 *
 * @param {{ bassLevel: number, midLevel: number, primaryColor: string, secondaryColor: string, primaryRgb: number[], secondaryRgb: number[], isPlaying: boolean }} props
 */
export const WaveBackground = ({
  bassLevel = 0,
  midLevel = 0,
  primaryRgb = [29, 185, 84],
  secondaryRgb = [25, 20, 20],
  isPlaying = false
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Valores suavizados para evitar saltos bruscos
  const smoothBassRef = useRef(0);
  const smoothMidRef = useRef(0);

  const WAVE_CONFIGS = useRef([
    { frequency: 0.008, amplitude: 55, speed: 0.6, phase: 0, verticalPos: 0.55 },
    { frequency: 0.012, amplitude: 40, speed: 0.8, phase: Math.PI / 3, verticalPos: 0.60 },
    { frequency: 0.006, amplitude: 65, speed: 0.4, phase: Math.PI / 1.5, verticalPos: 0.50 },
    { frequency: 0.015, amplitude: 30, speed: 1.0, phase: Math.PI * 1.2, verticalPos: 0.65 },
  ]).current;

  const draw = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Delta time
    if (!lastFrameRef.current) lastFrameRef.current = timestamp;
    const delta = Math.min((timestamp - lastFrameRef.current) / 1000, 0.05);
    lastFrameRef.current = timestamp;

    if (isPlaying) {
      timeRef.current += delta;
    }

    // Suavizar niveles de audio (lerp)
    const lerpFactor = 0.08;
    smoothBassRef.current += (bassLevel - smoothBassRef.current) * lerpFactor;
    smoothMidRef.current += (midLevel - smoothMidRef.current) * lerpFactor;

    const { width, height } = canvas;
    const bass = smoothBassRef.current;
    const mid = smoothMidRef.current;
    const t = timeRef.current;

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Dibujar cada onda
    WAVE_CONFIGS.forEach((wave, waveIndex) => {
      const bassModulation = 1 + bass * 1.8;
      const midModulation = 1 + mid * 0.8;
      const combinedModulation = bassModulation * midModulation;

      const effectiveAmplitude = wave.amplitude * combinedModulation;
      const effectiveSpeed = wave.speed * (1 + mid * 0.5);
      const centerY = height * wave.verticalPos;

      ctx.beginPath();
      ctx.moveTo(0, height);

      // Renderizar la onda punto a punto
      for (let x = 0; x <= width; x += 2) {
        const normalizedX = x / width;

        // Múltiples armónicos para forma orgánica
        const y = centerY +
          Math.sin(x * wave.frequency + t * effectiveSpeed + wave.phase) * effectiveAmplitude * 0.6 +
          Math.sin(x * wave.frequency * 2.3 + t * effectiveSpeed * 1.4 + wave.phase * 0.7) * effectiveAmplitude * 0.25 +
          Math.sin(x * wave.frequency * 0.5 + t * effectiveSpeed * 0.6 + wave.phase * 1.3) * effectiveAmplitude * 0.15 +
          // Modulación sutil para que se sienta "viva"
          Math.sin(normalizedX * Math.PI * 2 + t * 0.3) * 8 * bass;

        ctx.lineTo(x, y);
      }

      // Cerrar el path por debajo
      ctx.lineTo(width, height);
      ctx.closePath();

      // Gradiente vertical con colores del álbum
      const gradient = ctx.createLinearGradient(0, centerY - effectiveAmplitude, 0, height);

      // Alternar entre color primario y secundario según la onda
      const isEven = waveIndex % 2 === 0;
      const color = isEven ? primaryRgb : secondaryRgb;
      const opacity1 = (0.12 + bass * 0.08) * (1 - waveIndex * 0.02);
      const opacity2 = 0.02;

      gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity1})`);
      gradient.addColorStop(0.5, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity1 * 0.6})`);
      gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity2})`);

      ctx.fillStyle = gradient;
      ctx.fill();
    });

    animationRef.current = requestAnimationFrame(draw);
  }, [bassLevel, midLevel, primaryRgb, secondaryRgb, isPlaying, WAVE_CONFIGS]);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Animation loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="gpu-accelerated"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
      aria-hidden="true"
    />
  );
};
