import { Check } from 'lucide-react'

const STEPS = ['Setup', 'Guidelines', 'System Check']

/**
 * Shared progress indicator for the Setup → Guidelines → System Check flow.
 * `current` is 1-indexed (1 = Setup, 2 = Guidelines, 3 = System Check).
 */
export default function FlowStepper({ current }) {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
      {STEPS.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={label} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all duration-300
                  ${done ? 'bg-[#2E9BDA] border-[#2E9BDA] text-white' : active ? 'bg-blue-950 border-blue-950 text-white scale-110 shadow-md shadow-blue-950/20' : 'bg-white border-blue-200 text-blue-300'}`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : idx}
              </div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider hidden sm:inline transition-colors ${
                  active ? 'text-blue-950' : done ? 'text-[#1d6fa5]' : 'text-blue-300'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length && (
              <div className="w-6 sm:w-12 h-[2px] rounded-full bg-blue-100 overflow-hidden">
                <div
                  className="h-full bg-[#2E9BDA] transition-all duration-500 ease-out"
                  style={{ width: idx < current ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}