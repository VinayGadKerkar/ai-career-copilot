"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";
import { Upload, FileText, Trash2, Eye, Download, Loader2, X, AlertTriangle } from "lucide-react";

interface Resume { id:string; version:number; fileName:string; targetRole:string|null; createdAt:string; _count:{applications:number}; }
interface ResumeDetail extends Resume { content:string; downloadUrl:string; }

const formatDate = (iso:string) => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

export default function ResumesPage() {
  const [resumes,setResumes]=useState<Resume[]>([]);
  const [loading,setLoading]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [dragOver,setDragOver]=useState(false);
  const [targetRole,setTargetRole]=useState("");
  const [preview,setPreview]=useState<ResumeDetail|null>(null);
  const [previewLoading,setPreviewLoading]=useState(false);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [deleting,setDeleting]=useState(false);
  const [uploadError,setUploadError]=useState("");
  const fileInputRef=useRef<HTMLInputElement>(null);

  const fetchResumes=useCallback(async()=>{
    try { const res=await api.get("/resume"); setResumes(res.data.data.resumes); }
    catch {} finally { setLoading(false); }
  },[]);

  useEffect(()=>{fetchResumes();},[fetchResumes]);

  const handleUpload=async(file:File)=>{
    if(!file||file.type!=="application/pdf"){setUploadError("Please upload a PDF file");return;}
    setUploadError(""); setUploading(true);
    const fd=new FormData(); fd.append("resume",file); if(targetRole.trim()) fd.append("targetRole",targetRole.trim());
    try { await api.post("/resume/upload",fd,{headers:{"Content-Type":"multipart/form-data"}}); setTargetRole(""); await fetchResumes(); }
    catch(err:any){setUploadError(err.response?.data?.message||"Upload failed");}
    finally{setUploading(false);}
  };

  const openPreview=async(id:string)=>{
    setPreviewLoading(true); setPreview(null);
    try{const res=await api.get(`/resume/${id}`);setPreview(res.data.data.resume);}
    catch{}finally{setPreviewLoading(false);}
  };

  const handleDelete=async()=>{
    if(!deleteId)return; setDeleting(true);
    try{await api.delete(`/resume/${deleteId}`);setDeleteId(null);setResumes(prev=>prev.filter(r=>r.id!==deleteId));}
    catch{}finally{setDeleting(false);}
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Resumes</h1>
        <p className="text-gray-400 mt-0.5 text-sm">Upload and manage your resume versions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sticky top-6">
            <p className="text-white font-semibold mb-4">Upload New Resume</p>
            <div className="mb-4">
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Target Role <span className="text-gray-600">(optional)</span></label>
              <input type="text" value={targetRole} onChange={e=>setTargetRole(e.target.value)} placeholder="e.g. Senior Software Engineer"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"/>
            </div>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleUpload(f);}}
              onClick={()=>!uploading&&fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${dragOver?"border-blue-500 bg-blue-500/5":"border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"} ${uploading?"opacity-60 cursor-not-allowed":""}`}>
              {uploading?(
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin"/>
                  <p className="text-gray-300 text-sm">Uploading & parsing...</p>
                </div>
              ):(
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gray-400"/>
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm font-medium">Drop PDF here or <span className="text-blue-400">browse</span></p>
                    <p className="text-gray-600 text-xs mt-1">PDF files only</p>
                  </div>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e=>e.target.files?.[0]&&handleUpload(e.target.files[0])}/>
            </div>
            {uploadError && <div className="mt-3 flex items-center gap-2 text-red-400 text-sm"><AlertTriangle className="w-4 h-4 shrink-0"/>{uploadError}</div>}

            <div className="mt-6 pt-6 border-t border-gray-800">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-blue-400">{resumes.length}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Resumes</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-purple-400">{resumes.reduce((s,r)=>s+r._count.applications,0)}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Applications</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {loading?(
            <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 text-blue-500 animate-spin"/></div>
          ):resumes.length===0?(
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
              <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileText className="w-6 h-6 text-gray-600"/></div>
              <p className="text-gray-300 font-medium">No resumes yet</p>
              <p className="text-gray-600 text-sm mt-1">Upload your first resume to get started</p>
            </div>
          ):(
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resumes.map(r=>(
                <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all group">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-600/10 border border-blue-600/20 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-blue-400 text-sm font-bold">v{r.version}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-semibold truncate">{r.fileName}</p>
                      {r.targetRole && <p className="text-blue-400 text-xs mt-0.5 truncate">{r.targetRole}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                      <p className="text-white text-sm font-bold">{r._count.applications}</p>
                      <p className="text-gray-600 text-xs">Applications</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                      <p className="text-white text-xs font-medium">{formatDate(r.createdAt)}</p>
                      <p className="text-gray-600 text-xs">Uploaded</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>openPreview(r.id)} className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 py-2 rounded-lg transition-colors">
                      <Eye className="w-3.5 h-3.5"/>Preview
                    </button>
                    <button onClick={()=>setDeleteId(r.id)} className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-red-500/10 py-2 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5"/>Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(previewLoading||preview)&&(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            {previewLoading?(<div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 text-blue-500 animate-spin"/></div>)
            :preview&&(
              <>
                <div className="flex items-center justify-between p-5 border-b border-gray-800">
                  <div><p className="text-white font-semibold">{preview.fileName}</p><p className="text-gray-500 text-xs mt-0.5">v{preview.version}{preview.targetRole?` · ${preview.targetRole}`:""}</p></div>
                  <div className="flex items-center gap-2">
                    {preview.downloadUrl&&<a href={preview.downloadUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg"><Download className="w-3.5 h-3.5"/>Download</a>}
                    <button onClick={()=>setPreview(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"><X className="w-4 h-4"/></button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-5">
                  <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-mono bg-gray-950 rounded-xl p-4 border border-gray-800">{preview.content}</pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteId&&(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-400"/></div>
              <div><p className="text-white font-semibold">Delete Resume</p><p className="text-gray-400 text-sm">This cannot be undone</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteId(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-2.5 text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">
                {deleting&&<Loader2 className="w-4 h-4 animate-spin"/>}{deleting?"Deleting...":"Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
