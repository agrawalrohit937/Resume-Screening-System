import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [tenantId, setTenantState] = useState(() => {
    return localStorage.getItem('tenant_id') || 'default'
  })

  // Sync axios default header whenever tenant changes
  useEffect(() => {
    if (tenantId) {
      api.defaults.headers.common['x-tenant-id'] = tenantId
    }
  }, [tenantId])

  const setTenantId = useCallback((newTenantId) => {
    const cleanId = String(newTenantId || 'default').trim()
    localStorage.setItem('tenant_id', cleanId)
    api.defaults.headers.common['x-tenant-id'] = cleanId
    setTenantState(cleanId)
  }, [])

  return (
    <TenantContext.Provider value={{ tenantId, setTenantId }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return ctx
}
