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
    { frequency: 0.005, amplitude: 75, speed: 0.9, phase: 0, verticalPos: 0.35 },
    { frequency: 0.010, amplitude: 55, speed: 1.2, phase: Math.PI / 3, verticalPos: 0.50 },
    { frequency: 0.007, amplitude: 90, speed: 0.7, phase: Math.PI / 1.5, verticalPos: 0.65 },
    { frequency: 0.015, amplitude: 45, speed: 1.5, phase: Math.PI * 1.2, verticalPos: 0.80 },
    { frequency: 0.004, amplitude: 100, speed: 0.6, phase: Math.PI * 0.5, verticalPos: 0.25 }, // Onda más alta para mejor visibilidad en móvil
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
      const bassModulation = 1 + bass * 2.2; // Mayor impacto del bajo
      const midModulation = 1 + mid * 1.0;
      const combinedModulation = bassModulation * midModulation;

      const effectiveAmplitude = wave.amplitude * combinedModulation;
      const effectiveSpeed = wave.speed * (1 + mid * 0.8 + bass * 0.4); // Velocidad reacciona también al bajo
      const centerY = height * wave.verticalPos;

      ctx.beginPath();
      ctx.moveTo(0, height);

      // Renderizar la onda punto a punto
      for (let x = 0; x <= width; x += 2) {
        const normalizedX = x / width;

        // Múltiples armónicos para forma orgánica con mayor movimiento
        const y = centerY +
          Math.sin(x * wave.frequency + t * effectiveSpeed + wave.phase) * effectiveAmplitude * 0.6 +
          Math.sin(x * wave.frequency * 2.3 + t * effectiveSpeed * 1.4 + wave.phase * 0.7) * effectiveAmplitude * 0.3 +
          Math.sin(x * wave.frequency * 0.5 + t * effectiveSpeed * 0.6 + wave.phase * 1.3) * effectiveAmplitude * 0.2 +
          // Modulación más fuerte para que se sienta muy "viva" con el ritmo
          Math.sin(normalizedX * Math.PI * 2 + t * 0.5) * 15 * (bassModulation * 0.8);

        ctx.lineTo(x, y);
      }

      // Cerrar el path por debajo
      ctx.lineTo(width, height);
      ctx.closePath();

      // Gradiente vertical con colores del álbum
      const gradient = ctx.createLinearGradient(0, centerY - effectiveAmplitude, 0, height);

      // Dar mayor dominancia al color primario (4 de cada 5 ondas)
      const isPrimary = waveIndex % 5 !== 4;
      const color = isPrimary ? primaryRgb : secondaryRgb;
      
      // Mayor opacidad base para ser más vibrante, sin ser exagerado
      const baseOpacity = isPrimary ? 0.22 : 0.12;
      const dynamicOpacity = baseOpacity + bass * 0.18;
      const opacity1 = Math.min(dynamicOpacity * (1 - waveIndex * 0.05), 0.8);
      const opacity2 = 0.04;

      gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity1})`);
      gradient.addColorStop(0.5, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity1 * 0.5})`);
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
      // Optimización extrema para móviles: limitamos DPR a 1 o 1.5 máximo.
      // Las ondas son formas suaves y borrosas, así que una menor resolución ahorra ~75% de recursos de GPU en iOS.
      const isMobile = window.innerWidth < 768;
      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      
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
