/**
 * Servicio de extracción de colores dominantes desde carátulas de álbum.
 * Utiliza Canvas 2D y K-means simplificado para extraer 2 colores dominantes.
 */

const DEFAULT_PRIMARY = '#1DB954';
const DEFAULT_SECONDARY = '#191414';

/**
 * Calcula la luminancia relativa de un color RGB (WCAG 2.0).
 */
function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Verifica el ratio de contraste entre dos colores.
 * Retorna true si el contraste es >= 4.5:1 (WCAG AA).
 */
function hasAdequateContrast(r, g, b, bgR = 255, bgG = 255, bgB = 255) {
  const l1 = relativeLuminance(bgR, bgG, bgB) + 0.05;
  const l2 = relativeLuminance(r, g, b) + 0.05;
  const ratio = Math.max(l1, l2) / Math.min(l1, l2);
  return ratio >= 4.5;
}

/**
 * Ajusta la luminosidad de un color para garantizar contraste con texto blanco.
 */
function adjustForContrast(r, g, b) {
  let [h, s, l] = rgbToHsl(r, g, b);

  // Oscurecer el color si es demasiado claro para texto blanco encima
  if (!hasAdequateContrast(r, g, b)) {
    l = Math.min(l, 0.35);
  }

  return hslToRgb(h, s, l);
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Distancia euclidiana entre dos colores RGB.
 */
function colorDistance(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

export const ColorExtractionService = {
  /**
   * Extrae los 2 colores dominantes de una imagen (data URL de carátula).
   * @param {string} coverDataUrl - Data URL de la imagen.
   * @returns {Promise<{primary: string, secondary: string, primaryRgb: number[], secondaryRgb: number[], gradient: string}>}
   */
  async extractColors(coverDataUrl) {
    if (!coverDataUrl) return this.getDefaultColors();

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timeout = setTimeout(() => {
        resolve(this.getDefaultColors());
      }, 3000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const size = 50;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);

          const imageData = ctx.getImageData(0, 0, size, size);
          const colors = this._kMeans(imageData.data, 2);

          // Ajustar contraste para texto blanco
          const primary = adjustForContrast(...colors[0]);
          const secondary = adjustForContrast(...colors[1]);

          resolve({
            primary: `rgb(${primary[0]}, ${primary[1]}, ${primary[2]})`,
            secondary: `rgb(${secondary[0]}, ${secondary[1]}, ${secondary[2]})`,
            primaryRgb: primary,
            secondaryRgb: secondary,
            gradient: `linear-gradient(135deg, rgb(${primary[0]}, ${primary[1]}, ${primary[2]}) 0%, rgb(${secondary[0]}, ${secondary[1]}, ${secondary[2]}) 100%)`
          });
        } catch (error) {
          console.warn('[ColorExtraction] Error extrayendo colores:', error);
          resolve(this.getDefaultColors());
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(this.getDefaultColors());
      };

      img.src = coverDataUrl;
    });
  },

  /**
   * K-means simplificado con 2 clusters sobre los pixels de la imagen.
   */
  _kMeans(pixelData, k) {
    const pixels = [];

    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      const brightness = (r + g + b) / 3;

      // Ignorar pixels casi-negros y casi-blancos
      if (brightness > 25 && brightness < 230) {
        pixels.push([r, g, b]);
      }
    }

    if (pixels.length < k) {
      return [[29, 185, 84], [25, 20, 20]]; // Defaults
    }

    // Inicializar centroides con los pixels más distantes
    let centroids = [
      pixels[0],
      pixels[Math.floor(pixels.length * 0.66)]
    ];

    // 10 iteraciones son suficientes para convergencia en 50x50
    for (let iter = 0; iter < 10; iter++) {
      const clusters = Array.from({ length: k }, () => []);

      for (const pixel of pixels) {
        let minDist = Infinity;
        let closest = 0;

        for (let c = 0; c < k; c++) {
          const dist = colorDistance(pixel, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        }

        clusters[closest].push(pixel);
      }

      // Actualizar centroides
      centroids = clusters.map((cluster, i) => {
        if (cluster.length === 0) return centroids[i];
        const sum = [0, 0, 0];
        for (const pixel of cluster) {
          sum[0] += pixel[0];
          sum[1] += pixel[1];
          sum[2] += pixel[2];
        }
        return [
          Math.round(sum[0] / cluster.length),
          Math.round(sum[1] / cluster.length),
          Math.round(sum[2] / cluster.length)
        ];
      });
    }

    // Ordenar por saturación (el más saturado primero = más "dominante" visualmente)
    centroids.sort((a, b) => {
      const [, sa] = rgbToHsl(...a);
      const [, sb] = rgbToHsl(...b);
      return sb - sa;
    });

    return centroids;
  },

  /**
   * Colores por defecto cuando no hay carátula disponible.
   */
  getDefaultColors() {
    return {
      primary: DEFAULT_PRIMARY,
      secondary: DEFAULT_SECONDARY,
      primaryRgb: [29, 185, 84],
      secondaryRgb: [25, 20, 20],
      gradient: `linear-gradient(135deg, ${DEFAULT_PRIMARY} 0%, ${DEFAULT_SECONDARY} 100%)`
    };
  }
};
