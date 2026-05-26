"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { ClipboardList, Plus, X, Loader2, Trash2, Target, ChevronDown, Clock, CheckCircle2 } from "lucide-react";

interface AppEvent { id: string; fromStatus: string | null; toStatus: string; note: string | null; occurredAt: string; }
interface Application { id: string; status: AppStatus; fitScore: number | null; notes: string | null; appliedAt: string; events?: AppEvent[]; job: { id: string; company: string; role: string }; resume: { id: string; version: number; fileName: string; targetRole: string | null }; }
interface Resume { id: string; version: number; fileName: string; targetRole: string | null; }
interface Job { id: string; company: string; role: string; }
type AppStatus = "APPLIED" | "RESPONDED" | "INTERVIEWING" | "OFFER" | "REJECTED" | "GHOSTED";

const COLS: { status: AppStatus; label: string; color: string; bg: string; dot: string }[] = [
  { status: "APPLIED", label: "Applied", color: "text-blue-400", bg: "bg-blue-500/10", dot: "bg-blue-500" },
  { status: "RESPONDED", label: "Responded", color: "text-purple-400", bg: "bg-purple-500/10", dot: "bg-purple-500" },
  { status: "INTERVIEWING", label: "Interviewing", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  { status: "OFFER", label: "Offer", color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  { status: "REJECTED", label: "Rejected", color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500" },
  { status: "GHOSTED", label: "Ghosted", color: "text-gray-400", bg: "bg-gray-500/10", dot: "bg-gray-500" },
];

const NEXT: Record<AppStatus, AppStatus[]> = {
  APPLIED: ["RESPONDED", "REJECTED", "GHOSTED"], RESPONDED: ["INTERVIEWING", "REJECTED", "GHOSTED"],
  INTERVIEWING: ["OFFER", "REJECTED"], OFFER: [], REJECTED: [], GHOSTED: []
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ jobId: "", resumeId: "", notes: "" });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [openDrop, setOpenDrop] = useState<string | null>(null);
  const [notesApp, setNotesApp] = useState<Application | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [timelineApp, setTimelineApp] = useState<Application | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, resumesRes, jobsRes] = await Promise.all([
        api.get("/applications", { params: { limit: 100 } }),
        api.get("/resume"),
        api.get("/jobs", { params: { limit: 50 } }),
      ]);
      setApps(appsRes.data.data.applications);
      setResumes(resumesRes.data.data.resumes);
      setJobs(jobsRes.data.data.jobs);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const h = () => setOpenDrop(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const fetchTimeline = async (app: Application) => {
    try {
      const res = await api.get(`/applications/${app.id}`);
      setTimelineApp(res.data.data.application);
    } catch { setTimelineApp(app); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateError(""); setCreating(true);
    try { await api.post("/applications", createForm); setShowCreate(false); setCreateForm({ jobId: "", resumeId: "", notes: "" }); await fetchAll(); }
    catch (err: any) { setCreateError(err.response?.data?.message || "Failed"); }
    finally { setCreating(false); }
  };

  const moveStatus = async (appId: string, newStatus: AppStatus) => {
    setMovingId(appId); setOpenDrop(null);
    try {
      await api.patch(`/applications/${appId}/status`, { status: newStatus });
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    } catch (e) { console.error("Move status error:", e); } finally { setMovingId(null); }
  };

  const saveNotes = async () => {
    if (!notesApp) return; setSavingNotes(true);
    try { await api.patch(`/applications/${notesApp.id}/status`, { notes: notesText }); setApps(prev => prev.map(a => a.id === notesApp.id ? { ...a, notes: notesText } : a)); setNotesApp(null); }
    catch { } finally { setSavingNotes(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/applications/${deleteId}`); setApps(prev => prev.filter(a => a.id !== deleteId)); setDeleteId(null); }
    catch { } finally { setDeleting(false); }
  };

  const byStatus = (s: AppStatus) => apps.filter(a => a.status === s);
  const total = apps.length;
  const summary = COLS.reduce((acc, c) => ({ ...acc, [c.status]: byStatus(c.status).length }), {} as Record<AppStatus, number>);

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-7 h-7 text-blue-500 animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-gray-400 mt-0.5 text-sm">{total} application{total !== 1 ? "s" : ""} tracked</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-2.5 text-sm">
          <Plus className="w-4 h-4" /> New Application
        </button>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-5 shrink-0">
        {COLS.map(c => (
          <div key={c.status} className={`${c.bg} border border-gray-800 rounded-xl px-3 py-2.5 text-center`}>
            <p className={`text-xl font-bold ${c.color}`}>{(summary as any)[c.status] || 0}</p>
            <p className="text-gray-500 text-xs mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {apps.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ClipboardList className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-300 font-medium">No applications yet</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-2.5 text-sm mx-auto">
              <Plus className="w-4 h-4" /> New Application
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
          {COLS.map(col => {
            const colApps = byStatus(col.status);
            return (
              <div key={col.status} className="flex-none w-60 flex flex-col">
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-3 ${col.bg}`}>
                  <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${col.dot}`} /><span className={`text-xs font-semibold ${col.color}`}>{col.label}</span></div>
                  <span className={`text-xs font-bold ${col.color}`}>{colApps.length}</span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {colApps.map(app => (
                    <div key={app.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors group">
                      <p className="text-white text-sm font-semibold leading-tight truncate">{app.job.role}</p>
                      <p className="text-gray-400 text-xs mt-0.5 truncate">{app.job.company}</p>
                      {app.fitScore !== null && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Target className="w-3 h-3 text-gray-500" />
                          <span className={`text-xs font-bold ${app.fitScore >= 75 ? "text-emerald-400" : app.fitScore >= 50 ? "text-amber-400" : "text-red-400"}`}>{app.fitScore}/100</span>
                          <span className="text-gray-600 text-xs">fit</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-gray-600 text-xs">v{app.resume.version} · {formatDate(app.appliedAt)}</span>
                      </div>
                      {app.notes && <p className="text-gray-500 text-xs mt-2 line-clamp-2 italic">&ldquo;{app.notes}&rdquo;</p>}
                      <div className={`flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-800 transition-opacity ${openDrop === app.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {NEXT[col.status].length > 0 && (
                          <div className="relative flex-1">
                            <button onClick={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setOpenDrop(openDrop === app.id ? null : app.id); }} disabled={movingId === app.id}
                              className="w-full flex items-center justify-between gap-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg">
                              {movingId === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><span>Move to</span><ChevronDown className="w-3 h-3" /></>}
                            </button>
                          </div>
                        )}
                        <button onClick={() => { fetchTimeline(app); }} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-blue-400 bg-gray-800 hover:bg-blue-500/10 rounded-lg transition-colors" title="Timeline"><Clock className="w-3 h-3" /></button>
                        <button onClick={() => { setNotesApp(app); setNotesText(app.notes || ""); }} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors" title="Notes">📝</button>
                        <button onClick={() => setDeleteId(app.id)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 bg-gray-800 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {openDrop === app.id && NEXT[col.status].length > 0 && (
                        <div className="mt-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-sm w-full">
                          {NEXT[col.status].map(ns => {
                            const nc = COLS.find(c => c.status === ns)!; return (
                              <button type="button" key={ns} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveStatus(app.id, ns); }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-700 ${nc.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${nc.dot}`} />{nc.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {colApps.length === 0 && <div className="border-2 border-dashed border-gray-800 rounded-xl p-6 text-center"><p className="text-gray-700 text-xs">Empty</p></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">New Application</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Job *</label>
                <select required value={createForm.jobId} onChange={e => setCreateForm(f => ({ ...f, jobId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select a job...</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.role} @ {j.company}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Resume *</label>
                <select required value={createForm.resumeId} onChange={e => setCreateForm(f => ({ ...f, resumeId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select a resume...</option>
                  {resumes.map(r => <option key={r.id} value={r.id}>v{r.version} — {r.fileName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Notes <span className="text-gray-600">(optional)</span></label>
                <textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any notes..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none placeholder:text-gray-600" />
              </div>
              {createError && <p className="text-red-400 text-sm">{createError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-2.5 text-sm">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}{creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {timelineApp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h2 className="text-white font-semibold">Status Timeline</h2>
                <p className="text-gray-500 text-xs mt-0.5">{timelineApp.job.role} @ {timelineApp.job.company}</p>
              </div>
              <button onClick={() => setTimelineApp(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {timelineApp.events && timelineApp.events.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-800" />
                  <div className="space-y-4">
                    {timelineApp.events.map((ev, i) => {
                      const col = COLS.find(c => c.status === ev.toStatus);
                      return (
                        <div key={ev.id} className="flex items-start gap-4 relative">
                          <div className={`w-7 h-7 ${col?.bg || "bg-gray-800"} border-2 border-gray-800 rounded-full flex items-center justify-center shrink-0 z-10`}>
                            <CheckCircle2 className={`w-3.5 h-3.5 ${col?.color || "text-gray-400"}`} />
                          </div>
                          <div className="flex-1 pb-1">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium ${col?.color || "text-gray-400"}`}>{ev.toStatus.charAt(0) + ev.toStatus.slice(1).toLowerCase()}</p>
                              <span className="text-gray-600 text-xs">{formatDateTime(ev.occurredAt)}</span>
                            </div>
                            {ev.fromStatus && <p className="text-gray-600 text-xs mt-0.5">from {ev.fromStatus.toLowerCase()}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-6">No history yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {notesApp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div><h2 className="text-white font-semibold">Edit Notes</h2><p className="text-gray-500 text-xs mt-0.5">{notesApp.job.role} @ {notesApp.job.company}</p></div>
              <button onClick={() => setNotesApp(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={5} placeholder="Add notes..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none placeholder:text-gray-600" />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setNotesApp(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-2.5 text-sm">Cancel</button>
                <button onClick={saveNotes} disabled={savingNotes} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">
                  {savingNotes && <Loader2 className="w-4 h-4 animate-spin" />}{savingNotes ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-400" /></div>
              <div><p className="text-white font-semibold">Delete Application</p><p className="text-gray-400 text-sm">This cannot be undone</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-2.5 text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}{deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
