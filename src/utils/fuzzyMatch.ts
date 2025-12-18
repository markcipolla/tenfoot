export interface FuzzyMatchResult<T> {
  item: T;
  score: number;
}

export function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q.length === 0) return 1;
  if (t.length === 0) return 0;

  // Exact match
  if (t === q) return 1;

  // Contains match
  if (t.includes(q)) {
    return 0.9 - (t.indexOf(q) / t.length) * 0.1;
  }

  // Starts with match
  if (t.startsWith(q)) return 0.95;

  // Character-by-character fuzzy match
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let totalMatches = 0;

  for (let i = 0; i < t.length && queryIndex < q.length; i++) {
    if (t[i] === q[queryIndex]) {
      queryIndex++;
      totalMatches++;
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    } else {
      consecutiveMatches = 0;
    }
  }

  if (queryIndex < q.length) {
    return 0; // Not all query chars found
  }

  // Score based on how well the query matches
  const matchRatio = totalMatches / q.length;
  const consecutiveBonus = maxConsecutive / q.length;
  const lengthPenalty = Math.min(1, q.length / t.length);

  return (matchRatio * 0.4 + consecutiveBonus * 0.4 + lengthPenalty * 0.2) * 0.8;
}

export function fuzzySearch<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
  minScore = 0.1
): FuzzyMatchResult<T>[] {
  if (!query.trim()) {
    return items.map(item => ({ item, score: 1 }));
  }

  return items
    .map(item => ({
      item,
      score: fuzzyMatch(query, getSearchText(item)),
    }))
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
