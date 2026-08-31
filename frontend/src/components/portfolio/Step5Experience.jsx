import React from 'react';
import { 
  ChevronRight, 
  ArrowLeft, 
  Briefcase, 
  GraduationCap, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  CheckCheck 
} from 'lucide-react';

export default function Step5Experience({
  formData,
  setFormData,
  expandedExpIdx,
  setExpandedExpIdx,
  goToStep
}) {
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 border border-slate-200/80 shadow-md space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border-b border-slate-100 pb-6 sm:pb-8">
        <div className="space-y-1.5 sm:space-y-2 max-w-xl">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60 inline-block">
            Step 05 • Career Milestones & Degrees
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Experience, Internships & Education
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Capture all your software engineering roles, internships, and university degrees in full detail.
          </p>
        </div>

      </div>

      {/* Work Experience with Accordions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
            <Briefcase size={14} /> Work Experience & Internships
          </span>
          <button
            type="button"
            onClick={() => {
              const newIdx = formData.experience.length;
              setFormData({
                ...formData,
                experience: [...formData.experience, { company: '', role: '', start_date: '', end_date: 'Present', location: '', description: '' }]
              });
              setExpandedExpIdx(newIdx);
            }}
            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus size={14} /> Add Experience
          </button>
        </div>

        {formData.experience?.map((exp, idx) => {
          const isExpanded = expandedExpIdx === idx;
          return (
            <div 
              key={idx} 
              className={`rounded-3xl border transition-all ${
                isExpanded 
                  ? 'bg-slate-50/90 border-indigo-200 shadow-md p-6' 
                  : 'bg-white hover:bg-slate-50/60 border-slate-200 p-4 cursor-pointer shadow-2xs'
              }`}
            >
              <div 
                className="flex items-center justify-between gap-4"
                onClick={() => setExpandedExpIdx(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-3 truncate">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                    isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <h4 className="text-xs font-black text-slate-900 truncate">{exp.company || 'Company Name'}</h4>
                    <span className="text-[11px] font-semibold text-indigo-600">{exp.role || 'Role'} • {exp.end_date || 'Present'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {formData.experience.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData({ ...formData, experience: formData.experience.filter((_, i) => i !== idx) });
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <div className="p-1 text-slate-400">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-4 pt-4 mt-4 border-t border-slate-200/80 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Company / Organization</label>
                      <input
                        placeholder="e.g. Google / Microsoft"
                        value={exp.company}
                        onChange={(e) => {
                          const upd = [...formData.experience];
                          upd[idx].company = e.target.value;
                          setFormData({ ...formData, experience: upd });
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Role / Designation</label>
                      <input
                        placeholder="e.g. Software Engineer Intern"
                        value={exp.role}
                        onChange={(e) => {
                          const upd = [...formData.experience];
                          upd[idx].role = e.target.value;
                          setFormData({ ...formData, experience: upd });
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Duration</label>
                      <input
                        placeholder="e.g. Feb 2026 – Present"
                        value={exp.end_date || ''}
                        onChange={(e) => {
                          const upd = [...formData.experience];
                          upd[idx].end_date = e.target.value;
                          setFormData({ ...formData, experience: upd });
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">Key Contributions & Architecture Responsibilities</label>
                    <textarea
                      rows={2}
                      placeholder="Describe features engineered, metrics improved, and tech stack utilized..."
                      value={exp.description}
                      onChange={(e) => {
                          const upd = [...formData.experience];
                          upd[idx].description = e.target.value;
                          setFormData({ ...formData, experience: upd });
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-medium"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setExpandedExpIdx(null)}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck size={13} className="text-emerald-600" /> Done Editing
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Education Section */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
            <GraduationCap size={14} /> University & Degree Credentials
          </span>
          <button
            type="button"
            onClick={() => setFormData({
              ...formData,
              education: [...formData.education, { institution: '', degree: '', field_of_study: '', graduation_year: '2026', grade: '' }]
            })}
            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus size={14} /> Add Degree
          </button>
        </div>

        {formData.education?.map((edu, idx) => (
          <div key={idx} className="p-5 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Degree Entry #{idx + 1}</span>
              {formData.education.length > 1 && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, education: formData.education.filter((_, i) => i !== idx) })}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-600">Institution / College</label>
                <input
                  placeholder="e.g. University Name"
                  value={edu.institution}
                  onChange={(e) => {
                    const upd = [...formData.education];
                    upd[idx].institution = e.target.value;
                    setFormData({ ...formData, education: upd });
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-600">Degree & Major</label>
                <input
                  placeholder="e.g. B.Tech Computer Science"
                  value={edu.degree}
                  onChange={(e) => {
                    const upd = [...formData.education];
                    upd[idx].degree = e.target.value;
                    setFormData({ ...formData, education: upd });
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-600">Graduation Year</label>
                <input
                  placeholder="e.g. 2026"
                  value={edu.graduation_year}
                  onChange={(e) => {
                    const upd = [...formData.education];
                    upd[idx].graduation_year = e.target.value;
                    setFormData({ ...formData, education: upd });
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-600">Grade / GPA (Optional)</label>
                <input
                  placeholder="e.g. 8.5 CGPA"
                  value={edu.grade || ''}
                  onChange={(e) => {
                    const upd = [...formData.education];
                    upd[idx].grade = e.target.value;
                    setFormData({ ...formData, education: upd });
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Footer */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={() => goToStep(4)}
          className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={15} /> Back to Step 4
        </button>

        <button
          type="button"
          onClick={() => goToStep(6)}
          className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
        >
          Next: Theme Studio <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
