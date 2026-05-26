"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { Briefcase, Plus, Search, Trash2, X, Loader2, Zap, ChevronLeft, ChevronRight, Globe, Download, MapPin, DollarSign, ExternalLink, Save, Edit2 } from "lucide-react";

interface Job { id:string; company:string; role:string; description:string; location?:string; salary?:string; applyUrl?:string; source?:string; createdAt:string; _count:{applications:number}; }
interface ExtJob { externalId:string; company:string; role:string; location:string; description:string; salary?:string; applyUrl:string; postedAt?:string; employerLogo?:string; jobType?:string; isRemote:boolean; }
interface Pagination { total:number; page:number; limit:number; totalPages:number; }
const EMPTY_FORM = { company:"", role:"", description:"", location:"", salary:"", applyUrl:"" };
const EXT_PAGE_SIZE = 10;

export default function JobsPage() {
  const [tab, setTab] = useState<"mine"|"discover">("mine");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination|null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editJob, setEditJob] = useState<Job|null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string|null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [extQuery, setExtQuery] = useState("");
  const [extLocation, setExtLocation] = useState("");
  const [extJobs, setExtJobs] = useState<ExtJob[]>([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extLoadingMore, setExtLoadingMore] = useState(false);
  const [extError, setExtError] = useState("");
  const [extPage, setExtPage] = useState(1);
  const [extHasMore, setExtHasMore] = useState(false);
  const [importing, setImporting] = useState<string|null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const discoverLoadedRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement|null>(null);
  const activeSearchKeyRef = useRef<string>("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string,any> = { page, limit:9 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get("/jobs", { params });
      setJobs(res.data.data.jobs);
      setPagination(res.data.data.pagination);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const loadExternalJobs = useCallback(async ({
    query,
    location = "",
    page,
    replace = false
  }: {
    query: string;
    location?: string;
    page: number;
    replace?: boolean;
  }) => {
    const trimmedQuery = query.trim();
    const trimmedLocation = location.trim();
    if (!trimmedQuery) return;

    const searchKey = `${trimmedQuery}|${trimmedLocation}`;
    activeSearchKeyRef.current = searchKey;

    if (replace) {
      setExtLoading(true);
    } else {
      setExtLoadingMore(true);
    }

    try {
      const res = await api.get("/jobs/search", {
        params: { query: trimmedQuery, location: trimmedLocation, page }
      });
      if (activeSearchKeyRef.current !== searchKey) return;

      const newJobs: ExtJob[] = res.data?.data?.jobs || [];
      const pagination = res.data?.data?.pagination;
      const hasMore = typeof pagination?.hasMore === "boolean"
        ? pagination.hasMore
        : newJobs.length >= EXT_PAGE_SIZE;
      const nextPage = pagination?.page ?? page;

      setExtJobs(prev => {
        const base = replace ? [] : prev;
        const existing = new Set(base.map(job => job.externalId));
        const merged = [
          ...base,
          ...newJobs.filter(job => !existing.has(job.externalId))
        ];
        return merged;
      });
      setExtPage(nextPage);
      setExtHasMore(hasMore);
      setExtError("");
    } catch (err: any) {
      if (replace) {
        setExtError(err.response?.data?.message || "Search failed");
      }
    } finally {
      setExtLoading(false);
      setExtLoadingMore(false);
    }
  }, []);

  // Auto-load default jobs the first time Discover tab is opened
  useEffect(() => {
    if (tab === 'discover' && !discoverLoadedRef.current) {
      discoverLoadedRef.current = true;
      const defaultQuery = 'Software Engineer';
      setExtQuery(defaultQuery);
      setExtLocation('');
      setExtError('');
      setExtJobs([]);
      setExtPage(1);
      setExtHasMore(false);
      loadExternalJobs({ query: defaultQuery, location: '', page: 1, replace: true });
    }
  }, [tab, loadExternalJobs]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(""); setSaving(true);
    try { await api.post("/jobs", form); setForm(EMPTY_FORM); setShowForm(false); await fetchJobs(); }
    catch (err:any) { setFormError(err.response?.data?.message || "Failed"); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editJob) return; setSaving(true);
    try { await api.put(`/jobs/${editJob.id}`, editForm); setEditJob(null); await fetchJobs(); }
    catch { /* silent */ } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/jobs/${deleteId}`); setDeleteId(null); await fetchJobs(); }
    catch { /* silent */ } finally { setDeleting(false); }
  };

  const searchExternal = async () => {
    const query = extQuery.trim();
    const location = extLocation.trim();
    if (!query) return;
    setExtError("");
    setExtJobs([]);
    setExtPage(1);
    setExtHasMore(false);
    await loadExternalJobs({ query, location, page: 1, replace: true });
  };

  useEffect(() => {
    if (tab !== "discover") return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(entries => {
      const first = entries[0];
      if (!first?.isIntersecting) return;
      if (!extHasMore || extLoading || extLoadingMore) return;

      const query = extQuery.trim();
      if (!query) return;

      void loadExternalJobs({
        query,
        location: extLocation.trim(),
        page: extPage + 1
      });
    }, { rootMargin: "300px" });

    observer.observe(node);
    return () => observer.disconnect();
  }, [tab, extHasMore, extLoading, extLoadingMore, extPage, extQuery, extLocation, loadExternalJobs]);

  const importJob = async (job: ExtJob) => {
    setImporting(job.externalId);
    try {
      await api.post("/jobs/import", { company:job.company, role:job.role, description:job.description, location:job.location, salary:job.salary, applyUrl:job.applyUrl, source:"jsearch" });
      setImported(prev => new Set([...prev, job.externalId]));
      await fetchJobs();
    } catch { /* silent */ } finally { setImporting(null); }
  };

  const formatDate = (iso:string) => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-gray-400 mt-0.5 text-sm">Manage saved jobs or discover live listings</p>
        </div>
        {tab === "mine" && (
          <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setFormError(""); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-2.5 transition-colors text-sm">
            <Plus className="w-4 h-4" /> Add Job
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {([["mine","My Jobs",Briefcase],["discover","Discover",Globe]] as const).map(([id,label,Icon]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===id ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === "mine" && (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs..."
              className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600" />
          </div>

          {showForm && (
            <div className="bg-gray-900 border border-blue-500/30 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Add New Job</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[["Company *","company","e.g. Google",true],["Role *","role","e.g. Senior Engineer",true],["Location","location","e.g. Remote",false],["Salary","salary","e.g. $120k-$150k/yr",false]].map(([label,field,ph,req]) => (
                    <div key={field as string}>
                      <label className="text-gray-400 text-xs font-medium block mb-1.5">{label as string}</label>
                      <input required={req as boolean} value={(form as any)[field as string]} onChange={e => setForm(f => ({...f,[field as string]:e.target.value}))} placeholder={ph as string}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">Job Description *</label>
                  <textarea required value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} rows={5} placeholder="Paste the full job description..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none placeholder:text-gray-600" />
                </div>
                {formError && <p className="text-red-400 text-sm">{formError}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-2.5 text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? "Saving..." : "Save Job"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 text-blue-500 animate-spin" /></div>
          ) : jobs.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
              <Briefcase className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-300 font-medium">{debouncedSearch ? "No jobs found" : "No jobs yet"}</p>
              <p className="text-gray-600 text-sm mt-1">{debouncedSearch ? "Try a different search" : "Add a job or use Discover tab"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {jobs.map(job => (
                <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all group flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-blue-600/10 border border-blue-600/20 rounded-xl flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditJob(job); setEditForm({company:job.company,role:job.role,description:job.description,location:job.location||"",salary:job.salary||"",applyUrl:job.applyUrl||""}); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(job.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-white font-semibold text-sm mb-0.5">{job.role}</p>
                  <p className="text-gray-400 text-xs mb-2">{job.company}</p>
                  {job.location && <div className="flex items-center gap-1 text-gray-500 text-xs mb-1"><MapPin className="w-3 h-3" />{job.location}</div>}
                  {job.salary && <div className="flex items-center gap-1 text-emerald-400 text-xs mb-2"><DollarSign className="w-3 h-3" />{job.salary}</div>}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-800">
                    <span className="text-gray-600 text-xs">{job._count.applications} applied · {formatDate(job.createdAt)}</span>
                    <div className="flex gap-1.5">
                      {job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg transition-colors"><ExternalLink className="w-3 h-3" />Apply</a>}
                      <button onClick={() => setExpandedId(expandedId===job.id?null:job.id)} className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors">
                        {expandedId===job.id?"Less":"JD"}
                      </button>
                    </div>
                  </div>
                  {expandedId===job.id && <p className="text-gray-500 text-xs mt-3 leading-relaxed line-clamp-6 whitespace-pre-wrap">{job.description}</p>}
                </div>
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-gray-500 text-sm">{pagination.total} jobs</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-gray-400 text-sm px-2">{page}/{pagination.totalPages}</span>
                <button onClick={() => setPage(p => Math.min(pagination.totalPages,p+1))} disabled={page===pagination.totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "discover" && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <p className="text-white font-semibold mb-4">Search Live Job Listings</p>
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={extQuery} onChange={e => setExtQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && searchExternal()} placeholder="Job title e.g. Software Engineer..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600" />
              </div>
              <div className="relative sm:w-48">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={extLocation} onChange={e => setExtLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchExternal()} placeholder="Location (optional)"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600" />
              </div>
              <button onClick={searchExternal} disabled={extLoading || !extQuery.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl px-5 py-2.5 text-sm whitespace-nowrap">
                {extLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {extLoading ? "Searching..." : "Search Jobs"}
              </button>
            </div>

          </div>

          {extLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            </div>
          )}

          {!extLoading && extJobs.length === 0 && !extError && (
            <div className="text-center py-16 text-gray-600">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">No jobs found</p>
              <p className="text-sm mt-1">Try a different title or location</p>
            </div>
          )}

          {!extLoading && extError && (
            <div className="text-center py-16">
              <p className="text-red-400 font-medium">{extError}</p>
              <p className="text-gray-600 text-sm mt-1">Check your connection or try again</p>
            </div>
          )}

          {!extLoading && extJobs.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {extJobs.map(job => {
                  const isImported = imported.has(job.externalId);
                  const isImporting = importing === job.externalId;
                  return (
                    <div key={job.externalId} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all flex flex-col">
                      <div className="flex items-start gap-3 mb-3">
                        {job.employerLogo ? (
                          <img src={job.employerLogo} alt="" className="w-10 h-10 rounded-xl object-contain bg-white p-1 shrink-0" onError={e => (e.currentTarget.style.display="none")} />
                        ) : (
                          <div className="w-10 h-10 bg-blue-600/10 border border-blue-600/20 rounded-xl flex items-center justify-center shrink-0">
                            <Briefcase className="w-4 h-4 text-blue-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-semibold text-sm truncate">{job.role}</p>
                          <p className="text-gray-400 text-xs truncate">{job.company}</p>
                        </div>
                      </div>
                      <div className="space-y-1 mb-3">
                        {job.location && <div className="flex items-center gap-1.5 text-gray-500 text-xs"><MapPin className="w-3 h-3" />{job.location}{job.isRemote && " · Remote"}</div>}
                        {job.salary && <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><DollarSign className="w-3 h-3" />{job.salary}</div>}
                        {job.jobType && <div className="text-xs text-blue-400 bg-blue-500/10 w-fit px-2 py-0.5 rounded-full">{job.jobType.replace("_"," ")}</div>}
                      </div>
                      <p className="text-gray-600 text-xs line-clamp-3 flex-1 mb-3">{job.description}</p>
                      <div className="flex gap-2 pt-3 border-t border-gray-800">
                        <a href={job.applyUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                          <ExternalLink className="w-3 h-3" /> Apply
                        </a>
                        <button onClick={() => importJob(job)} disabled={isImported || isImporting}
                          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isImported ? "bg-emerald-500/10 text-emerald-400 cursor-default" : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"}`}>
                          {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          {isImported ? "Saved!" : isImporting ? "Saving..." : "Save Job"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div ref={loadMoreRef} className="h-8" />
              {extLoadingMore && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
              )}
              {!extLoadingMore && !extHasMore && (
                <div className="text-center text-gray-600 text-sm py-6">
                  You&apos;re all caught up.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {editJob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">Edit Job</h2>
              <button onClick={() => setEditJob(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[["Company","company"],["Role","role"],["Location","location"],["Salary","salary"]].map(([label,field]) => (
                  <div key={field}>
                    <label className="text-gray-400 text-xs font-medium block mb-1.5">{label}</label>
                    <input value={(editForm as any)[field]} onChange={e => setEditForm(f=>({...f,[field]:e.target.value}))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f=>({...f,description:e.target.value}))} rows={4}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditJob(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-2.5 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" />{saving?"Saving...":"Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-400" /></div>
              <div><p className="text-white font-semibold">Delete Job</p><p className="text-gray-400 text-sm">This cannot be undone</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-2.5 text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}{deleting?"Deleting...":"Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
