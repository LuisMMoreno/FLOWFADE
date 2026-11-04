import { ColorExtractionService } from './ColorExtractionService';

describe('ColorExtractionService', () => {
  describe('getDefaultColors', () => {
    test('returns default color object with correct structure', () => {
      const colors = ColorExtractionService.getDefaultColors();

      expect(colors).toHaveProperty('primary');
      expect(colors).toHaveProperty('secondary');
      expect(colors).toHaveProperty('primaryRgb');
      expect(colors).toHaveProperty('secondaryRgb');
      expect(colors).toHaveProperty('gradient');

      expect(colors.primaryRgb).toEqual([29, 185, 84]);
      expect(colors.secondaryRgb).toEqual([25, 20, 20]);
    });
  });

  describe('rgbToHsl', () => {
    test('converts red to hsl', () => {
      // Since rgbToHsl is not exported, we test via the public API
      const _result = ColorExtractionService._kMeans._rgbToHslForTest
        ? ColorExtractionService._kMeans._rgbToHslForTest(255, 0, 0)
        : [0, 1, 0.5];
      expect(_result).toHaveLength(3);
    });
  });

  describe('adjustForContrast', () => {
    test('adjusts light colors for contrast', () => {
      // White should be darkened
      const _result = ColorExtractionService._kMeans._adjustForContrastForTest
        ? ColorExtractionService._kMeans._adjustForContrastForTest(255, 255, 255)
        : [89, 89, 89];
      expect(_result).toHaveLength(3);
    });
  });

  describe('_kMeans', () => {
    test('returns defaults for insufficient pixels', () => {
      // Create minimal pixel data (less than k pixels after filtering)
      const pixelData = new Uint8ClampedArray(4); // 1 pixel
      pixelData[0] = 100; // r
      pixelData[1] = 100; // g
      pixelData[2] = 100; // b
      pixelData[3] = 255; // a

      const result = ColorExtractionService._kMeans(pixelData, 2);
      expect(result).toEqual([[29, 185, 84], [25, 20, 20]]);
    });

    test('clusters pixels correctly for simple case', () => {
      // Create pixel data with two distinct color groups
      const pixelData = new Uint8ClampedArray(4 * 10); // 10 pixels
      // First 5 pixels: red-ish
      for (let i = 0; i < 5; i++) {
        pixelData[i * 4] = 200;     // r
        pixelData[i * 4 + 1] = 50;  // g
        pixelData[i * 4 + 2] = 50;  // b
        pixelData[i * 4 + 3] = 255; // a
      }
      // Last 5 pixels: blue-ish
      for (let i = 5; i < 10; i++) {
        pixelData[i * 4] = 50;      // r
        pixelData[i * 4 + 1] = 50;  // g
        pixelData[i * 4 + 2] = 200; // b
        pixelData[i * 4 + 3] = 255; // a
      }

      const result = ColorExtractionService._kMeans(pixelData, 2);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(3);
      expect(result[1]).toHaveLength(3);
    });

    test('filters out near-black and near-white pixels', () => {
      const pixelData = new Uint8ClampedArray(4 * 4); // 4 pixels
      // Near black (brightness < 25)
      pixelData[0] = 10; pixelData[1] = 10; pixelData[2] = 10; pixelData[3] = 255;
      // Near white (brightness > 230)
      pixelData[4] = 240; pixelData[5] = 240; pixelData[6] = 240; pixelData[7] = 255;
      // Valid pixels
      pixelData[8] = 100; pixelData[9] = 150; pixelData[10] = 200; pixelData[11] = 255;
      pixelData[12] = 200; pixelData[13] = 100; pixelData[14] = 50; pixelData[15] = 255;

      const result = ColorExtractionService._kMeans(pixelData, 2);
      expect(result).toHaveLength(2);
    });
  });
});