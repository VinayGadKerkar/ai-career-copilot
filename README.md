# 🚀 AI Career Copilot

> An end-to-end, AI-powered career acceleration platform that helps job seekers **analyze resumes**, **track applications**, **prep for interviews**, and **discover live job listings** — all in one place.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [AI Pipeline](#-ai-pipeline)
- [DSA Interview Prep](#-dsa-interview-prep)
- [Benchmarks](#-benchmarks)

---

## 🧠 Overview

**AI Career Copilot** is a full-stack web application that acts as your personal AI assistant throughout your entire job search journey. Upload your resume, paste a job description, and the platform:

1. **Scores how well your resume fits** the role (AI fit score out of 100)
2. **Rewrites your resume bullets** to be more impactful and keyword-rich
3. **Identifies skill gaps** between your profile and the job requirements
4. **Generates a cold email & follow-up** tailored to the company and role
5. **Tracks all your applications** through a Kanban-style pipeline
6. **Generates custom interview questions** based on the job description
7. **Surfaces DSA problems** asked by 470+ top companies

The entire AI analysis flow is decoupled and event-driven using **Apache Kafka**, making it resilient, scalable, and non-blocking.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 📄 **Resume Upload & Parsing** | Upload PDF resumes; text is extracted and stored securely |
| 🤖 **AI Resume Analysis** | LLM-powered fit scoring, skill gap detection, and resume rewriting using Groq (LLaMA 3) |
| 📧 **Cold Email Generator** | Auto-generates professional outreach emails with follow-up templates |
| 📊 **Application Tracker** | Kanban-style board to track applications across 6 statuses (Applied → Offer/Rejected) |
| 💼 **Job Discovery** | Discover live job postings via JSearch (RapidAPI) |
| 🎯 **Interview Prep** | AI-generated interview questions tailored to the specific role and JD |
| 📚 **Company-wise DSA Problems** | Browse 470+ companies' interview questions (LeetCode-style) with difficulty filters |
| ⚡ **Event-Driven Pipeline** | Kafka-based async processing for all AI tasks — no blocking, no timeouts |
| 🔒 **JWT Auth** | Secure registration/login with hashed passwords and token-based sessions |
| 🧠 **Groq API Resilience** | Multi-key rotation with automatic retry across keys and models |
| ⚙️ **Redis Caching** | Interview prep results and DSA data are cached in Redis for instant repeat loads |
| 🐳 **Docker Ready** | Full local infrastructure (Kafka, Redis, PostgreSQL) via Docker Compose |

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | REST API server |
| **Prisma ORM** | Database access and migrations |
| **PostgreSQL** | Primary relational database |
| **Apache Kafka (KafkaJS)** | Async AI processing pipeline |
| **Redis (ioredis)** | Caching layer for interview prep & DSA |
| **Groq API + LangChain** | LLM inference (LLaMA 3.3 70B) |
| **AWS S3** | Cloud resume file storage (optional) |
| **JWT + bcrypt** | Authentication |
| **Helmet + CORS** | Security headers |
| **Zod** | Input validation |

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 16 + React 19** | Full-stack React framework (App Router) |
| **TypeScript** | Type-safe frontend code |
| **Tailwind CSS 4** | Utility-first styling |
| **Recharts** | Data visualizations on the dashboard |
| **Lucide React** | Icon library |
| **Axios** | API communication |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker Compose** | Local dev environment (Kafka + Zookeeper + Redis + PostgreSQL) |
| **Neon (PostgreSQL)** | Serverless cloud Postgres |
| **Aiven (Kafka)** | Managed Kafka cluster |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                  │
│  Dashboard │ Jobs │ Applications │ Interview │ DSA  │
└────────────────────┬────────────────────────────────┘
                     │ REST API (HTTP)
┌────────────────────▼────────────────────────────────┐
│              Express.js API Server (:8000)           │
│  /api/auth │ /api/resume │ /api/jobs │ /api/analyze  │
│  /api/applications │ /api/interview                  │
└────────────────────┬────────────────────────────────┘
                     │ Produces Events
┌────────────────────▼────────────────────────────────┐
│                  Apache Kafka                        │
│                                                      │
│  Topic: analysis-requested      [routed by eventType]│
│    → Resume Parser Consumer     (resume analysis)    │
│    → Interview Prep Consumer    (interview prep)     │
│                                                      │
│  Topic: resume-parsed                                │
│    → AI Analysis Consumer (Groq LLM pipeline)        │
│                                                      │
│  Topic: analysis-complete       [routed by eventType]│
│    → Completion Consumer        (persist to DB)      │
│    → Interview Prep Consumer    (cache prep results) │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│           Data & AI Services                         │
│  PostgreSQL (Prisma) │ Redis Cache │ Groq API        │
│  AWS S3 (storage)   │ RapidAPI (job search)          │
└─────────────────────────────────────────────────────┘
```

### AI Agent Pipeline (4 Steps)

When a resume is submitted for analysis, the following sequential steps run asynchronously:

```
Step 1: Keyword Fit Score  →  Fast keyword matching (no LLM)
Step 2: AI Resume Analysis →  LLM deep analysis (fit score, gaps, summary)
Step 3: Rewrite Bullets    →  LLM rewrites resume bullet points
Step 4: Cold Email Gen     →  LLM generates outreach email + follow-up

Each step has an independent fallback — a single LLM failure never crashes the pipeline.
```

---

## 📁 Project Structure

```
career-copilot/
├── backend/                        # Node.js + Express API
│   ├── src/
│   │   ├── agents/
│   │   │   ├── careerAgent.js      # Main AI orchestration pipeline
│   │   │   └── tools/
│   │   │       ├── analyzeResume.js        # LLM: resume analysis
│   │   │       ├── rewriteBullets.js       # LLM: bullet rewriting
│   │   │       ├── generateEmail.js        # LLM: cold email
│   │   │       ├── scoreFit.js             # Keyword scoring
│   │   │       └── generateInterviewQuestions.js
│   │   ├── kafka/
│   │   │   ├── consumers/
│   │   │   │   ├── resumeParserConsumer.js
│   │   │   │   ├── aiAnalysisConsumer.js
│   │   │   │   ├── completionConsumer.js
│   │   │   │   └── interviewPrepConsumer.js
│   │   │   ├── producer.js
│   │   │   └── admin.js
│   │   ├── routes/                 # Express route handlers
│   │   ├── controllers/            # Business logic
│   │   ├── services/               # External services (job search, DSA)
│   │   ├── middleware/             # Auth, error handling
│   │   ├── config/                 # Groq API key rotation config
│   │   └── utils/                  # Helper utilities
│   ├── prisma/
│   │   └── schema.prisma           # Database models
│   └── benchmarks/                 # Performance benchmark scripts
│
├── frontend/                       # Next.js 16 App Router
│   └── src/
│       └── app/
│           ├── (dashboard)/
│           │   ├── dashboard/      # Overview & stats
│           │   ├── resumes/        # Upload & manage resumes
│           │   ├── jobs/           # Job discovery
│           │   ├── applications/   # Application tracker
│           │   ├── analyze/        # AI resume analysis
│           │   └── interview/      # Interview prep
│           ├── login/
│           └── register/
│
├── interview-company-wise-problems-main/   # DSA questions dataset
│   └── [470+ companies]/                  # CSV files per company
│       ├── 1. Thirty Days.csv
│       ├── 2. Three Months.csv
│       └── 3. Six Months.csv
│
└── docker-compose.yml              # Local infra (Kafka, Redis, Postgres)
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local infrastructure)
- A [Groq API key](https://console.groq.com/) (free tier available)
- A [RapidAPI key](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) for job search

### 1. Clone the Repository

```bash
git clone https://github.com/VinayGadKerkar/ai-career-copilot.git
cd ai-career-copilot
```

### 2. Start Infrastructure Services

```bash
# Starts PostgreSQL, Kafka, Zookeeper, and Redis locally
docker-compose up -d
```

### 3. Set Up the Backend

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables and fill in your values
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start the development server
npm run dev
```

The backend will be running at **http://localhost:8000**

### 4. Set Up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Start the development server
npm run dev
```

The frontend will be running at **http://localhost:3000**

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=8000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5433/aicareercopilot"

# Authentication
JWT_SECRET=your_super_secret_jwt_key

# Groq AI (get free key at console.groq.com)
GROQ_API_KEY=gsk_your_key_here
GROQ_API_KEY_1=gsk_your_backup_key_1
GROQ_API_KEY_2=gsk_your_backup_key_2

# Kafka
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=ai-career-copilot
KAFKA_GROUP_ID=career-copilot-group

# Redis
REDIS_URL=redis://localhost:6379

# File Storage
STORAGE_TYPE=local          # or "s3"
UPLOADS_DIR=uploads

# AWS S3 (optional, for production storage)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=ai-career-copilot-resumes

# Job Search (RapidAPI - JSearch)
RAPIDAPI_KEY=your_rapidapi_key

# DSA Questions Dataset Path
DSA_QUESTIONS_PATH=./interview-company-wise-problems-main
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Register a new user |
| `POST` | `/api/auth/login` | ❌ | Login and receive JWT |
| `POST` | `/api/resume/upload` | ✅ | Upload a PDF resume |
| `GET` | `/api/resume` | ✅ | List all user resumes |
| `GET` | `/api/jobs/search` | ✅ | Search live job postings |
| `POST` | `/api/jobs` | ✅ | Manually add a job |
| `GET` | `/api/applications` | ✅ | Get all applications |
| `POST` | `/api/applications` | ✅ | Create new application |
| `PATCH` | `/api/applications/:id/status` | ✅ | Update application status |
| `POST` | `/api/analyze` | ✅ | Trigger AI analysis (async) |
| `GET` | `/api/analyze/:jobId` | ✅ | Poll analysis job status |
| `GET` | `/api/interview/questions` | ✅ | Get AI interview questions |
| `GET` | `/api/interview/dsa` | ✅ | Get DSA problems by company |
| `GET` | `/health` | ❌ | API health check |

> All protected routes require `Authorization: Bearer <token>` header.

---

## 🤖 AI Pipeline

The analysis pipeline is built with **fault tolerance** at every step. Each LLM call is independently wrapped in a try/catch — if one step fails (e.g. due to rate limits), the rest of the pipeline continues with a graceful fallback.

### Groq API Key Rotation

The backend implements automatic key rotation across multiple Groq API keys. If a request fails due to a rate limit or quota error, it automatically retries with the next available key and model.

```
Primary Key → Key 1 → Key 2 → Key 3 → Fallback response
```

### Kafka Topics

| Topic | Producer | Consumer | Purpose |
|---|---|---|---|
| `analysis-requested` | `/api/analyze` route & `/api/interview` route | Resume Parser Consumer (`eventType: resume`) & Interview Prep Consumer (`eventType: interview-prep`) | Shared entry topic — routed to the correct consumer via `eventType` |
| `resume-parsed` | Resume Parser Consumer | AI Analysis Consumer | Trigger Groq LLM analysis pipeline |
| `analysis-complete` | AI Analysis Consumer & Interview Prep Consumer | Completion Consumer (`eventType: resume`) & Interview Prep Consumer (`eventType: interview-prep`) | Shared completion topic — persists analysis results or caches interview prep output |

---

## 📚 DSA Interview Prep

The platform includes a **company-wise DSA problem dataset** sourced from real interview experiences across **470+ companies** including:

Google · Meta · Amazon · Microsoft · Apple · Netflix · Uber · Stripe · Airbnb · Goldman Sachs · DE Shaw · Jane Street · and many more.

Problems are filtered by recency:
- **Last 30 Days** — most recently asked
- **Last 3 Months** — recent interview rounds
- **Last 6 Months** — broader preparation set

The DSA service reads CSV files, parses them, and serves them through the API with Redis caching for instant repeat loads.

---

## 📈 Benchmarks

The project includes a comprehensive benchmark suite to measure system performance:

```bash
# Run all benchmarks
npm run benchmark

# Individual benchmarks
npm run benchmark:redis        # Redis rate limiter throughput
npm run benchmark:cache        # Interview prep cache performance
npm run benchmark:kafka        # Kafka pipeline end-to-end latency
npm run benchmark:dsa          # DSA data loading & parsing
npm run benchmark:api          # API endpoint response times
npm run benchmark:pdf          # PDF parsing throughput
npm run benchmark:groq         # Groq API resilience & retry logic

# Run without needing a live server or Kafka
npm run benchmark:offline
```

---

## 🗄 Database Schema

The application uses PostgreSQL with the following core models:

```
User          → Authentication & profile
Resume        → Uploaded resumes (versioned)
Job           → Job postings (manual + discovered)
Application   → Links User + Job + Resume; tracks status
ApplicationEvent → Audit log of all status transitions
AnalysisJob   → Tracks async Kafka AI analysis jobs
```

**Application Status Flow:**
```
APPLIED → RESPONDED → INTERVIEWING → OFFER
                   ↘ REJECTED
                   ↘ GHOSTED
```

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

---

## 📄 License

This project is licensed under the **ISC License**.

---

<div align="center">
  <strong>Built with ❤️ to make job searching smarter, not harder.</strong>
</div>
