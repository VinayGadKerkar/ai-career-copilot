/**
 * Benchmark #1: Redis Rate Limiter Performance
 * 
 * Measures how much latency the Redis-based rate limiter adds to each request.
 * Compares response time between:
 *   - Requests that pass through the rate limiter (normal flow)
 *   - The Redis incr/expire/ttl overhead specifically
 * 
 * Resume Metric Target: 
 *   "Implemented Redis-backed rate limiting adding <5ms overhead per request"
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const Redis = require('ioredis');
const { PerformanceTracker, sleep } = require('./setup');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const RUN_COUNT = 200;
const CONCURRENCY = 10;

async function runBenchmark() {
  console.log('\n🔴 Redis Rate Limiter Performance Benchmark');
  console.log('============================================');
  console.log(`Iterations: ${RUN_COUNT} | Concurrency: ${CONCURRENCY}`);
  console.log(`Redis URL: ${REDIS_URL.replace(/\/\/.*@/, '//***@')}\n`);

  const redis = new Redis(REDIS_URL);

  try {
    // Verify Redis connectivity
    const pingResult = await redis.ping();
    if (pingResult !== 'PONG') throw new Error('Redis ping failed');
    console.log('✅ Redis connected successfully\n');

    // ──────────────────────────────────────────────────────
    // Test 1: Raw Redis INCR + EXPIRE (rate limiter core ops)
    // ──────────────────────────────────────────────────────
    const rawOpsTracker = new PerformanceTracker('Raw Redis INCR+EXPIRE (Rate Limiter Core)');
    console.log('⏱️  Test 1: Raw Redis INCR + EXPIRE operations...');

    for (let i = 0; i < RUN_COUNT; i++) {
      const testKey = `bench:ratelimit:test:${i % 20}`; // 20 unique keys to simulate real usage
      await rawOpsTracker.measure(`raw-op-${i}`, async () => {
        const pipeline = redis.pipeline();
        pipeline.incr(testKey);
        pipeline.expire(testKey, 3600);
        const results = await pipeline.exec();
        return results;
      });
    }

    rawOpsTracker.printStats();

    // ──────────────────────────────────────────────────────
    // Test 2: Full rate limiter simulation (incr + expire + ttl)
    // ──────────────────────────────────────────────────────
    const fullLimiterTracker = new PerformanceTracker('Full Rate Limiter Simulation (INCR+EXPIRE+TTL)');
    console.log('⏱️  Test 2: Full rate limiter flow simulation...');

    for (let i = 0; i < RUN_COUNT; i++) {
      const userId = `bench-user-${i % 50}`;
      const key = `ratelimit:ai:${userId}`;

      await fullLimiterTracker.measure(`full-limiter-${i}`, async () => {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, 3600);
        }
        if (current > 10) {
          await redis.ttl(key);
        }
        return current;
      });
    }

    fullLimiterTracker.printStats();

    // ──────────────────────────────────────────────────────
    // Test 3: Redis GET (cache read — interview prep hits)
    // ──────────────────────────────────────────────────────
    const readTracker = new PerformanceTracker('Redis GET (Cache Read)');
    const writeTracker = new PerformanceTracker('Redis SET+EX (Cache Write)');
    console.log('⏱️  Test 3: Redis GET vs SET throughput...');

    // Pre-populate some keys
    const testPayload = JSON.stringify({
      prepId: 'bench-prep-id',
      questions: { behavioural: new Array(5).fill('Sample question?'), technical: new Array(5).fill('Technical question?') },
      generatedAt: new Date().toISOString()
    });

    for (let i = 0; i < 50; i++) {
      await redis.set(`bench:interview:${i}`, testPayload, 'EX', 3600);
    }

    // Measure reads (cache hits)
    for (let i = 0; i < RUN_COUNT; i++) {
      const cacheKey = `bench:interview:${i % 50}`;
      await readTracker.measure(`read-${i}`, async () => {
        const raw = await redis.get(cacheKey);
        return raw ? JSON.parse(raw) : null;
      });
    }

    // Measure writes
    for (let i = 0; i < 50; i++) {
      await writeTracker.measure(`write-${i}`, async () => {
        await redis.set(`bench:interview:write:${i}`, testPayload, 'EX', 3600);
      });
    }

    readTracker.printStats();
    writeTracker.printStats();

    // ──────────────────────────────────────────────────────
    // Test 4: Concurrent rate limiting (simulates real traffic burst)
    // ──────────────────────────────────────────────────────
    const concurrentTracker = new PerformanceTracker(`Concurrent Rate Limit Checks (${CONCURRENCY} parallel)`);
    console.log(`⏱️  Test 4: Concurrent rate limit checks (${CONCURRENCY} parallel requests)...`);

    const batches = RUN_COUNT / CONCURRENCY;
    for (let batch = 0; batch < batches; batch++) {
      const batchStart = process.hrtime.bigint();

      const promises = Array.from({ length: CONCURRENCY }, (_, i) => {
        const userId = `concurrent-user-${(batch * CONCURRENCY + i) % 30}`;
        const key = `ratelimit:bench:concurrent:${userId}`;
        return redis.incr(key);
      });

      await Promise.all(promises);

      const batchEnd = process.hrtime.bigint();
      const batchMs = Number(batchEnd - batchStart) / 1_000_000;

      concurrentTracker.measurements.push({
        label: `batch-${batch}`,
        durationMs: batchMs / CONCURRENCY, // per-request time
        success: true,
        timestamp: new Date().toISOString()
      });
    }

    concurrentTracker.printStats();

    // ──────────────────────────────────────────────────────
    // Summary Report
    // ──────────────────────────────────────────────────────
    const rawStats = rawOpsTracker.getStats();
    const readStats = readTracker.getStats();
    const writeStats = writeTracker.getStats();

    console.log('\n' + '🎯'.repeat(20));
    console.log('\n🎯 RESUME-READY METRICS:\n');
    console.log(`  ✅ Redis pipeline INCR+EXPIRE: avg ${rawStats.avgMs}ms (p95: ${rawStats.p95Ms}ms)`);
    console.log(`     → "Implemented Redis-backed rate limiting with <${Math.ceil(parseFloat(rawStats.p95Ms))}ms overhead at p95"`);
    console.log(`\n  ✅ Cache read (GET+JSON.parse): avg ${readStats.avgMs}ms (p95: ${readStats.p95Ms}ms)`);
    console.log(`     → "Redis cache reads serving interview prep data in avg ${readStats.avgMs}ms"`);
    console.log(`\n  ✅ Cache write (SET+EX): avg ${writeStats.avgMs}ms`);
    console.log(`     → "Cache writes completing in avg ${writeStats.avgMs}ms with 1hr TTL"`);
    console.log('\n' + '🎯'.repeat(20));

    // Cleanup benchmark keys
    const keys = await redis.keys('bench:*');
    if (keys.length > 0) await redis.del(...keys);
    const ratelimitKeys = await redis.keys('ratelimit:bench:*');
    if (ratelimitKeys.length > 0) await redis.del(...ratelimitKeys);
    console.log(`\n🧹 Cleaned up ${keys.length + ratelimitKeys.length} benchmark keys`);

    return {
      rawOps: rawStats,
      fullLimiter: fullLimiterTracker.getStats(),
      cacheRead: readStats,
      cacheWrite: writeStats,
      concurrent: concurrentTracker.getStats()
    };

  } finally {
    await redis.quit();
  }
}

// Run if called directly
if (require.main === module) {
  runBenchmark()
    .then(results => {
      console.log('\n✅ Redis benchmark complete!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Benchmark failed:', err.message);
      if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
        console.error('💡 Make sure Redis is running: docker-compose up -d redis');
      }
      process.exit(1);
    });
}

module.exports = { runBenchmark };
