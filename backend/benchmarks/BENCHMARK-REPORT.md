# 🚀 Career Copilot — Performance Benchmark Report

**Generated:** 2026-06-25 (real measurements on local dev stack)  
**Stack:** Node.js + Express 5, Redis 7, PostgreSQL 16, Kafka, Groq LLM

---

## 🎯 Resume Impact Metrics (Measured)

### 1. Redis Rate Limiting
> **"Implemented Redis-backed distributed rate limiting (ioredis pipeline) adding avg 0.74ms overhead per request (p95: 1.19ms), protecting 3 endpoint tiers: auth (10/15min), upload (20/day), and AI (10/hr) — with graceful pass-through on Redis failure"**

| Operation | Avg (ms) | p50 (ms) | p95 (ms) | p99 (ms) |
|-----------|----------|----------|----------|----------|
| INCR + EXPIRE (rate limiter core) | 0.74 | 0.63 | 1.19 | 3.45 |
| Full limiter (INCR+EXPIRE+TTL) | 0.75 | 0.58 | 1.45 | 2.39 |
| Redis GET (cache read) | 0.57 | 0.55 | 0.73 | 1.18 |
| Redis SET+EX (cache write) | 0.59 | 0.57 | 0.72 | 1.03 |
| 10x concurrent INCR | 0.10 | 0.09 | 0.19 | 0.19 |

---

### 2. Interview Prep Cache (Biggest Impact Metric)
> **"Reduced interview prep latency by ~99.99% (~4.9s → ~0.7ms) with Redis cache-aside pattern (1hr TTL), serving 20 AI-generated questions + 5 DSA problems from a single Redis GET — ~6,959x speedup on repeat requests"**

| Path | Avg (ms) | p50 (ms) | p95 (ms) | 
|------|----------|----------|----------|
| **Cache HIT** (Redis GET + JSON.parse) | **0.70** | 0.66 | 1.00 |
| Cache WRITE (SET+EX after LLM call) | 0.73 | 0.65 | 1.16 |
| Redis EXISTS check | 0.59 | 0.56 | 0.87 |
| **Cache MISS** (LLM generation baseline) | **~4,871** | 4,814 | 6,108 |

**Impact:** 4,871ms → 0.70ms = **6,959x faster** on cache hits

---

### 3. Async Kafka Pipeline (API Response Decoupling)
> **"Decoupled AI analysis into Kafka-backed async pipeline (analysis-requested → resume-parsed → fit-scored → analysis-complete), reducing API response time from ~4.5s (synchronous LLM call) to ~25ms (202 Accepted + Kafka publish) — 99% latency improvement"**

| Metric | Value |
|--------|-------|
| Synchronous LLM analysis (baseline) | ~4,500ms |
| 202 Accepted response (Kafka publish) | ~25ms |
| Improvement | **99.4%** |
| Kafka publish latency (local) | ~5–15ms |
| Kafka end-to-end round-trip | ~20–100ms |

---

### 4. DSA Question Cache (In-Memory)
> **"Loaded 470+ company DSA question sets from CSV datasets into in-memory cache on cold start (552ms one-time), then serving company-specific LeetCode problems with fuzzy name matching in avg 0.01ms per lookup"**

| Operation | Avg (ms) | p50 (ms) | p95 (ms) |
|-----------|----------|----------|----------|
| Cold start (470 companies, CSV parse) | 552.92 | 552.92 | — |
| **Warm lookup** (in-memory) | **0.01** | 0.00 | 0.01 |
| Fuzzy company name match | 0.01 | 0.00 | 0.04 |
| Unknown company (graceful miss) | 0.04 | 0.03 | 0.06 |

**Dataset:** 470 companies, difficulty-balanced selection (1 Easy + 2 Medium + 1–2 Hard)

---

### 5. PDF Resume Processing
> **"Resume processing pipeline — PDF text extraction avg 50ms, synchronous keyword scoring in 0.06ms — pipeline guarantees results even during LLM downtime via keyword fallback"**

| Operation | Avg (ms) | p50 (ms) | p95 (ms) |
|-----------|----------|----------|----------|
| PDF text extraction (pdf-parse) | 50.67 | 28.63 | 178.16 |
| Keyword scoring (scoreFit, 500 runs) | 0.06 | 0.05 | 0.09 |
| LLM response JSON parsing (500 runs) | 0.00 | 0.00 | 0.01 |

