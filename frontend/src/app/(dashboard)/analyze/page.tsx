'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Zap, Loader2, CheckCircle,
  XCircle, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';

export default function AnalyzePage() {
  const [resumes, setResumes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');
  const [copied, setCopied] = useState(false);
  const [showBullets, setShowBullets] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/resume'),
      api.get('/jobs')
    ]).then(([r, j]) => {
      setResumes(r.data.data.resumes);
      setJobs(j.data.data.jobs);
    });
  }, []);

  const pollStatus = async (jobId: string) => {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/analyze/${jobId}/status`);
        const { status, stage, result } = res.data.data;

        setStage(stage || status);

        if (status === 'DONE') {
          clearInterval(interval);
          setResult(result);
          setPolling(false);
          setLoading(false);
        } else if (status === 'FAILED') {
          clearInterval(interval);
          setError(res.data.data.error || 'Analysis failed');
          setPolling(false);
          setLoading(false);
        }
      } catch {
        clearInterval(interval);
        setPolling(false);
        setLoading(false);
      }
    }, 2000);
  };

  const handleAnalyze = async () => {
    if (!resumeId || !jobId) {
      setError('Please select both a resume and a job');
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);
    setStage('queued');

    try {
      const res = await api.post('/analyze', { resumeId, jobId });
      await pollStatus(res.data.data.analysisJobId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start analysis');
      setLoading(false);
    }
  };

  const copyEmail = () => {
    if (result?.coldEmail?.body) {
      navigator.clipboard.writeText(result.coldEmail.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFitColor = (score: number) => {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const STAGE_LABELS: Record<string, string> = {
    queued:    '⏳ Queued for processing...',
    parsing:   '📄 Parsing resume and job description...',
    analyzing: '🧠 AI agent analyzing your fit...',
    complete:  '✅ Finalizing results...'
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">AI Analyzer</h1>
        <p className="text-gray-400 mt-1">
          Get fit score, rewritten bullets, and a cold email — powered by AI
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-2">
              Select Resume
            </label>
            <select
              value={resumeId}
              onChange={e => setResumeId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white 
                         rounded-lg px-4 py-2.5 focus:outline-none 
                         focus:border-blue-500"
            >
              <option value="">Choose a resume...</option>
              {resumes.map(r => (
                <option key={r.id} value={r.id}>
                  v{r.version} — {r.fileName}
                  {r.targetRole ? ` (${r.targetRole})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-2">
              Select Job
            </label>
            <select
              value={jobId}
              onChange={e => setJobId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white 
                         rounded-lg px-4 py-2.5 focus:outline-none 
                         focus:border-blue-500"
            >
              <option value="">Choose a job...</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.role} @ {j.company}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 
                          rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 
                     disabled:opacity-50 text-white font-medium rounded-lg 
                     px-6 py-2.5 transition-colors"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
            : <><Zap className="w-4 h-4" /> Run AI Analysis</>
          }
        </button>
      </div>

      {/* Stage Progress */}
      {loading && (
        <div className="bg-gray-900 border border-blue-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <p className="text-blue-300 font-medium">
              {STAGE_LABELS[stage] || 'Processing...'}
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            {['queued', 'parsing', 'analyzing', 'complete'].map((s) => (
              <div key={s} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${
                  ['queued', 'parsing', 'analyzing', 'complete']
                    .indexOf(stage) >=
                  ['queued', 'parsing', 'analyzing', 'complete']
                    .indexOf(s)
                    ? 'bg-blue-500'
                    : 'bg-gray-700'
                }`} />
                <p className="text-gray-500 text-xs mt-1 capitalize">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Fit Score */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Fit Analysis</h2>
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <p className={`text-5xl font-bold ${getFitColor(result.fitScore)}`}>
                  {result.fitScore}
                </p>
                <p className="text-gray-400 text-sm mt-1">AI Fit Score</p>
              </div>
              <div className="text-center">
                <p className={`text-5xl font-bold ${getFitColor(result.keywordScore)}`}>
                  {result.keywordScore}
                </p>
                <p className="text-gray-400 text-sm mt-1">Keyword Score</p>
              </div>
              <div className="flex-1">
                <p className="text-gray-300 text-sm leading-relaxed">
                  {result.summary}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-green-400 text-sm font-medium mb-2">
                  ✅ Matched Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.matchedSkills?.map((s: string) => (
                    <span key={s}
                      className="bg-green-500/10 text-green-300 text-xs 
                                 px-2 py-1 rounded-full border border-green-500/20">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-red-400 text-sm font-medium mb-2">
                  ❌ Missing Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.missingSkills?.map((s: string) => (
                    <span key={s}
                      className="bg-red-500/10 text-red-300 text-xs 
                                 px-2 py-1 rounded-full border border-red-500/20">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Rewritten Bullets */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <button
              onClick={() => setShowBullets(!showBullets)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-white font-semibold">
                ✍️ Rewritten Resume Bullets
              </h2>
              {showBullets
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />
              }
            </button>

            {showBullets && (
              <div className="mt-4 space-y-4">
                {result.rewrittenBullets?.map((b: any, i: number) => (
                  <div key={i}
                    className="border border-gray-700 rounded-lg p-4 space-y-2">
                    <div className="flex gap-2">
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-gray-400 text-sm line-through">
                        {b.original}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      <p className="text-gray-200 text-sm">{b.rewritten}</p>
                    </div>
                    <p className="text-blue-400 text-xs ml-6">💡 {b.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cold Email */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">📧 Cold Email</h2>
              <button
                onClick={copyEmail}
                className="flex items-center gap-1.5 text-sm text-gray-400 
                           hover:text-white transition-colors"
              >
                {copied
                  ? <><Check className="w-4 h-4 text-green-400" /> Copied!</>
                  : <><Copy className="w-4 h-4" /> Copy</>
                }
              </button>
            </div>

            <div className="mb-3">
              <span className="text-gray-400 text-xs">Subject: </span>
              <span className="text-white text-sm font-medium">
                {result.coldEmail?.subject}
              </span>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
                {result.coldEmail?.body}
              </pre>
            </div>

            {result.coldEmail?.followUpSubject && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-xs mb-2">
                  Follow-up (after 1 week):
                </p>
                <p className="text-gray-300 text-sm">
                  <span className="text-gray-400">Subject: </span>
                  {result.coldEmail.followUpSubject}
                </p>
              </div>
            )}
          </div>

          {/* Tips */}
          {result.tipsForThisRole?.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-white font-semibold mb-3">
                💡 Tips for This Role
              </h2>
              <ul className="space-y-2">
                {result.tipsForThisRole.map((tip: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-blue-400 shrink-0">→</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}