import { djEngine } from './DJEngine';

describe('DJEngine', () => {
  beforeEach(() => {
    // Reset history and session
    djEngine.history = [];
    djEngine.sessionStartTime = Date.now();
    djEngine.currentPhase = 'warmup';
    djEngine.currentMode = 'BALANCED';
  });

  describe('calculateBPMCompatibility', () => {
    test('returns 1.0 for exact match', () => {
      expect(djEngine.calculateBPMCompatibility(120, 120)).toBe(1.0);
      expect(djEngine.calculateBPMCompatibility(128, 128)).toBe(1.0);
    });

    test('returns 0.95 for near match (±4%)', () => {
      expect(djEngine.calculateBPMCompatibility(120, 124)).toBe(0.95);
      expect(djEngine.calculateBPMCompatibility(120, 116)).toBe(0.95);
    });

    test('returns 0.8 for compatible match (±8%)', () => {
      expect(djEngine.calculateBPMCompatibility(120, 128)).toBe(0.8);
      expect(djEngine.calculateBPMCompatibility(120, 112)).toBe(0.8);
    });

    test('returns 0.4 for barely compatible (±12%)', () => {
      expect(djEngine.calculateBPMCompatibility(120, 134)).toBe(0.4);
      expect(djEngine.calculateBPMCompatibility(120, 106)).toBe(0.4);
    });

    test('returns 0.1 for incompatible', () => {
      expect(djEngine.calculateBPMCompatibility(120, 150)).toBe(0.1);
      expect(djEngine.calculateBPMCompatibility(120, 90)).toBe(0.1);
    });

    test('handles double/half tempo compatibility', () => {
      // 70 BPM and 140 BPM are exact double/half - should return 1.0
      expect(djEngine.calculateBPMCompatibility(70, 140)).toBe(1.0);
      expect(djEngine.calculateBPMCompatibility(140, 70)).toBe(1.0);
    });
  });

  describe('getTransitionPlan', () => {
    test('returns valid plan for high energy tracks', () => {
      const trackA = { bpm: 128, energy: 80 };
      const trackB = { bpm: 128, energy: 80 };

      const plan = djEngine.getTransitionPlan(trackA, trackB);

      expect(plan).toHaveProperty('duration');
      expect(plan).toHaveProperty('type');
      expect(plan).toHaveProperty('syncBeats');
      expect(plan).toHaveProperty('playbackRate');
      expect(plan).toHaveProperty('phrasesCount');
      expect(plan).toHaveProperty('barDuration');
      expect(plan).toHaveProperty('beatDuration');

      expect(plan.duration).toBeGreaterThanOrEqual(4);
      expect(plan.duration).toBeLessThanOrEqual(20);
    });

    test('returns valid plan for low energy tracks', () => {
      const trackA = { bpm: 90, energy: 20 };
      const trackB = { bpm: 90, energy: 20 };

      const plan = djEngine.getTransitionPlan(trackA, trackB);

      expect(plan.type).toBe('ethereal');
      expect(plan.duration).toBeGreaterThanOrEqual(4);
    });

    test('handles missing BPM/energy with defaults', () => {
      const trackA = {};
      const trackB = {};

      const plan = djEngine.getTransitionPlan(trackA, trackB);

      expect(plan).toHaveProperty('duration');
      expect(plan.duration).toBeGreaterThanOrEqual(4);
      expect(plan.duration).toBeLessThanOrEqual(20);
    });

    test('returns shorter transition for high-to-high energy', () => {
      const trackA = { bpm: 128, energy: 80 };
      const trackB = { bpm: 128, energy: 80 };

      const plan = djEngine.getTransitionPlan(trackA, trackB);

      // High energy tracks should have shorter transitions (power-swap = 1 phrase)
      expect(plan.phrasesCount).toBe(1);
    });
  });

  describe('calculateMatchScore', () => {
    test('returns score for compatible tracks', () => {
      const trackA = { bpm: 128, energy: 60, analyzed: true };
      const trackB = { bpm: 128, energy: 60, analyzed: true };

      const score = djEngine.calculateMatchScore(trackA, trackB);

      expect(score).toBeGreaterThan(0);
      // Score is a weighted sum, can exceed 1 (not a probability)
      expect(score).toBeLessThanOrEqual(1.5);
    });

    test('returns 0 for null tracks', () => {
      expect(djEngine.calculateMatchScore(null, { bpm: 128 })).toBe(0);
      expect(djEngine.calculateMatchScore({ bpm: 128 }, null)).toBe(0);
    });

    test('excludes recently played tracks', () => {
      const trackA = { id: '1', bpm: 128, energy: 60, analyzed: true };
      const trackB = { id: '2', bpm: 128, energy: 60, analyzed: true };
      const trackC = { id: '3', bpm: 128, energy: 60, analyzed: true };

      djEngine.history = ['2'];

      const scoreA = djEngine.calculateMatchScore(trackA, trackB);
      const scoreC = djEngine.calculateMatchScore(trackA, trackC);

      // trackB is in history, should have lower score
      expect(scoreC).toBeGreaterThanOrEqual(scoreA);
    });
  });

  describe('session phases', () => {
    test('updates session phase based on time', () => {
      djEngine.sessionStartTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      djEngine.updateSessionPhase();
      expect(djEngine.currentPhase).toBe('warmup');

      djEngine.sessionStartTime = Date.now() - 20 * 60 * 1000; // 20 minutes ago
      djEngine.updateSessionPhase();
      expect(djEngine.currentPhase).toBe('groove');

      djEngine.sessionStartTime = Date.now() - 45 * 60 * 1000; // 45 minutes ago
      djEngine.updateSessionPhase();
      expect(djEngine.currentPhase).toBe('peak');

      djEngine.sessionStartTime = Date.now() - 90 * 60 * 1000; // 90 minutes ago
      djEngine.updateSessionPhase();
      expect(djEngine.currentPhase).toBe('cooldown');
    });
  });

  describe('setMode', () => {
    test('sets valid modes', () => {
      djEngine.setMode('CHILL');
      expect(djEngine.currentMode).toBe('CHILL');

      djEngine.setMode('ENERGY');
      expect(djEngine.currentMode).toBe('ENERGY');

      djEngine.setMode('BALANCED');
      expect(djEngine.currentMode).toBe('BALANCED');
    });

    test('ignores invalid modes', () => {
      djEngine.setMode('INVALID');
      expect(djEngine.currentMode).toBe('BALANCED');
    });
  });
});