import { useState, useEffect, useRef } from 'react';
import { ColorExtractionService } from '../services/ColorExtractionService';

/**
 * Hook que extrae los colores dominantes de la carátula del álbum actual
 * y los aplica como variables CSS dinámicas en :root.
 *
 * @param {string|null} coverUrl - Data URL de la carátula.
 * @returns {{ primaryColor: string, secondaryColor: string, primaryRgb: number[], secondaryRgb: number[], gradient: string, isLoading: boolean }}
 */
export function useAlbumColors(coverUrl) {
  const [colors, setColors] = useState(() => ColorExtractionService.getDefaultColors());
  const [isLoading, setIsLoading] = useState(false);
  const lastCoverRef = useRef(null);

  useEffect(() => {
    // Evitar re-extracción si la carátula no cambió
    if (coverUrl === lastCoverRef.current) return;
    lastCoverRef.current = coverUrl;

    let cancelled = false;
    setIsLoading(true);

    ColorExtractionService.extractColors(coverUrl)
      .then((result) => {
        if (cancelled) return;

        setColors(result);
        setIsLoading(false);

        // Aplicar variables CSS dinámicas en :root
        const root = document.documentElement;
        root.style.setProperty('--current-primary', result.primary);
        root.style.setProperty('--current-secondary', result.secondary);
        root.style.setProperty('--current-gradient', result.gradient);

        if (result.primaryRgb) {
          root.style.setProperty('--current-primary-r', result.primaryRgb[0]);
          root.style.setProperty('--current-primary-g', result.primaryRgb[1]);
          root.style.setProperty('--current-primary-b', result.primaryRgb[2]);
        }
        if (result.secondaryRgb) {
          root.style.setProperty('--current-secondary-r', result.secondaryRgb[0]);
          root.style.setProperty('--current-secondary-g', result.secondaryRgb[1]);
          root.style.setProperty('--current-secondary-b', result.secondaryRgb[2]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setColors(ColorExtractionService.getDefaultColors());
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  return {
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    primaryRgb: colors.primaryRgb,
    secondaryRgb: colors.secondaryRgb,
    gradient: colors.gradient,
    isLoading
  };
}
