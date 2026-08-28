import React, { useState } from 'react';
import { 
  ChevronRight, 
  ArrowLeft, 
  Code2, 
  Plus, 
  Trash2, 
  Layers, 
  Sparkles, 
  Check, 
  Edit2 
} from 'lucide-react';
import toast from 'react-hot-toast';

// Curated aesthetic gradients for dynamic categories
const CATEGORY_COLORS = [
  { border: 'border-indigo-200', text: 'text-indigo-600', bg: 'bg-indigo-50/50', badge: 'bg-indigo-100 text-indigo-700' },
  { border: 'border-cyan-200', text: 'text-cyan-600', bg: 'bg-cyan-50/50', badge: 'bg-cyan-100 text-cyan-700' },
  { border: 'border-violet-200', text: 'text-violet-600', bg: 'bg-violet-50/50', badge: 'bg-violet-100 text-violet-700' },
  { border: 'border-emerald-200', text: 'text-emerald-600', bg: 'bg-emerald-50/50', badge: 'bg-emerald-100 text-emerald-700' },
  { border: 'border-amber-200', text: 'text-amber-600', bg: 'bg-amber-50/50', badge: 'bg-amber-100 text-amber-700' },
  { border: 'border-rose-200', text: 'text-rose-600', bg: 'bg-rose-50/50', badge: 'bg-rose-100 text-rose-700' }
];

// Helper to eliminate any 'other' / 'others' categories and re-classify skills
export const cleanSkillsDict = (skillsObj) => {
  if (!skillsObj || typeof skillsObj !== 'object' || Array.isArray(skillsObj)) return {};
  
  const clean = {};
  const orphans = [];
  
  for (const [key, value] of Object.entries(skillsObj)) {
    if (!key) continue;
    const cleanKey = key.trim();
    const lower = cleanKey.toLowerCase();
    
    const list = Array.isArray(value) ? value.filter(Boolean) : (typeof value === 'string' ? [value] : []);
    if (list.length === 0) continue;
    
    // Check if key is other / miscellaneous
    if (['other', 'others', 'miscellaneous', 'general', 'basic skills', 'uncategorized'].includes(lower)) {
      orphans.push(...list);
    } else {
      clean[cleanKey] = list;
    }
  }
  
  // Re-classify any orphans into proper domain categories
  if (orphans.length > 0) {
    for (const orphan of orphans) {
      const oLower = orphan.toLowerCase();
      if (['git', 'docker', 'aws', 'linux', 'kubernetes', 'gcp', 'azure', 'postman', 'ci/cd'].some(k => oLower.includes(k))) {
        clean['Cloud & DevOps Architecture'] = [...(clean['Cloud & DevOps Architecture'] || []), orphan];
      } else if (['sql', 'mongo', 'postgres', 'redis', 'mysql'].some(k => oLower.includes(k))) {
        clean['Databases & Storage'] = [...(clean['Databases & Storage'] || []), orphan];
      } else if (['react', 'vue', 'angular', 'tailwind', 'css', 'html', 'next'].some(k => oLower.includes(k))) {
        clean['Frontend & UI Engineering'] = [...(clean['Frontend & UI Engineering'] || []), orphan];
      } else if (['python', 'fastapi', 'django', 'node', 'express', 'java', 'c++'].some(k => oLower.includes(k))) {
        clean['Backend & Architecture'] = [...(clean['Backend & Architecture'] || []), orphan];
      } else {
        clean['Backend & Architecture'] = [...(clean['Backend & Architecture'] || []), orphan];
      }
    }
  }
  
  return clean;
};

