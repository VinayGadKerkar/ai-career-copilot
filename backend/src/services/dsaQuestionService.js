const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const DSA_ROOT = process.env.DSA_QUESTIONS_PATH ||
  path.join(__dirname, '../../../../interview-company-wise-problems-main');

// ─── In-memory cache: { normalizedCompany: [questions] } ────────────────────
let questionCache = null;

/**
 * Normalize a company name for fuzzy matching:
 * lowercase, remove punctuation/spaces, keep alphanumeric only
 */
function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Load all CSV files from DSA_ROOT on first call and cache them.
 */
function loadCache() {
  if (questionCache) return questionCache;

  questionCache = {};

  if (!fs.existsSync(DSA_ROOT)) {
    console.warn(`[DSA] Folder not found: ${DSA_ROOT}`);
    return questionCache;
  }

  const companies = fs.readdirSync(DSA_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const company of companies) {
    const companyDir = path.join(DSA_ROOT, company);
    // We prefer "5. All.csv" — it has the full problem set
    const allCsv = path.join(companyDir, '5. All.csv');
    const csvFile = fs.existsSync(allCsv)
      ? allCsv
      : fs.readdirSync(companyDir)
          .filter(f => f.endsWith('.csv'))
          .map(f => path.join(companyDir, f))
          .sort()
          .pop();

    if (!csvFile || !fs.existsSync(csvFile)) continue;

    try {
      const raw = fs.readFileSync(csvFile, 'utf8');
      const records = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      const questions = records
        .filter(r => r.Difficulty && r.Title && r.Link)
        .map(r => ({
          difficulty: (r.Difficulty || '').toUpperCase().trim(),   // EASY|MEDIUM|HARD
          title:      (r.Title || '').trim(),
          frequency:  parseFloat(r.Frequency) || 0,
          acceptance: parseFloat(r['Acceptance Rate']) || 0,
          link:       (r.Link || '').trim(),
          topics:     (r.Topics || '').split(',').map(t => t.trim()).filter(Boolean)
        }));

      questionCache[normalize(company)] = { originalName: company, questions };
    } catch (e) {
      console.warn(`[DSA] Failed to parse ${csvFile}: ${e.message}`);
    }
  }

  console.log(`[DSA] Loaded ${Object.keys(questionCache).length} companies from ${DSA_ROOT}`);
  return questionCache;
}

/**
 * Pick 4–5 DSA questions for a company with difficulty distribution:
 *   1 Easy, 2 Medium, 1-2 Hard  (total 4-5, sorted by frequency desc)
 *
 * @param {string} companyName - The company name from the job (fuzzy matched)
 * @returns {{ found: boolean, company: string, questions: object[] }}
 */
function getQuestionsForCompany(companyName) {
  const cache = loadCache();
  const key = normalize(companyName);

  // Try exact match first, then partial match
  let entry = cache[key];
  if (!entry) {
    const keys = Object.keys(cache);
    const partial = keys.find(k => k.includes(key) || key.includes(k));
    entry = partial ? cache[partial] : null;
  }

  if (!entry || !entry.questions.length) {
    return { found: false, company: companyName, questions: [] };
  }

  const { originalName, questions } = entry;

  // Split by difficulty
  const easy   = questions.filter(q => q.difficulty === 'EASY')
                          .sort((a, b) => b.frequency - a.frequency);
  const medium = questions.filter(q => q.difficulty === 'MEDIUM')
                          .sort((a, b) => b.frequency - a.frequency);
  const hard   = questions.filter(q => q.difficulty === 'HARD')
                          .sort((a, b) => b.frequency - a.frequency);

  const pick = (arr, n) => arr.slice(0, n);

  // Distribution: 1 Easy + 2 Medium + 1-2 Hard = 4-5 total
  const selected = [
    ...pick(easy,   1),
    ...pick(medium, 2),
    ...pick(hard,   Math.min(2, hard.length))
  ].slice(0, 5);

  return { found: true, company: originalName, questions: selected };
}

/** Clear cache (useful for hot-reload in dev) */
function clearCache() {
  questionCache = null;
}

module.exports = { getQuestionsForCompany, clearCache };
