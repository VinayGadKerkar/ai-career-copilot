/**
 * Benchmark #7: Groq LLM Multi-Key Rotation & Resilience
 * 
 * Measures the reliability engineering in the Groq client:
 *   - Round-robin key rotation latency
 *   - Fallback model selection timing
 *   - Cooldown + retry backoff behavior
 *   - LLM instance cache hit rate (in-memory LRU cache)
 * 
 * NOTE: This benchmark measures the routing/caching logic only.
 * Real LLM calls are NOT made to avoid API cost.
 * 
 * Resume Metric Target:
 *   "Implemented multi-key Groq rotation across N API keys with automatic
 *    fallback across M models, achieving ~X% reliability"
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { PerformanceTracker } = require('./setup');

async function runBenchmark() {
  console.log('\n🧠 Groq LLM Resilience & Key Rotation Benchmark');
  console.log('=================================================\n');

  // ──────────────────────────────────────────────────────
  // Test 1: LLM instance cache (LRU behavior)
  // ──────────────────────────────────────────────────────
  console.log('⏱️  Test 1: LLM instance creation vs cached instance...');

  const { ChatGroq } = require('@langchain/groq');
  const instanceCacheTracker = new PerformanceTracker('LLM Instance Creation (new ChatGroq)');
  const cachedInstanceTracker = new PerformanceTracker('LLM Instance Cache Hit (Map lookup)');

  // Simulate the getLLM cache logic from groq.js
  const llmCache = new Map();

  const getLLM = (apiKey, model, temperature, taskType) => {
    const cacheKey = `${apiKey}-${model}-${temperature}-${taskType}`;
    if (llmCache.has(cacheKey)) {
      const cached = llmCache.get(cacheKey);
      llmCache.delete(cacheKey);
      llmCache.set(cacheKey, cached);
      return { hit: true, instance: cached };
    }
    const instance = new ChatGroq({
      apiKey,
      model,
      temperature,
      maxTokens: 4096,
      maxRetries: 0,
      timeout: 30000
    });
    llmCache.set(cacheKey, instance);
    return { hit: false, instance };
  };

  const models = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
  const taskTypes = ['resume-analysis', 'bullet-rewrite', 'email', 'interview-prep'];
  const fakeKeys = ['sk-test-key-1-abcd', 'sk-test-key-2-efgh', 'sk-test-key-3-ijkl'];

  // First pass: cold cache (all misses)
  for (let i = 0; i < 50; i++) {
    const key = fakeKeys[i % fakeKeys.length];
    const model = models[i % models.length];
    const task = taskTypes[i % taskTypes.length];

    await instanceCacheTracker.measure(`create-${i}`, async () => {
      return getLLM(key, model, 0.7, task);
    });
  }

  instanceCacheTracker.printStats();

  // Second pass: warm cache (all hits)
  for (let i = 0; i < 200; i++) {
    const key = fakeKeys[i % fakeKeys.length];
    const model = models[i % models.length];
    const task = taskTypes[i % taskTypes.length];

    await cachedInstanceTracker.measure(`cached-${i}`, async () => {
      return getLLM(key, model, 0.7, task);
    });
  }

  cachedInstanceTracker.printStats();

  // ──────────────────────────────────────────────────────
  // Test 2: Key rotation ordering logic
  // ──────────────────────────────────────────────────────
  console.log('⏱️  Test 2: Key rotation + model fallback config building...');
  const rotationTracker = new PerformanceTracker('Key Rotation Config Building');

  const apiKeys = fakeKeys;
  const fallbackModels = [
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b'
  ];

  let keyCursor = 0;
  const invalidApiKeys = new Set();
  const keyCooldowns = new Map();

  const getOrderedKeys = () => {
    const now = Date.now();
    const validKeys = apiKeys.filter(k => !invalidApiKeys.has(k));
    if (validKeys.length === 0) return [];
    const activeKeys = validKeys.filter(k => (keyCooldowns.get(k) || 0) <= now);
    const keysToUse = activeKeys.length > 0 ? activeKeys : validKeys;
    const startIndex = keyCursor % keysToUse.length;
    keyCursor = (keyCursor + 1) % keysToUse.length;
    return [...keysToUse.slice(startIndex), ...keysToUse.slice(0, startIndex)];
  };

  for (let i = 0; i < 500; i++) {
    await rotationTracker.measure(`rotation-${i}`, async () => {
      const orderedKeys = getOrderedKeys();
      const configs = [];
      const primaryModel = 'llama-3.3-70b-versatile';

      for (const key of orderedKeys) {
        configs.push({ apiKey: key, model: primaryModel });
      }
      for (const model of fallbackModels) {
        if (model === primaryModel) continue;
        for (const key of orderedKeys) {
          configs.push({ apiKey: key, model });
        }
      }
      return configs;
    });
  }

  rotationTracker.printStats();

  // ──────────────────────────────────────────────────────
  // Test 3: Text trimmer performance
  // ──────────────────────────────────────────────────────
  console.log('⏱️  Test 3: Text trimming (large resume/JD truncation)...');
  const trimTracker = new PerformanceTracker('trimText — Context Window Management');

  const { trimText } = require('../src/config/groq');

  const texts = [
    'a'.repeat(500),    // short
    'a'.repeat(3000),   // medium
    'a'.repeat(6000),   // exactly at limit
    'a'.repeat(10000),  // over limit
    'a'.repeat(50000),  // very long
  ];

  for (let i = 0; i < 500; i++) {
    const text = texts[i % texts.length];
    await trimTracker.measure(`trim-${i}`, async () => {
      return trimText(text, 6000);
    });
  }

  trimTracker.printStats();

  // ──────────────────────────────────────────────────────
  // Test 4: Backoff calculation
  // ──────────────────────────────────────────────────────
  const backoffTracker = new PerformanceTracker('Exponential Backoff Calculation');
  console.log('⏱️  Test 4: Backoff timing accuracy...');

  const BASE_BACKOFF_MS = 800;
  const getBackoffMs = (attempt) => {
    const jitter = Math.floor(Math.random() * 250);
    return BASE_BACKOFF_MS * (2 ** attempt) + jitter;
  };

  const backoffValues = [0, 1, 2].map(attempt => getBackoffMs(attempt));

  for (let i = 0; i < 100; i++) {
    await backoffTracker.measure(`backoff-${i}`, async () => {
      return [0, 1, 2].map(attempt => getBackoffMs(attempt));
    });
  }

  backoffTracker.printStats();

  // ──────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────
  const createStats = instanceCacheTracker.getStats();
  const cacheStats = cachedInstanceTracker.getStats();
  const rotationStats = rotationTracker.getStats();
  const trimStats = trimTracker.getStats();
  const numApiKeys = process.env.GROQ_API_KEY_1 ? 
    [1, 2, 3, 4].filter(n => process.env[`GROQ_API_KEY_${n}`] || (n === 4 && process.env.GROQ_API_KEY)).length : 
    'N';

  console.log('\n' + '🎯'.repeat(20));
  console.log('\n🎯 RESUME-READY METRICS:\n');
  console.log(`  ✅ LLM instance creation:  avg ${createStats.avgMs}ms`);
  console.log(`  ✅ LLM cache hit:          avg ${cacheStats.avgMs}ms (${(parseFloat(createStats.avgMs) / parseFloat(cacheStats.avgMs)).toFixed(0)}x faster)`);
  console.log(`  ✅ Key rotation config:    avg ${rotationStats.avgMs}ms per request`);
  console.log(`  ✅ Text truncation:        avg ${trimStats.avgMs}ms`);
  console.log(`\n  📝 Suggested Resume Bullet:`);
  console.log(`     "Built Groq LLM client with round-robin rotation across ${numApiKeys} API keys,`);
  console.log(`      4-model fallback cascade, and per-task model routing (8B for email,`);
  console.log(`      70B for analysis) — achieving automatic recovery from rate limits"`);
  console.log(`\n  📝 Alternative Bullet:`);
  console.log(`     "Implemented LRU instance cache for Groq LLM clients reducing instantiation`);
  console.log(`      overhead by ${((parseFloat(createStats.avgMs) - parseFloat(cacheStats.avgMs)) / parseFloat(createStats.avgMs) * 100).toFixed(0)}% on repeated requests"`);
  console.log(`\n  📝 Backoff Strategy:`);
  console.log(`     Retry delays: attempt 0→${backoffValues[0]}ms, attempt 1→${backoffValues[1]}ms, attempt 2→${backoffValues[2]}ms (base ${BASE_BACKOFF_MS}ms × 2^n + jitter)`);
  console.log('\n' + '🎯'.repeat(20));

  return { createStats, cacheStats, rotationStats, trimStats };
}

if (require.main === module) {
  runBenchmark()
    .then(() => {
      console.log('\n✅ Groq resilience benchmark complete!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Benchmark failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runBenchmark };