export default function Step3Skills({
  formData,
  setFormData,
  goToStep
}) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [skillInputs, setSkillInputs] = useState({});

  const skillsMap = cleanSkillsDict(formData.skills);

  const categories = Object.entries(skillsMap);
  const totalSkillsCount = categories.reduce((sum, [_, list]) => sum + (Array.isArray(list) ? list.length : 0), 0);

  // Add a new custom category
  const handleAddCategory = () => {
    const clean = newCategoryName.trim();
    if (!clean) {
      toast.error('Please enter a category name');
      return;
    }
    if (skillsMap[clean]) {
      toast.error('Category already exists');
      return;
    }

    setFormData(prev => ({
      ...prev,
      skills: {
        ...skillsMap,
        [clean]: []
      }
    }));
    setNewCategoryName('');
    setShowAddCategory(false);
    toast.success(`Category "${clean}" created!`);
  };

  // Delete a category
  const handleDeleteCategory = (catName) => {
    const updated = { ...skillsMap };
    delete updated[catName];
    setFormData(prev => ({ ...prev, skills: updated }));
    toast.success(`Deleted category "${catName}"`);
  };

  // Add skill to a category
  const handleAddSkillToCategory = (catName) => {
    const text = (skillInputs[catName] || '').trim();
    if (!text) return;

    const currentList = Array.isArray(skillsMap[catName]) ? skillsMap[catName] : [];
    if (!currentList.includes(text)) {
      setFormData(prev => ({
        ...prev,
        skills: {
          ...skillsMap,
          [catName]: [...currentList, text]
        }
      }));
    }

    setSkillInputs(prev => ({ ...prev, [catName]: '' }));
  };

  // Remove skill from category
  const handleRemoveSkillFromCategory = (catName, skillToRemove) => {
    const currentList = Array.isArray(skillsMap[catName]) ? skillsMap[catName] : [];
    setFormData(prev => ({
      ...prev,
      skills: {
        ...skillsMap,
        [catName]: currentList.filter(s => s !== skillToRemove)
      }
    }));
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-md space-y-8">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-2 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60 inline-block">
              Step 03 • Technical Matrix
            </span>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {categories.length} Categories • {totalSkillsCount} Skills
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Curated Technical & Domain Matrix
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Skills are organized dynamically into AI-curated, domain-specific categories without generic filler. Add custom categories or tag skills with 1-click.
          </p>
        </div>

        {/* Add Category Trigger Button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl flex items-center gap-2 shrink-0 cursor-pointer shadow-md shadow-indigo-600/20 transition-transform active:scale-95"
          >
            <Plus size={15} /> Add Custom Category
          </button>
        </div>
      </div>

      {/* Inline Create Category Form */}
      {showAddCategory && (
        <div className="p-5 bg-indigo-50/60 border border-indigo-200 rounded-3xl space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900">
              New Domain Category
            </h4>
            <button
              type="button"
              onClick={() => setShowAddCategory(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              Cancel
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
              placeholder="e.g. Distributed Cloud Systems, Generative AI, Quantitative Analysis..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer"
            >
              Create Category
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="text-center py-14 px-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Code2 size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-800">No Skill Categories Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first domain category (e.g. "Full-Stack Web", "Machine Learning") to showcase your technical stack.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCategory(true)}
            className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl"
          >
            + Create First Category
          </button>
        </div>
      )}

      {/* ── DYNAMIC 2-COLUMN GRID OF DOMAIN CATEGORIES ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {categories.map(([catName, list], idx) => {
          const colorTheme = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          const skillArray = Array.isArray(list) ? list : [];
          const inputValue = skillInputs[catName] || '';

          return (
            <div 
              key={catName} 
              className={`bg-white rounded-3xl p-6 border ${colorTheme.border} shadow-sm space-y-4 hover:shadow-md transition-all relative group`}
            >
              {/* Category Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 truncate">
                  <div className={`w-9 h-9 rounded-2xl ${colorTheme.bg} flex items-center justify-center shadow-2xs shrink-0`}>
                    <Code2 size={16} className={colorTheme.text} />
                  </div>
                  <span className="text-sm font-black text-slate-900 tracking-tight truncate">
                    {catName}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${colorTheme.badge} border ${colorTheme.border}`}>
                    {skillArray.length} {skillArray.length === 1 ? 'Skill' : 'Skills'}
                  </span>
                  
                  {categories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(catName)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete entire category"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Tag Pills Container */}
              <div className="flex flex-wrap gap-1.5 min-h-[44px] p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70">
                {skillArray.map((skill, sIdx) => (
                  <span 
                    key={sIdx} 
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs hover:border-slate-300 group/pill"
                  >
                    {skill}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveSkillFromCategory(catName, skill)} 
                      className="text-slate-400 hover:text-rose-600 font-black cursor-pointer ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                {skillArray.length === 0 && (
                  <span className="text-xs text-slate-400 italic py-1 px-1">
                    No skills in this category yet. Add below.
                  </span>
                )}
              </div>

              {/* Add Skill Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder={`+ Add skill to ${catName.split(' ')[0]} & press Enter`}
                  value={inputValue}
                  onChange={(e) => setSkillInputs(prev => ({ ...prev, [catName]: e.target.value }))}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') { 
                      e.preventDefault(); 
                      handleAddSkillToCategory(catName); 
                    } 
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <button 
                  type="button" 
                  onClick={() => handleAddSkillToCategory(catName)} 
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-transform active:scale-95 shrink-0"
                >
                  + Add
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={() => goToStep(2)}
          className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl flex items-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={15} /> Back to Step 2
        </button>

        <button
          type="button"
          onClick={() => goToStep(4)}
          className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
        >
          Next: Featured Projects <ChevronRight size={15} />
        </button>
      </div>

    </div>
  );
}