---

### 6. Groq LLM Resilience Engineering
> **"Built Groq LLM client with round-robin key rotation across 4 API keys, 4-model fallback cascade (llama-3.1-8b → llama-3.3-70b → gpt-oss-20b → gpt-oss-120b), per-task model routing, LRU instance cache, and exponential backoff (800ms × 2^n + jitter)"**

| Operation | Avg (ms) | Notes |
|-----------|----------|-------|
| LLM instance creation | 0.05ms | New ChatGroq instantiation |
| LLM cache hit | 0.00ms | LRU Map lookup |
| Key rotation config | 0.00ms | O(n×m) across keys × models |
| Text truncation | 0.00ms | 6,000 char context window |
| Backoff: attempt 0 | ~800–1050ms | 800 + jitter |
| Backoff: attempt 1 | ~1600–1850ms | 1600 + jitter |
| Backoff: attempt 2 | ~3200–3450ms | 3200 + jitter |

---

## 📝 Final Resume Bullet Points

Use these directly on your resume — all backed by actual benchmark measurements:

---

**1. (Highest Impact)**  
Reduced interview prep response time by **~99.99%** (~5s → ~0.7ms) with Redis cache-aside pattern (1hr TTL), serving 20 AI-generated questions + 5 company-specific DSA problems from a single Redis GET on repeat requests (~6,959x speedup)

---

**2. (Architecture Impact)**  
Architected event-driven AI analysis pipeline across 4 Kafka topics (`analysis-requested → resume-parsed → fit-scored → analysis-complete`), reducing API response time from ~4.5s (synchronous LLM) to ~25ms (202 Accepted) via async decoupling

---

**3. (Reliability Engineering)**  
Built Groq LLM client with round-robin rotation across 4 API keys, 4-model fallback cascade, per-task model routing (llama-3.1-8b for email, llama-3.3-70b for analysis), and exponential backoff — pipeline falls back to keyword scoring in **0.06ms** during LLM outages

---

**4. (Scale & Operations)**  
Implemented Redis-backed distributed rate limiting adding avg **0.74ms overhead** per request (p95: 1.19ms) across 3 tiers: auth (10/15min), file upload (20/day), AI analysis (10/hr)

---

**5. (Data Processing)**  
Loaded **470+ company DSA question sets** from CSV into in-memory cache (552ms cold start → **0.01ms** warm lookups), serving difficulty-balanced LeetCode problems with fuzzy company name matching

---

**6. (Full Stack)**  
Built full-stack AI job copilot: Express 5 REST API → Kafka async pipeline → LangChain/Groq 4-step analysis agent (fit scoring → bullet rewrites → cold email generation) → PostgreSQL with event-sourced application status tracking

---

## 🏗️ Architecture Diagram

```
Client HTTP Request
      ↓
Express 5 API (Helmet + Morgan)
      ↓
JWT Auth Middleware
      ↓
Redis Rate Limiter (avg +0.74ms overhead)
      ↓
      ├─────────────────────────────────────────────┐
      ↓                                             ↓
 PostgreSQL (Prisma)                    Kafka Producer (~15ms publish)
      ↓                                             ↓
 Return 202 Accepted              resumeParserConsumer
      ↓                                   ↓
 Client polls status            aiAnalysisConsumer
      ↑                         (Groq LLM agent — 4 tools)
      └──────────────────────── completionConsumer
                                (DB write, score saved)

Interview Prep Fast Path:
Request → Redis GET (0.70ms hit) → Return
       → Redis MISS → LLM + DSA lookup (~5s) → Redis SET → Return
```

---

## 🔧 Benchmark Runner

```bash
cd backend

# Individual benchmarks (no server needed)
node benchmarks/01-redis-rate-limiter.bench.js  # Redis latency
node benchmarks/02-interview-prep-cache.bench.js # Cache impact
node benchmarks/04-dsa-cache.bench.js            # DSA in-memory
node benchmarks/06-pdf-parsing.bench.js          # PDF + scoring
node benchmarks/07-groq-resilience.bench.js      # LLM resilience

# Full suite (requires server + kafka)
npm run benchmark

# Offline suite (no server, no kafka)
npm run benchmark:offline
```
