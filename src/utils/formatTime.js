/**
 * Formatea un tiempo en segundos a formato MM:SS.
 * @param {number} timeInSeconds - Tiempo en segundos.
 * @returns {string} Tiempo formateado como MM:SS.
 */
export function formatTime(timeInSeconds) {
  const totalSeconds = Math.max(0, Math.floor(timeInSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}