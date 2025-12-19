import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzySearch } from './fuzzyMatch';

describe('fuzzyMatch', () => {
  it('returns 1 for empty query', () => {
    expect(fuzzyMatch('', 'any text')).toBe(1);
  });

  it('returns 0 for empty target', () => {
    expect(fuzzyMatch('query', '')).toBe(0);
  });

  it('returns 1 for exact match', () => {
    expect(fuzzyMatch('test', 'test')).toBe(1);
  });

  it('is case insensitive', () => {
    expect(fuzzyMatch('TEST', 'test')).toBe(1);
    expect(fuzzyMatch('test', 'TEST')).toBe(1);
    expect(fuzzyMatch('TeSt', 'tEsT')).toBe(1);
  });

  it('returns high score for contains match', () => {
    const score = fuzzyMatch('craft', 'Minecraft');
    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThan(1);
  });

  it('returns higher score when match is at start of target', () => {
    const startScore = fuzzyMatch('mine', 'Minecraft');
    const middleScore = fuzzyMatch('craft', 'Minecraft');
    expect(startScore).toBeGreaterThan(middleScore);
  });

  it('returns 0 when not all query chars are found', () => {
    expect(fuzzyMatch('xyz', 'abc')).toBe(0);
    expect(fuzzyMatch('hello', 'helo')).toBe(0);
  });

  it('scores partial matches correctly', () => {
    const score = fuzzyMatch('btlf', 'Battlefield');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.8);
  });

  it('scores consecutive matches higher', () => {
    // 'bat' matches consecutively in 'Battlefield'
    const consecutiveScore = fuzzyMatch('bat', 'Battlefield');
    // 'blf' does not match consecutively
    const nonConsecutiveScore = fuzzyMatch('blf', 'Battlefield');
    expect(consecutiveScore).toBeGreaterThan(nonConsecutiveScore);
  });

  it('handles real game name searches', () => {
    expect(fuzzyMatch('cs', 'Counter-Strike 2')).toBeGreaterThan(0);
    expect(fuzzyMatch('gta', 'Grand Theft Auto V')).toBeGreaterThan(0);
    expect(fuzzyMatch('witcher', 'The Witcher 3: Wild Hunt')).toBeGreaterThan(0.8);
    expect(fuzzyMatch('skyrim', 'The Elder Scrolls V: Skyrim')).toBeGreaterThan(0.8);
  });
});

describe('fuzzySearch', () => {
  const items = [
    { id: '1', name: 'Minecraft' },
    { id: '2', name: 'Terraria' },
    { id: '3', name: 'Counter-Strike 2' },
    { id: '4', name: 'Grand Theft Auto V' },
    { id: '5', name: 'The Witcher 3' },
  ];

  const getSearchText = (item: { name: string }) => item.name;

  it('returns all items with score 1 for empty query', () => {
    const results = fuzzySearch(items, '', getSearchText);
    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result.score).toBe(1);
    });
  });

  it('returns all items with score 1 for whitespace-only query', () => {
    const results = fuzzySearch(items, '   ', getSearchText);
    expect(results).toHaveLength(5);
  });

  it('filters items by minimum score', () => {
    const results = fuzzySearch(items, 'xyz', getSearchText, 0.1);
    expect(results).toHaveLength(0);
  });

  it('sorts results by score descending', () => {
    const results = fuzzySearch(items, 'mine', getSearchText);
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('finds exact matches first', () => {
    const results = fuzzySearch(items, 'Minecraft', getSearchText);
    expect(results[0].item.name).toBe('Minecraft');
    expect(results[0].score).toBe(1);
  });

  it('finds partial matches', () => {
    const results = fuzzySearch(items, 'craft', getSearchText);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.item.name === 'Minecraft')).toBe(true);
  });

  it('respects custom minimum score', () => {
    const lowThreshold = fuzzySearch(items, 't', getSearchText, 0.01);
    const highThreshold = fuzzySearch(items, 't', getSearchText, 0.9);
    expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
  });
});
