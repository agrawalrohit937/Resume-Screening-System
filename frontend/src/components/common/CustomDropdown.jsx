import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Premium custom dropdown component replacing native <select>.
 * 
 * @param {Array<{value: any, label: string, icon?: React.ComponentType}>|string[]} options
 * @param {any} value - Currently selected value
 * @param {function} onChange - Callback triggered with selected value: onChange(val)
 * @param {string} placeholder - Display text when nothing is selected
 * @param {string} className - Additional CSS class names for outer container
 * @param {string} buttonClassName - Additional CSS class names for trigger button
 * @param {string} menuClassName - Additional CSS class names for dropdown menu
 * @param {React.ReactNode} icon - Optional icon to show before label
 * @param {boolean} disabled - Whether the dropdown is disabled
 */
export default function CustomDropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  icon: Icon,
  disabled = false,
  id,
  name,
  align = 'left',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Normalize options to { value, label, icon } format
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value,
        label: opt.label ?? String(opt.value),
        icon: opt.icon,
      }
    }
    return { value: opt, label: String(opt) }
  })

  // Find currently selected option with loose string comparison fallback
  const selectedOption = normalizedOptions.find(
    opt => opt.value === value || (value != null && String(opt.value) === String(value))
  )

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (optionValue) => {
    if (onChange) {
      const syntheticEvent = {
        target: { name, value: optionValue },
        currentTarget: { name, value: optionValue },
        preventDefault: () => {},
        stopPropagation: () => {},
      }
      onChange(optionValue, syntheticEvent)
    }
    setIsOpen(false)
  }

  const alignClass = align === 'right' ? 'right-0' : 'left-0'

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block text-left ${className}`}
    >
      {/* ── Trigger Button ────────────────────────────────────────────── */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer ${
          isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''} ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && (
            <span className="text-slate-400 shrink-0">
              {React.isValidElement(Icon) ? Icon : <Icon size={16} />}
            </span>
          )}
          {selectedOption?.icon && (
            <span className="text-slate-500 shrink-0">
              {React.isValidElement(selectedOption.icon) ? selectedOption.icon : <selectedOption.icon size={15} />}
            </span>
          )}
          <span className={`truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-800'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'
          }`}
        />
      </button>

      {/* ── Dropdown Menu (The Options) ─────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute top-full mt-1.5 min-w-full z-50 bg-white border border-slate-100 shadow-xl rounded-xl overflow-hidden py-1 ring-1 ring-black/5 ${alignClass} ${menuClassName}`}
            role="listbox"
          >
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
              {normalizedOptions.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between gap-3 select-none ${
                      isSelected
                        ? 'bg-indigo-50/80 text-indigo-700 font-semibold'
                        : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {opt.icon && (
                        <span className={`shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {React.isValidElement(opt.icon) ? opt.icon : <opt.icon size={15} />}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>

                    {isSelected && (
                      <Check size={15} className="text-indigo-600 shrink-0 stroke-[2.5]" />
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
