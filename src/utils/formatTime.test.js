import { formatTime } from './formatTime';

describe('formatTime', () => {
  test('formats seconds correctly', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(30)).toBe('0:30');
    expect(formatTime(59)).toBe('0:59');
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(125)).toBe('2:05');
    expect(formatTime(3661)).toBe('61:01');
  });

  test('handles negative values', () => {
    expect(formatTime(-10)).toBe('0:00');
    expect(formatTime(-3600)).toBe('0:00');
  });

  test('handles decimal values', () => {
    expect(formatTime(60.9)).toBe('1:00');
    expect(formatTime(90.1)).toBe('1:30');
  });

  test('handles large values', () => {
    expect(formatTime(3600)).toBe('60:00');
    expect(formatTime(7200)).toBe('120:00');
  });
});