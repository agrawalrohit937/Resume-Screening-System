export default function AmbientMotionBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden hidden md:flex justify-center transform-gpu">
      {/* Compositor-driven ambient orbs with zero main-thread JS overhead */}
      <div
        className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-[#2E9BDA]/10 to-[#6366F1]/10 rounded-full blur-[120px] opacity-70 transform-gpu will-change-transform"
        style={{
          animation: 'spin 180s linear infinite',
        }}
      />
      <div
        className="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-[#3B82F6]/10 to-[#8B5CF6]/10 rounded-full blur-[140px] opacity-40 transform-gpu will-change-transform"
      />
      <div
        className="absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.05) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  )
}
