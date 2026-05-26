"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { BrainCircuit, Loader2, ChevronDown, ChevronUp, Lightbulb, Code2, Users, HelpCircle, Star, AlertTriangle, ExternalLink, Tag, BarChart2 } from "lucide-react";

interface Application { id:string; job:{company:string;role:string}; resume:{version:number;fileName:string}; status:string; }
interface BehaviouralQ { question:string; tip:string; hint:string; }
interface TechnicalQ { question:string; tip:string; difficulty:"Easy"|"Medium"|"Hard"; }
interface SituationalQ { question:string; tip:string; }
interface DSAQuestion { difficulty:string; title:string; frequency:number; acceptance:number; link:string; topics:string[]; }
interface Questions { behavioural:BehaviouralQ[]; technical:TechnicalQ[]; situational:SituationalQ[]; questionsToAsk:string[]; keyThemesToEmphasize:string[]; }
interface PrepResult { applicationId:string; company:string; role:string; questions:Questions; dsaQuestions:DSAQuestion[]; dsaCompanyMatch:string|null; }

const DIFF_COLORS:Record<string,string> = {
  EASY:"text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  MEDIUM:"text-amber-400 bg-amber-500/10 border-amber-500/30",
  HARD:"text-red-400 bg-red-500/10 border-red-500/30",
  Easy:"text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  Medium:"text-amber-400 bg-amber-500/10 border-amber-500/30",
  Hard:"text-red-400 bg-red-500/10 border-red-500/30",
};

function Accordion({question,children}:{question:string;children:React.ReactNode}) {
  const [open,setOpen]=useState(false);
  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/50 transition-colors">
        <span className="text-gray-200 text-sm font-medium pr-4">{question}</span>
        {open?<ChevronUp className="w-4 h-4 text-gray-500 shrink-0"/>:<ChevronDown className="w-4 h-4 text-gray-500 shrink-0"/>}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-800">{children}</div>}
    </div>
  );
}

