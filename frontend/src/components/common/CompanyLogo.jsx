import React, { useState, useEffect } from 'react'
import { ShieldCheck, Building2 } from 'lucide-react'
import { resolveCompanyLogo } from '../../utils/avatarUtils'

const SIZE_MAP = {
  xs: { box: 'w-7 h-7 text-xs rounded-full', icon: 12, check: 10 },
  sm: { box: 'w-9 h-9 text-sm rounded-full', icon: 15, check: 12 },
  md: { box: 'w-12 h-12 text-lg rounded-full', icon: 20, check: 14 },
  lg: { box: 'w-16 h-16 text-2xl rounded-full', icon: 26, check: 16 },
  xl: { box: 'w-20 h-20 text-3xl rounded-full', icon: 32, check: 18 },
  '2xl': { box: 'w-28 h-28 sm:w-32 sm:h-32 text-4xl rounded-full', icon: 44, check: 22 },
}

const GRADIENT_PALETTES = [
  'from-blue-600 to-indigo-600 text-white',
  'from-indigo-600 to-violet-600 text-white',
  'from-violet-600 to-fuchsia-600 text-white',
  'from-emerald-600 to-teal-600 text-white',
  'from-cyan-600 to-blue-600 text-white',
  'from-amber-600 to-orange-600 text-white',
  'from-rose-600 to-pink-600 text-white',
]

export default function CompanyLogo({
  companyName = 'Company',
  logoUrl = null,
  size = 'md',
  showVerified = false,
  className = '',
  onClick,
}) {
  const [imgError, setImgError] = useState(false)
  const resolvedUrl = resolveCompanyLogo(logoUrl) || resolveCompanyLogo(companyName)

  useEffect(() => {
    setImgError(false)
  }, [resolvedUrl, companyName])

  const initial = (companyName || 'C').trim().charAt(0).toUpperCase()
  const charCode = (companyName || 'C').charCodeAt(0) + (companyName || '').length
  const gradient = GRADIENT_PALETTES[charCode % GRADIENT_PALETTES.length]
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className} ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div
        className={`${sizeConfig.box} overflow-hidden flex items-center justify-center font-black font-poppins shadow-xs border border-slate-200/90 bg-white transition-transform duration-200`}
      >
        {resolvedUrl && !imgError ? (
          <img
            src={resolvedUrl}
            alt={companyName}
            className="w-full h-full object-contain p-1.5 bg-white"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center font-black shadow-inner`}
          >
            {initial || <Building2 size={sizeConfig.icon} />}
          </div>
        )}
      </div>

      {showVerified && (
        <span
          title="Verified Employer"
          className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-emerald-100 flex items-center justify-center"
        >
          <ShieldCheck size={sizeConfig.check} className="text-emerald-600 fill-emerald-50" />
        </span>
      )}
    </div>
  )
}
