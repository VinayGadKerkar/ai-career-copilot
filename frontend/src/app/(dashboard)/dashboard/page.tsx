'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  Send, TrendingUp, Target,
  AlertCircle, Loader2
} from 'lucide-react';

interface Analytics {
  totalApplications: number;
  responseRate: string;
  avgFitScore: number;
  statusBreakdown: Record<string, number>;
  topSkillGaps: { skill: string; count: number }[];
  recentActivity: any[];
}

const STATUS_COLORS: Record<string, string> = {
  APPLIED:      '#3b82f6',
  RESPONDED:    '#8b5cf6',
  INTERVIEWING: '#f59e0b',
  OFFER:        '#10b981',
  REJECTED:     '#ef4444',
  GHOSTED:      '#6b7280'
};

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
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const statusData = analytics
    ? Object.entries(analytics.statusBreakdown).map(([status, count]) => ({
        status, count
      }))
    : [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-400 mt-1">
          Here's your job search overview
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Total Applications',
            value: analytics?.totalApplications || 0,
            icon: Send,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10'
          },
          {
            label: 'Response Rate',
            value: analytics?.responseRate || '0%',
            icon: TrendingUp,
            color: 'text-green-400',
            bg: 'bg-green-500/10'
          },
          {
            label: 'Avg Fit Score',
            value: analytics?.avgFitScore
              ? `${analytics.avgFitScore}/100`
              : 'N/A',
            icon: Target,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10'
          }
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">{label}</span>
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Application Pipeline</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData}>
                <XAxis
                  dataKey="status"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111827',
                    border: '1px solid #1f2937',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusData.map(({ status }) => (
                    <Cell
                      key={status}
                      fill={STATUS_COLORS[status] || '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No applications yet
            </div>
          )}
        </div>

        {/* Skill Gaps */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <h2 className="text-white font-semibold">Top Skill Gaps</h2>
          </div>
          {analytics?.topSkillGaps?.length ? (
            <div className="space-y-3">
              {analytics.topSkillGaps.slice(0, 6).map(({ skill, count }) => (
                <div key={skill} className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm w-32 truncate">
                    {skill}
                  </span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100,
                          (count / (analytics.topSkillGaps[0]?.count || 1)) * 100
                        )}%`
                      }}
                    />
                  </div>
                  <span className="text-gray-500 text-xs w-6 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              Run AI analysis to see skill gaps
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Recent Applications</h2>
        {analytics?.recentActivity?.length ? (
          <div className="space-y-3">
            {analytics.recentActivity.map((app: any) => (
              <div key={app.id}
                className="flex items-center justify-between py-2 
                           border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">
                    {app.job.role}
                  </p>
                  <p className="text-gray-400 text-xs">{app.job.company}</p>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: `${STATUS_COLORS[app.status]}20`,
                    color: STATUS_COLORS[app.status]
                  }}
                >
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No recent activity</p>
        )}
      </div>
    </div>
  );
}