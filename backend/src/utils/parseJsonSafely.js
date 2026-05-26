/**
 * Robustly parse JSON from an LLM response.
 * Handles:
 *   - Raw JSON
 *   - JSON wrapped in ```json ... ``` or ``` ... ```
 *   - Extra text before/after the JSON object
 *
 * @param {string} content - raw LLM output string
 * @param {*} [fallback]   - value to return if parsing fails (throws if not provided)
 * @returns {object}
 */
function parseJsonSafely(content, fallback) {
  // Step 1: strip markdown code fences
  let cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Step 2: try a straight parse first (model behaved)
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Step 3: find the outermost { ... } block
  // Use index of first '{' and last '}' for robustness
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {}
  }

  // Step 4: fallback or throw
  if (fallback !== undefined) {
    console.warn('[parseJsonSafely] Could not parse JSON, returning fallback. Raw content:\n', content.slice(0, 500));
    return fallback;
  }

  throw new Error('Could not parse JSON from LLM response');
}

module.exports = { parseJsonSafely };
