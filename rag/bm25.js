export const K1 = 1.4;
export const B = 0.75;

/**
 * 倒排表用扁平数组 [docId, tf, docId, tf, ...] 存，比 Map 省内存也更快。
 */
export function buildBm25(segments) {
  const postings = new Map();
  let totalLen = 0;

  for (let i = 0; i < segments.length; i += 1) {
    const tf = new Map();
    for (const token of segments[i].tokens) tf.set(token, (tf.get(token) || 0) + 1);
    segments[i].len = segments[i].tokens.length;
    totalLen += segments[i].len;

    for (const [term, count] of tf) {
      let list = postings.get(term);
      if (!list) {
        list = [];
        postings.set(term, list);
      }
      list.push(i, count);
    }
  }

  return {
    postings,
    segments,
    count: segments.length,
    avgdl: totalLen / Math.max(segments.length, 1),
  };
}

export function bm25Search(index, queryTokens, options = {}) {
  const { allowed = null, limit = 10 } = options;
  const terms = new Set(queryTokens);
  const scores = new Map();

  for (const term of terms) {
    const list = index.postings.get(term);
    if (!list) continue;
    const df = list.length / 2;
    const idf = Math.log(1 + (index.count - df + 0.5) / (df + 0.5));

    for (let p = 0; p < list.length; p += 2) {
      const docId = list[p];
      if (allowed && !allowed.has(docId)) continue;
      const tf = list[p + 1];
      const seg = index.segments[docId];
      const denom = tf + K1 * (1 - B + B * (seg.len / index.avgdl));
      scores.set(docId, (scores.get(docId) || 0) + (idf * (tf * (K1 + 1))) / denom);
    }
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([docId, score]) => ({ docId, score }));
}
