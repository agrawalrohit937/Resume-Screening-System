export default function Card({ children, className = '', hover = false }) {
  return (
    <div 
      className={`bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(30,58,138,0.04)] relative overflow-hidden ${
        hover ? 'hover:shadow-[0_8px_30px_rgba(30,58,138,0.08)] hover:-translate-y-1 transition-all duration-300' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