export default function InterviewPrepPage() {
  const [apps,setApps]=useState<Application[]>([]);
  const [appId,setAppId]=useState("");
  const [loading,setLoading]=useState(true);
  const [generating,setGenerating]=useState(false);
  const [result,setResult]=useState<PrepResult|null>(null);
  const [error,setError]=useState("");
  const [activeTab,setActiveTab]=useState<"ai"|"dsa">("ai");

  useEffect(() => {
    api.get("/applications",{params:{limit:50}}).then(res=>setApps(res.data.data.applications)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const handleGenerate = async () => {
    if (!appId) { setError("Please select an application"); return; }
    setError(""); setResult(null); setGenerating(true);
    try { const res=await api.post("/interview/prep",{applicationId:appId}); setResult(res.data.data); setActiveTab("ai"); }
    catch (err:any) { setError(err.response?.data?.message||"Failed to generate questions"); }
    finally { setGenerating(false); }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-600/10 border border-purple-600/20 rounded-xl flex items-center justify-center">
          <BrainCircuit className="w-5 h-5 text-purple-400"/>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Interview Prep Coach</h1>
          <p className="text-gray-400 text-sm">AI questions + company DSA problems tailored to your application</p>
        </div>
      </div>

      <div className={`grid gap-8 ${result ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 max-w-2xl"}`}>
        <div className="lg:col-span-1">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sticky top-6">
            <p className="text-gray-300 text-sm font-medium mb-3">Select Application</p>
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin"/>Loading...</div>
            ) : (
              <select value={appId} onChange={e=>setAppId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 mb-4">
                <option value="">Choose an application...</option>
                {apps.map(a=><option key={a.id} value={a.id}>{a.job.role} @ {a.job.company} — {a.status}</option>)}
              </select>
            )}
            {error && <div className="flex items-center gap-2 text-red-400 text-sm mb-4"><AlertTriangle className="w-4 h-4 shrink-0"/>{error}</div>}
            <button onClick={handleGenerate} disabled={generating||loading}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-xl px-6 py-3 transition-colors text-sm">
              {generating?<><Loader2 className="w-4 h-4 animate-spin"/>Generating...</>:<><BrainCircuit className="w-4 h-4"/>Generate Prep</>}
            </button>

            {result && (
              <div className="mt-5 pt-5 border-t border-gray-800">
                <div className="bg-purple-600/10 border border-purple-600/20 rounded-xl p-4">
                  <p className="text-purple-300 text-xs font-medium uppercase tracking-wider mb-1">Prepping for</p>
                  <p className="text-white font-bold">{result.role}</p>
                  <p className="text-gray-400 text-sm">{result.company}</p>
                </div>
                {result.questions.keyThemesToEmphasize?.length>0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2"><Star className="w-3.5 h-3.5 text-yellow-400"/><p className="text-gray-400 text-xs font-medium">Key Themes</p></div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.questions.keyThemesToEmphasize.map((t,i)=>(
                        <span key={i} className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs px-2.5 py-1 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="lg:col-span-2">
            <div className="flex gap-1 mb-5 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
              <button onClick={()=>setActiveTab("ai")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab==="ai"?"bg-purple-600 text-white":"text-gray-400 hover:text-white"}`}>
                <BrainCircuit className="w-4 h-4"/>AI Questions
              </button>
              <button onClick={()=>setActiveTab("dsa")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab==="dsa"?"bg-purple-600 text-white":"text-gray-400 hover:text-white"}`}>
                <Code2 className="w-4 h-4"/>DSA Practice
                {result.dsaQuestions.length>0 && <span className="bg-purple-500/30 text-purple-300 text-xs px-1.5 py-0.5 rounded-full">{result.dsaQuestions.length}</span>}
              </button>
            </div>

            {activeTab==="ai" && (
              <div className="space-y-5">
                {result.questions.behavioural?.length>0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-blue-400"/><h3 className="text-white font-semibold">Behavioural</h3><span className="text-xs text-gray-500">STAR method</span></div>
                    <div className="space-y-3">
                      {result.questions.behavioural.map((q,i)=>(
                        <Accordion key={i} question={q.question}>
                          <div className="pt-3 space-y-2">
                            <div className="flex gap-2"><Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5"/><p className="text-amber-300 text-xs">{q.tip}</p></div>
                            <div className="flex gap-2"><span className="text-blue-400 text-xs shrink-0">→</span><p className="text-blue-300 text-xs">{q.hint}</p></div>
                          </div>
                        </Accordion>
                      ))}
                    </div>
                  </div>
                )}
                {result.questions.technical?.length>0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4"><Code2 className="w-4 h-4 text-green-400"/><h3 className="text-white font-semibold">Technical</h3></div>
                    <div className="space-y-3">
                      {result.questions.technical.map((q,i)=>(
                        <Accordion key={i} question={q.question}>
                          <div className="pt-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${DIFF_COLORS[q.difficulty]||""} mb-2 inline-block`}>{q.difficulty}</span>
                            <div className="flex gap-2"><Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5"/><p className="text-amber-300 text-xs">{q.tip}</p></div>
                          </div>
                        </Accordion>
                      ))}
                    </div>
                  </div>
                )}
                {result.questions.situational?.length>0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4 text-purple-400"/><h3 className="text-white font-semibold">Situational</h3></div>
                    <div className="space-y-3">
                      {result.questions.situational.map((q,i)=>(
                        <Accordion key={i} question={q.question}>
                          <div className="pt-3"><div className="flex gap-2"><Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5"/><p className="text-amber-300 text-xs">{q.tip}</p></div></div>
                        </Accordion>
                      ))}
                    </div>
                  </div>
                )}
                {result.questions.questionsToAsk?.length>0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4 text-emerald-400"/><h3 className="text-white font-semibold">Questions to Ask Them</h3></div>
                    <ul className="space-y-2">
                      {result.questions.questionsToAsk.map((q,i)=>(
                        <li key={i} className="flex gap-2 text-sm text-gray-300"><span className="text-emerald-400 shrink-0 font-bold">{i+1}.</span>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab==="dsa" && (
              <div>
                {result.dsaCompanyMatch && (
                  <div className="bg-purple-600/10 border border-purple-600/20 rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-purple-400 shrink-0"/>
                    <p className="text-purple-300 text-sm">Top LeetCode problems asked at <strong>{result.dsaCompanyMatch}</strong> — sorted by frequency, distributed by difficulty</p>
                  </div>
                )}
                {result.dsaQuestions.length===0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                    <Code2 className="w-10 h-10 text-gray-700 mx-auto mb-3"/>
                    <p className="text-gray-400 font-medium">No DSA data for {result.company}</p>
                    <p className="text-gray-600 text-sm mt-1">Company not found in the question bank</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {result.dsaQuestions.map((q,i)=>(
                      <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-all">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-600 text-sm font-bold w-5">{i+1}</span>
                            <h3 className="text-white font-semibold">{q.title}</h3>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${DIFF_COLORS[q.difficulty]||"text-gray-400 bg-gray-800 border-gray-700"}`}>{q.difficulty}</span>
                        </div>
                        <div className="flex items-center gap-4 mb-3 ml-8">
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                            <BarChart2 className="w-3 h-3"/><span>Frequency: <span className="text-gray-300">{q.frequency.toFixed(1)}</span></span>
                          </div>
                          <div className="text-gray-500 text-xs">
                            Acceptance: <span className="text-gray-300">{(q.acceptance*100).toFixed(1)}%</span>
                          </div>
                        </div>
                        {q.topics.length>0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3 ml-8">
                            {q.topics.map((t,ti)=>(
                              <span key={ti} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                                <Tag className="w-2.5 h-2.5"/>{t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="ml-8">
                          <a href={q.link} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">
                            <ExternalLink className="w-3 h-3"/>Solve on LeetCode
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
