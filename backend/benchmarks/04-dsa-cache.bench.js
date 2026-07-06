/**
 * Benchmark #4: DSA Question Service In-Memory Cache
 * 
 * Measures the performance of the CSV-backed in-memory question cache:
 *   - Cold start: First load from disk (CSV parsing)
 *   - Warm reads: Subsequent lookups (pure in-memory)
 *   - Fuzzy matching: Normalized company name lookup
 * 
 * Resume Metric Target:
 *   "Company-specific DSA question lookup serving results in <Xms via in-memory cache"
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { PerformanceTracker } = require('./setup');
const path = require('path');
const fs = require('fs');

async function runBenchmark() {
  console.log('\n📚 DSA Question Service Cache Benchmark');
  console.log('========================================');

  // ──────────────────────────────────────────────────────
  // Check if DSA data exists
  // ──────────────────────────────────────────────────────
  const DSA_ROOT = process.env.DSA_QUESTIONS_PATH ||
    path.join(__dirname, '../../../interview-company-wise-problems-main');

  const dsaExists = fs.existsSync(DSA_ROOT);

  if (!dsaExists) {
    console.log('⚠️  DSA dataset not found. Running synthetic benchmark instead.');
    console.log(`   Expected path: ${DSA_ROOT}\n`);
    return runSyntheticBenchmark();
  }

  // Use the real service
  const { getQuestionsForCompany, clearCache } = require('../src/services/dsaQuestionService');

  // Get list of companies from filesystem
  const companies = fs.readdirSync(DSA_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .slice(0, 20); // Use first 20 for benchmarking

  if (companies.length === 0) {
    console.log('⚠️  No company directories found. Running synthetic benchmark.\n');
    return runSyntheticBenchmark();
  }

  console.log(`📂 Found ${companies.length} company datasets (using first 20)`);
  console.log(`🔍 Companies: ${companies.slice(0, 5).join(', ')}...\n`);

  // ──────────────────────────────────────────────────────
  // Test 1: Cold start (first load from disk)
  // ──────────────────────────────────────────────────────
  const coldStartTracker = new PerformanceTracker('DSA Cache — Cold Start (CSV parse + load)');
  console.log('⏱️  Test 1: Cold start performance...');

  clearCache(); // Ensure cold
  await coldStartTracker.measure('cold-start', async () => {
    return getQuestionsForCompany(companies[0]);
  });

  coldStartTracker.printStats();

  // ──────────────────────────────────────────────────────
  // Test 2: Warm lookups (in-memory hits)
  // ──────────────────────────────────────────────────────
  const warmLookupTracker = new PerformanceTracker('DSA Cache — Warm Lookup (in-memory)');
  console.log('⏱️  Test 2: Warm lookup performance (200 lookups across all companies)...');

  for (let i = 0; i < 200; i++) {
    const company = companies[i % companies.length];
    await warmLookupTracker.measure(`warm-${i}`, async () => {
      return getQuestionsForCompany(company);
    });
  }

  warmLookupTracker.printStats();

  // ──────────────────────────────────────────────────────
  // Test 3: Fuzzy name matching (normalized lookup)
  // ──────────────────────────────────────────────────────
  const fuzzyMatchTracker = new PerformanceTracker('DSA Cache — Fuzzy Company Name Match');
  console.log('⏱️  Test 3: Fuzzy/normalized company name matching...');

  const fuzzyNames = companies.flatMap(c => [
    c,                                    // exact
    c.toLowerCase(),                      // lowercase
    c.toUpperCase(),                      // uppercase
    c.replace(/\s+/g, ''),               // no spaces
    c + ' Inc',                           // with Inc
    c.charAt(0).toUpperCase() + c.slice(1) // title case
  ]).slice(0, 100);

  for (let i = 0; i < fuzzyNames.length; i++) {
    await fuzzyMatchTracker.measure(`fuzzy-${i}`, async () => {
      return getQuestionsForCompany(fuzzyNames[i]);
    });
  }

  fuzzyMatchTracker.printStats();

  // ──────────────────────────────────────────────────────
  // Test 4: Unknown company (cache miss graceful fallback)
  // ──────────────────────────────────────────────────────
  const missTracker = new PerformanceTracker('DSA Cache — Unknown Company (graceful miss)');
  console.log('⏱️  Test 4: Unknown company lookup (returns empty array)...');

  const unknownCompanies = ['Unknown Corp XYZ', 'FakeCompany123', 'Startup404', 'TestCorp2099'];

  for (let i = 0; i < 50; i++) {
    const company = unknownCompanies[i % unknownCompanies.length];
    await missTracker.measure(`miss-${i}`, async () => {
      return getQuestionsForCompany(company);
    });
  }

  missTracker.printStats();

  // ──────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────
  const coldStats = coldStartTracker.getStats();
  const warmStats = warmLookupTracker.getStats();
  const fuzzyStats = fuzzyMatchTracker.getStats();

  console.log('\n' + '🎯'.repeat(20));
  console.log('\n🎯 RESUME-READY METRICS:\n');
  console.log(`  ✅ Cold start (CSV parse, ${companies.length} companies): ${coldStats.avgMs}ms`);
  console.log(`  ✅ Warm lookup (in-memory): avg ${warmStats.avgMs}ms (p95: ${warmStats.p95Ms}ms)`);
  console.log(`  ✅ Fuzzy name match: avg ${fuzzyStats.avgMs}ms`);
  console.log(`\n  📝 Suggested Resume Bullet:`);
  console.log(`     "Built in-memory DSA question cache for ${companies.length}+ companies from CSV datasets,`);
  console.log(`      serving company-specific LeetCode problems in avg ${warmStats.avgMs}ms with fuzzy name matching"`);
  console.log('\n' + '🎯'.repeat(20));

  return { coldStats, warmStats, fuzzyStats };
}

async function runSyntheticBenchmark() {
  console.log('Running synthetic in-memory cache benchmark...\n');

  // Simulate what the DSA cache does
  const mockCache = {};

  const syntheticCompanies = ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Netflix',
    'Uber', 'Airbnb', 'Lyft', 'Twitter', 'LinkedIn', 'Salesforce', 'Adobe', 'Oracle'];

  const mockQuestions = Array.from({ length: 500 }, (_, i) => ({
    difficulty: ['EASY', 'MEDIUM', 'HARD'][i % 3],
    title: `Problem ${i + 1}`,
    frequency: Math.random() * 100,
    link: `https://leetcode.com/problems/problem-${i + 1}`,
    topics: ['Array', 'Tree', 'DP'][i % 3].split(',')
  }));

  // Build cache
  for (const company of syntheticCompanies) {
    mockCache[company.toLowerCase()] = { originalName: company, questions: mockQuestions };
  }

  const lookupTracker = new PerformanceTracker('Synthetic In-Memory Cache Lookup');

  for (let i = 0; i < 1000; i++) {
    const company = syntheticCompanies[i % syntheticCompanies.length];
    await lookupTracker.measure(`lookup-${i}`, async () => {
      const key = company.toLowerCase();
      const entry = mockCache[key];
      if (!entry) return { found: false, questions: [] };

      // Mirror the actual service logic: filter + sort + slice
      const easy = entry.questions.filter(q => q.difficulty === 'EASY').sort((a, b) => b.frequency - a.frequency).slice(0, 1);
      const medium = entry.questions.filter(q => q.difficulty === 'MEDIUM').sort((a, b) => b.frequency - a.frequency).slice(0, 2);
      const hard = entry.questions.filter(q => q.difficulty === 'HARD').sort((a, b) => b.frequency - a.frequency).slice(0, 2);
      return { found: true, questions: [...easy, ...medium, ...hard] };
    });
  }

  lookupTracker.printStats();

  const stats = lookupTracker.getStats();
  console.log('\n🎯 RESUME-READY METRICS (synthetic):\n');
  console.log(`  ✅ In-memory lookup: avg ${stats.avgMs}ms (p95: ${stats.p95Ms}ms)`);
  console.log(`     "Loaded ${syntheticCompanies.length} company DSA datasets into memory,`);
  console.log(`      serving filtered + sorted questions in avg ${stats.avgMs}ms"`);

  return { lookupStats: stats };
}

if (require.main === module) {
  runBenchmark()
    .then(() => {
      console.log('\n✅ DSA cache benchmark complete!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Benchmark failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runBenchmark };
