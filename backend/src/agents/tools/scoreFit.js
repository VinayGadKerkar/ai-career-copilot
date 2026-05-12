// Lightweight keyword scoring - runs fast without AI
const scoreFit = ({ resumeText, jobDescription }) => {
  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  // Extract keywords from JD (words longer than 3 chars)
  const jdWords = jdLower
    .split(/[\s,.\-()[\]{}]+/)
    .filter(w => w.length > 3)
    .filter(w => !['with', 'this', 'that', 'have', 'will', 'your',
                   'from', 'they', 'been', 'more', 'also', 'into',
                   'than', 'then', 'when', 'what', 'which'].includes(w));

  const uniqueJdWords = [...new Set(jdWords)];

  const matched = uniqueJdWords.filter(word => resumeLower.includes(word));
  const missing = uniqueJdWords.filter(word => !resumeLower.includes(word));

  const score = Math.round((matched.length / uniqueJdWords.length) * 100);

  return {
    keywordScore: score,
    matchedKeywords: matched.slice(0, 15),
    missingKeywords: missing.slice(0, 15)
  };
};

module.exports = { scoreFit };