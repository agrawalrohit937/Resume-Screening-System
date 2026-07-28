export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
      <div>
        <h2 className="text-xl font-black text-slate-900 font-display tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm font-medium text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
