/**
 * Benchmark Setup & Utilities
 * 
 * Provides common setup, data generation, and measurement utilities
 * for all performance tests
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = process.env.BENCHMARK_BASE_URL || 'http://localhost:8000';
const API_BASE = `${BASE_URL}/api`;

// ─── Test Data Generators ────────────────────────────────────

const generateTestUser = (suffix = Math.random().toString(36).slice(2)) => ({
  name: `Test User ${suffix}`,
  email: `test.${suffix}@benchmark.local`,
  password: 'test123456'
});

const sampleJobDescription = `
We are seeking a Senior Full-Stack Engineer to join our team. 

**Requirements:**
- 5+ years of professional software development experience
- Strong expertise in Node.js, React, PostgreSQL, Redis, Kafka
- Experience with AWS cloud services (S3, Lambda, ECS)
- RESTful API design and microservices architecture
- Proficiency with Docker, CI/CD pipelines
- Strong understanding of system design and scalability patterns

**Responsibilities:**
- Design and implement scalable backend services
- Build responsive frontend applications
- Optimize database queries and caching strategies
- Mentor junior engineers
- Participate in code reviews and architectural decisions

**Nice to Have:**
- Experience with ML/AI integration
- Knowledge of event-driven architectures
- Prior experience at high-growth startups
`;

const sampleResumeText = `
John Doe
Senior Software Engineer

EXPERIENCE

Senior Full-Stack Engineer | Tech Corp | 2020 - Present
- Architected and implemented microservices handling 100K+ requests/day using Node.js and Kafka
- Reduced API latency by 65% through Redis caching and PostgreSQL query optimization
- Built React-based dashboard serving 50K+ daily active users
- Implemented CI/CD pipeline reducing deployment time from 45min to 8min
- Mentored team of 4 junior engineers on best practices

Software Engineer | StartupXYZ | 2018 - 2020
- Developed RESTful APIs using Express.js with JWT authentication
- Migrated monolithic application to microservices architecture
- Reduced database costs by 40% through query optimization and indexing
- Integrated third-party APIs including Stripe, SendGrid, and Twilio

SKILLS
Languages: JavaScript, TypeScript, Python, SQL
Backend: Node.js, Express, NestJS, GraphQL
Frontend: React, Next.js, Redux, TailwindCSS
Databases: PostgreSQL, MongoDB, Redis
Cloud: AWS (S3, EC2, Lambda, RDS), Docker, Kubernetes
Tools: Git, CI/CD, Jest, Webpack

EDUCATION
B.S. Computer Science | State University | 2018
`;

// ─── Performance Measurement Utilities ──────────────────────

class PerformanceTracker {
  constructor(name) {
    this.name = name;
    this.measurements = [];
  }

  async measure(label, fn) {
    const start = process.hrtime.bigint();
    let error = null;
    let result = null;

    try {
      result = await fn();
    } catch (err) {
      error = err;
    }

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    this.measurements.push({
      label,
      durationMs,
      success: !error,
      error: error?.message,
      timestamp: new Date().toISOString()
    });

    if (error) throw error;
    return result;
  }

  getStats() {
    const successful = this.measurements.filter(m => m.success);
    if (successful.length === 0) {
      return {
        name: this.name,
        count: 0,
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        successRate: 0
      };
    }

    const durations = successful.map(m => m.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);

    return {
      name: this.name,
      count: successful.length,
      avgMs: (sum / successful.length).toFixed(2),
      minMs: durations[0].toFixed(2),
      maxMs: durations[durations.length - 1].toFixed(2),
      p50Ms: durations[Math.floor(durations.length * 0.5)].toFixed(2),
      p95Ms: durations[Math.floor(durations.length * 0.95)].toFixed(2),
      p99Ms: durations[Math.floor(durations.length * 0.99)].toFixed(2),
      successRate: ((successful.length / this.measurements.length) * 100).toFixed(2) + '%',
      totalMeasurements: this.measurements.length
    };
  }

  printStats() {
    const stats = this.getStats();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${stats.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Requests:  ${stats.totalMeasurements}`);
    console.log(`Success Rate:    ${stats.successRate}`);
    console.log(`Average:         ${stats.avgMs} ms`);
    console.log(`Median (p50):    ${stats.p50Ms} ms`);
    console.log(`p95:             ${stats.p95Ms} ms`);
    console.log(`p99:             ${stats.p99Ms} ms`);
    console.log(`Min:             ${stats.minMs} ms`);
    console.log(`Max:             ${stats.maxMs} ms`);
    console.log(`${'='.repeat(60)}\n`);
    return stats;
  }
}

// ─── HTTP Client Helpers ─────────────────────────────────────

const createAuthenticatedClient = async () => {
  const user = generateTestUser();
  
  // Register
  await axios.post(`${API_BASE}/auth/register`, user).catch(() => {
    // User might already exist, ignore error
  });

  // Login
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: user.email,
    password: user.password
  });

  const token = loginRes.data.data.token;

  return {
    token,
    userId: loginRes.data.data.user.id,
    client: axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${token}` }
    })
  };
};

// ─── Wait Helper ─────────────────────────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Report Generator ────────────────────────────────────────

class BenchmarkReport {
  constructor() {
    this.results = [];
    this.startTime = new Date();
  }

  addResult(category, stats, notes = '') {
    this.results.push({
      category,
      ...stats,
      notes,
      recordedAt: new Date().toISOString()
    });
  }

  generateMarkdown() {
    const duration = ((new Date() - this.startTime) / 1000).toFixed(1);
    
    let md = `# 🚀 Career Copilot Performance Benchmark Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Duration:** ${duration}s\n`;
    md += `**Base URL:** ${BASE_URL}\n\n`;
    md += `---\n\n`;

    md += `## 📈 Summary\n\n`;
    md += `| Category | Requests | Avg (ms) | p50 (ms) | p95 (ms) | Success Rate |\n`;
    md += `|----------|----------|----------|----------|----------|-------------|\n`;
    
    this.results.forEach(r => {
      md += `| ${r.category} | ${r.count} | ${r.avgMs} | ${r.p50Ms} | ${r.p95Ms} | ${r.successRate} |\n`;
    });

    md += `\n---\n\n## 🔬 Detailed Results\n\n`;

    this.results.forEach(r => {
      md += `### ${r.category}\n\n`;
      md += `- **Total Requests:** ${r.totalMeasurements}\n`;
      md += `- **Success Rate:** ${r.successRate}\n`;
      md += `- **Average:** ${r.avgMs} ms\n`;
      md += `- **Median (p50):** ${r.p50Ms} ms\n`;
      md += `- **95th Percentile:** ${r.p95Ms} ms\n`;
      md += `- **99th Percentile:** ${r.p99Ms} ms\n`;
      md += `- **Min:** ${r.minMs} ms\n`;
      md += `- **Max:** ${r.maxMs} ms\n`;
      if (r.notes) {
        md += `\n**Notes:** ${r.notes}\n`;
      }
      md += `\n`;
    });

    md += `---\n\n## 🎯 Key Metrics for Resume\n\n`;
    md += this.generateResumeMetrics();

    return md;
  }

  generateResumeMetrics() {
    let metrics = '';

    const redisResult = this.results.find(r => r.category.includes('Redis'));
    if (redisResult) {
      metrics += `### Rate Limiting Performance\n`;
      metrics += `- Reduced authentication latency with Redis-based rate limiting\n`;
      metrics += `- Average response time: **${redisResult.avgMs}ms** (p95: ${redisResult.p95Ms}ms)\n\n`;
    }

    const cacheResult = this.results.find(r => r.category.includes('Cache Hit'));
    const missResult = this.results.find(r => r.category.includes('Cache Miss'));
    if (cacheResult && missResult) {
      const improvement = ((parseFloat(missResult.avgMs) - parseFloat(cacheResult.avgMs)) / parseFloat(missResult.avgMs) * 100).toFixed(1);
      const ratio = (parseFloat(missResult.avgMs) / parseFloat(cacheResult.avgMs)).toFixed(1);
      metrics += `### Interview Prep Cache Optimization\n`;
      metrics += `- Reduced interview prep latency by **${improvement}%** with Redis cache-aside pattern\n`;
      metrics += `- Cache hit: **${cacheResult.avgMs}ms**, Cache miss: **${missResult.avgMs}ms** (${ratio}x faster)\n\n`;
    }

    const kafkaResult = this.results.find(r => r.category.includes('Kafka'));
    if (kafkaResult) {
      metrics += `### Async Processing Pipeline\n`;
      metrics += `- Implemented event-driven architecture using Kafka for async AI analysis\n`;
      metrics += `- End-to-end pipeline processing: **${kafkaResult.avgMs}ms** average\n\n`;
    }

    const pdfResult = this.results.find(r => r.category.includes('Resume Upload'));
    if (pdfResult) {
      metrics += `### Resume Processing\n`;
      metrics += `- PDF parsing and storage: **${pdfResult.avgMs}ms** average (p95: ${pdfResult.p95Ms}ms)\n\n`;
    }

    return metrics;
  }

  save(filename = 'benchmark-report.md') {
    const reportPath = path.join(__dirname, filename);
    fs.writeFileSync(reportPath, this.generateMarkdown());
    console.log(`\n📄 Report saved to: ${reportPath}`);
    return reportPath;
  }
}

module.exports = {
  BASE_URL,
  API_BASE,
  generateTestUser,
  sampleJobDescription,
  sampleResumeText,
  PerformanceTracker,
  createAuthenticatedClient,
  sleep,
  BenchmarkReport
};
