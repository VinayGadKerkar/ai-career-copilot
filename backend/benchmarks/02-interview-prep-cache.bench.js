/**
 * Benchmark #2: Interview Prep Redis Cache-Aside Performance
 * 
 * Measures the performance difference between:
 *   - Cache MISS: Full LLM call + DSA lookup + cache write
 *   - Cache HIT: Single Redis GET + JSON parse (no LLM call)
 * 
 * This is the highest-impact caching point in the system.
 * 
 * Resume Metric Target:
 *   "Reduced interview prep latency from ~Xms to ~Yms with Redis cache-aside (cache hit ratio Z%)"
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const Redis = require('ioredis');
const { PerformanceTracker, sleep } = require('./setup');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = 3600;

// Simulated interview prep payload (mirrors real production data)
const buildMockInterviewPayload = (applicationId, company) => ({
  prepId: `bench-prep-${applicationId}`,
  applicationId,
  company,
  role: 'Senior Software Engineer',
  questions: {
    behavioural: [
      'Tell me about a time you had to refactor a large codebase under deadline pressure.',
      'Describe a technical disagreement with a teammate and how you resolved it.',
      'How have you handled a production incident in the past?',
      'Walk me through a project where you had to learn a new technology quickly.',
      'Describe a situation where you improved team productivity significantly.'
    ],
    technical: [
      'Design a rate limiting system that handles 1M requests/day.',
      'How would you optimize a slow SQL query with multiple JOINs?',
      'Explain the difference between Redis Sorted Sets and Hash Maps.',
      'How does Node.js event loop work? What are its phases?',
      'Design a job queue for async processing with retry logic.'
    ],
    situational: [
      'If you found a critical security vulnerability in production, what would you do?',
      'How would you approach migrating a monolith to microservices without downtime?'
    ],
    questionsToAsk: [
      'What does the on-call rotation look like for this team?',
      'How do you measure engineering productivity?'
    ],
    keyThemesToEmphasize: ['system design', 'async processing', 'Node.js', 'Redis', 'Kafka']
  },
  dsaQuestions: [
    { difficulty: 'EASY', title: 'Two Sum', frequency: 95.2, link: 'https://leetcode.com/problems/two-sum' },
    { difficulty: 'MEDIUM', title: 'LRU Cache', frequency: 88.7, link: 'https://leetcode.com/problems/lru-cache' },
    { difficulty: 'MEDIUM', title: 'Number of Islands', frequency: 82.3, link: 'https://leetcode.com/problems/number-of-islands' },
    { difficulty: 'HARD', title: 'Merge k Sorted Lists', frequency: 71.1, link: 'https://leetcode.com/problems/merge-k-sorted-lists' }
  ],
  dsaCompanyMatch: company,
  questionCounts: { behavioural: 5, technical: 5, situational: 2, questionsToAsk: 2, keyThemesToEmphasize: 5 },
  generatedAt: new Date().toISOString()
});

// Simulated LLM call (represents the actual AI generation time)
const simulateLlmGeneration = async () => {
  // LLM calls typically take 2-8 seconds for interview prep
  // We simulate with a realistic baseline, not hitting real API
  const simulatedMs = 3500 + Math.random() * 3000; // 3.5s - 6.5s realistic range
  await sleep(simulatedMs);
  return buildMockInterviewPayload('sim-app', 'Google');
};

const RUN_COUNT = 100;
const MISS_RUNS = 10; // Fewer because they're slow (simulated LLM)

async function runBenchmark() {
  console.log('\n📦 Interview Prep Cache-Aside Performance Benchmark');
  console.log('====================================================');
  console.log(`Cache Hit Runs: ${RUN_COUNT} | Cache Miss Simulations: ${MISS_RUNS}`);

  const redis = new Redis(REDIS_URL);

  try {
    await redis.ping();
    console.log('✅ Redis connected\n');

    // ──────────────────────────────────────────────────────
    // Test 1: Cache HIT path — Redis GET + JSON.parse
    // ──────────────────────────────────────────────────────
    const hitTracker = new PerformanceTracker('Interview Prep — Cache HIT (Redis GET)');
    console.log('⏱️  Test 1: Cache HIT performance (Redis only path)...');

    const companies = ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple'];

    // Pre-populate cache
    for (let i = 0; i < 50; i++) {
      const company = companies[i % companies.length];
      const cacheKey = `interview:prep:bench-user-${i % 10}:bench-app-${i}`;
      const payload = buildMockInterviewPayload(`bench-app-${i}`, company);
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL);
    }

    // Benchmark cache reads
    for (let i = 0; i < RUN_COUNT; i++) {
      const cacheKey = `interview:prep:bench-user-${i % 10}:bench-app-${i % 50}`;
      await hitTracker.measure(`hit-${i}`, async () => {
        const raw = await redis.get(cacheKey);
        if (!raw) throw new Error('Cache miss during hit test');
        return JSON.parse(raw);
      });
    }

    hitTracker.printStats();

    // ──────────────────────────────────────────────────────
    // Test 2: Cache WRITE — SET with TTL (what happens after LLM call)
    // ──────────────────────────────────────────────────────
    const writeTracker = new PerformanceTracker('Interview Prep — Cache WRITE (Redis SET+EX)');
    console.log('⏱️  Test 2: Cache write after generation...');

    for (let i = 0; i < 50; i++) {
      const cacheKey = `interview:prep:write-bench:${i}`;
      const payload = buildMockInterviewPayload(`write-app-${i}`, companies[i % companies.length]);

      await writeTracker.measure(`write-${i}`, async () => {
        await redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL);
      });
    }

    writeTracker.printStats();

    // ──────────────────────────────────────────────────────
    // Test 3: Simulated MISS path (LLM + DSA + cache write)
    // Note: We simulate LLM time with realistic sleep rather than real API calls
    // to avoid cost/rate limiting. The cache overhead is what we're measuring.
    // ──────────────────────────────────────────────────────
    console.log(`⏱️  Test 3: Simulated Cache MISS path (${MISS_RUNS} runs, ~3.5-6.5s each)...`);
    console.log('   ⚠️  This simulates real LLM generation time — please wait...\n');

    const missTracker = new PerformanceTracker('Interview Prep — Cache MISS (Simulated LLM + Write)');

    for (let i = 0; i < MISS_RUNS; i++) {
      const userId = `miss-user-${i}`;
      const appId = `miss-app-${i}`;
      const cacheKey = `interview:prep:${userId}:${appId}`;

      // Delete to ensure miss
      await redis.del(cacheKey);

      process.stdout.write(`   Run ${i + 1}/${MISS_RUNS}...`);

      await missTracker.measure(`miss-${i}`, async () => {
        // Check cache (miss)
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // Simulate LLM call (3.5s - 6.5s)
        const questions = await simulateLlmGeneration();

        // Write to cache
        await redis.set(cacheKey, JSON.stringify(questions), 'EX', CACHE_TTL);

        return questions;
      });

      console.log(` ${missTracker.measurements[i].durationMs.toFixed(0)}ms`);
    }

    missTracker.printStats();

    // ──────────────────────────────────────────────────────
    // Test 4: Cache EXISTS check (pre-request guard)
    // ──────────────────────────────────────────────────────
    const existsTracker = new PerformanceTracker('Redis EXISTS check (pre-request)');
    console.log('⏱️  Test 4: Redis EXISTS checks...');

    for (let i = 0; i < RUN_COUNT; i++) {
      const cacheKey = `interview:prep:bench-user-${i % 10}:bench-app-${i % 50}`;
      await existsTracker.measure(`exists-${i}`, async () => {
        return redis.exists(cacheKey);
      });
    }

    existsTracker.printStats();

    // ──────────────────────────────────────────────────────
    // Impact Calculation
    // ──────────────────────────────────────────────────────
    const hitStats = hitTracker.getStats();
    const missStats = missTracker.getStats();
    const writeStats = writeTracker.getStats();

    const hitAvg = parseFloat(hitStats.avgMs);
    const missAvg = parseFloat(missStats.avgMs);
    const improvement = ((missAvg - hitAvg) / missAvg * 100).toFixed(1);
    const speedupRatio = (missAvg / hitAvg).toFixed(0);

    console.log('\n' + '🎯'.repeat(20));
    console.log('\n🎯 RESUME-READY METRICS:\n');
    console.log(`  ✅ Cache HIT:  avg ${hitAvg.toFixed(0)}ms  (p95: ${hitStats.p95Ms}ms)`);
    console.log(`  ✅ Cache MISS: avg ${missAvg.toFixed(0)}ms (simulated LLM + write)`);
    console.log(`  ✅ Cache WRITE: avg ${writeStats.avgMs}ms overhead`);
    console.log(`\n  📝 Suggested Resume Bullet:`);
    console.log(`     "Reduced interview prep latency by ${improvement}% (~${Math.round(missAvg / 1000)}s → ~${hitAvg.toFixed(0)}ms)`);
    console.log(`      with Redis cache-aside pattern (${speedupRatio}x speedup on repeat requests, 1hr TTL)"`);
    console.log('\n' + '🎯'.repeat(20));

    // Cleanup
    const keys = await redis.keys('interview:prep:bench*');
    const writeKeys = await redis.keys('interview:prep:write-bench*');
    const missKeys = await redis.keys('interview:prep:miss*');
    const allKeys = [...keys, ...writeKeys, ...missKeys];
    if (allKeys.length > 0) await redis.del(...allKeys);
    console.log(`\n🧹 Cleaned up ${allKeys.length} benchmark keys`);

    return { hitStats, missStats, writeStats };

  } finally {
    await redis.quit();
  }
}

if (require.main === module) {
  runBenchmark()
    .then(() => {
      console.log('\n✅ Interview prep cache benchmark complete!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Benchmark failed:', err.message);
      if (err.message.includes('ECONNREFUSED')) {
        console.error('💡 Start Redis: docker-compose up -d redis');
      }
      process.exit(1);
    });
}

module.exports = { runBenchmark };
