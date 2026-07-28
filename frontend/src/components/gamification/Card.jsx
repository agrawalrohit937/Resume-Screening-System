export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden ${
        hover ? 'hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1.5 hover:border-slate-200 transition-all duration-300' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}