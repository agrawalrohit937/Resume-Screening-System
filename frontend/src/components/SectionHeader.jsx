export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 sm:gap-4 mb-2.5 sm:mb-5">
      <div>
        <h2 className="text-lg sm:text-xl font-black text-slate-900 font-display tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 sm:mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
