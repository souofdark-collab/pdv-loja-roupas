export function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function fuzzyMatch(haystack, needle, tolerance = null) {
  if (!needle) return true;
  const h = normalize(haystack);
  const n = normalize(needle);
  if (h.includes(n)) return true;
  const words = h.split(/\s+/);
  const tol = tolerance ?? (n.length <= 4 ? 1 : n.length <= 7 ? 2 : 3);
  for (const w of words) {
    if (levenshtein(w, n) <= tol) return true;
    if (w.length >= n.length && levenshtein(w.slice(0, n.length), n) <= tol) return true;
  }
  return false;
}

export function fuzzyFilter(items, query, keys) {
  if (!query) return items;
  return items.filter(item => keys.some(k => fuzzyMatch(item[k], query)));
}
