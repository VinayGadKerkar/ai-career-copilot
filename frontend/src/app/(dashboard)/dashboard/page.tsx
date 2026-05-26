'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  Send, TrendingUp, Target, AlertCircle, Loader2,
  Briefcase, BrainCircuit, ArrowUpRight, Zap, ChevronRight,
  Trophy, Clock
} from 'lucide-react';

interface Analytics {
  totalApplications: number;
  responseRate: string;
  avgFitScore: number;
  statusBreakdown: Record<string, number>;
  topSkillGaps: { skill: string; count: number }[];
  recentActivity: any[];
}

const STATUS_META: Record<string, { color: string; bg: string; hex: string }> = {
  APPLIED:      { color: 'text-blue-400',    bg: 'bg-blue-500/10',    hex: '#3b82f6' },
  RESPONDED:    { color: 'text-purple-400',  bg: 'bg-purple-500/10',  hex: '#8b5cf6' },
  INTERVIEWING: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   hex: '#f59e0b' },
  OFFER:        { color: 'text-emerald-400', bg: 'bg-emerald-500/10', hex: '#10b981' },
  REJECTED:     { color: 'text-red-400',     bg: 'bg-red-500/10',     hex: '#ef4444' },
  GHOSTED:      { color: 'text-gray-400',    bg: 'bg-gray-500/10',    hex: '#6b7280' },
};

const QUICK_LINKS = [
  { href: '/jobs',         icon: Briefcase,   label: 'Browse Jobs',      desc: 'Search & import live listings',  color: 'text-blue-400',    bg: 'bg-blue-500/10 hover:bg-blue-500/20',    border: 'border-blue-500/20' },
  { href: '/applications', icon: Send,        label: 'Applications',     desc: 'Track your pipeline',            color: 'text-purple-400',  bg: 'bg-purple-500/10 hover:bg-purple-500/20', border: 'border-purple-500/20' },
  { href: '/analyze',      icon: Zap,         label: 'AI Analysis',      desc: 'Score resume vs job',            color: 'text-amber-400',   bg: 'bg-amber-500/10 hover:bg-amber-500/20',  border: 'border-amber-500/20' },
  { href: '/interview',    icon: BrainCircuit,label: 'Interview Prep',   desc: 'Practice with AI coach',         color: 'text-emerald-400', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20', border: 'border-emerald-500/20' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/applications/analytics')
      .then(res => setAnalytics(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const statusData = analytics
    ? Object.entries(analytics.statusBreakdown).map(([status, count]) => ({ status, count }))
    : [];

  const pieData = statusData.filter(d => d.count > 0);

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* ── Hero Banner ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptNiA2djZoNnYtNmgtNnptLTEyIDB2NmgxNHYtNkgzMHptLTYtNnY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">Welcome back</p>
            <h1 className="text-3xl font-bold text-white">
              {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-blue-200 mt-2 max-w-md">
              Your AI-powered career assistant is ready. Here's your job search snapshot.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/jobs"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm
                         text-white font-medium rounded-xl px-5 py-2.5 transition-all text-sm border border-white/20">
              <Briefcase className="w-4 h-4" /> Find Jobs
            </Link>
            <Link href="/analyze"
              className="flex items-center gap-2 bg-white text-blue-700 font-semibold
                         rounded-xl px-5 py-2.5 transition-all text-sm hover:bg-blue-50">
              <Zap className="w-4 h-4" /> AI Analyze
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats Row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Applied',   value: analytics?.totalApplications || 0,            icon: Send,      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
          { label: 'Response Rate',   value: analytics?.responseRate || '0%',               icon: TrendingUp,color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: 'Avg Fit Score',   value: analytics?.avgFitScore ? `${analytics.avgFitScore}/100` : 'N/A', icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
          { label: 'Interviewing',    value: analytics?.statusBreakdown?.INTERVIEWING || 0, icon: Trophy,    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`bg-gray-900 border ${border} rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">{label}</span>
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div>
        <h2 className="text-white font-semibold text-lg mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc, color, bg, border }) => (
            <Link key={href} href={href}
              className={`group ${bg} border ${border} rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02]`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 bg-gray-900/50 rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-gray-500 text-xs mt-1">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Charts Row ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Bar Chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white font-semibold">Application Pipeline</h2>
              <p className="text-gray-500 text-xs mt-0.5">Status breakdown across all applications</p>
            </div>
          </div>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} barSize={32}>
                <XAxis dataKey="status" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', color: '#fff', fontSize: 12 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusData.map(({ status }) => (
                    <Cell key={status} fill={STATUS_META[status]?.hex || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-gray-600 gap-2">
              <Send className="w-8 h-8 opacity-40" />
              <p className="text-sm">No applications yet</p>
              <Link href="/applications" className="text-blue-400 text-xs hover:underline">Add your first →</Link>
            </div>
          )}
        </div>

        {/* Pie breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
          <h2 className="text-white font-semibold mb-1">Distribution</h2>
          <p className="text-gray-500 text-xs mb-4">By application status</p>
          {pieData.length > 0 ? (
            <>
              <div className="flex-1 flex items-center justify-center">
                <PieChart width={160} height={160}>
                  <Pie data={pieData} dataKey="count" nameKey="status"
                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {pieData.map(({ status }) => (
                      <Cell key={status} fill={STATUS_META[status]?.hex || '#3b82f6'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff', fontSize: 11 }}
                  />
                </PieChart>
              </div>
              <div className="space-y-2 mt-2">
                {pieData.map(({ status, count }) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[status]?.hex }} />
                      <span className="text-gray-400 text-xs capitalize">{status.toLowerCase()}</span>
                    </div>
                    <span className="text-white text-xs font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Skill Gaps + Recent Activity ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skill Gaps */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Top Skill Gaps</h2>
              <p className="text-gray-500 text-xs">Based on AI analysis results</p>
            </div>
          </div>
          {analytics?.topSkillGaps?.length ? (
            <div className="space-y-4">
              {analytics.topSkillGaps.slice(0, 6).map(({ skill, count }, i) => (
                <div key={skill} className="flex items-center gap-3">
                  <span className="text-gray-600 text-xs w-4">{i + 1}</span>
                  <span className="text-gray-300 text-sm flex-1 truncate">{skill}</span>
                  <div className="w-28 bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (count / (analytics.topSkillGaps[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-gray-500 text-xs w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-gray-600 gap-2">
              <Zap className="w-7 h-7 opacity-40" />
              <p className="text-sm">Run AI analysis to see skill gaps</p>
              <Link href="/analyze" className="text-blue-400 text-xs hover:underline">Start analysis →</Link>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Recent Applications</h2>
                <p className="text-gray-500 text-xs">Your latest activity</p>
              </div>
            </div>
            <Link href="/applications" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {analytics?.recentActivity?.length ? (
            <div className="space-y-3">
              {analytics.recentActivity.map((app: any) => {
                const meta = STATUS_META[app.status];
                return (
                  <div key={app.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
                    <div className={`w-8 h-8 ${meta?.bg || 'bg-gray-700'} rounded-lg flex items-center justify-center shrink-0`}>
                      <Briefcase className={`w-3.5 h-3.5 ${meta?.color || 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{app.job.role}</p>
                      <p className="text-gray-500 text-xs truncate">{app.job.company}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${meta?.bg} ${meta?.color}`}>
                      {app.status.charAt(0) + app.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-gray-600 gap-2">
              <Send className="w-7 h-7 opacity-40" />
              <p className="text-sm">No applications yet</p>
              <Link href="/applications" className="text-blue-400 text-xs hover:underline">Track your first →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}