'use client'

import { useState, useEffect } from 'react'

export interface AuthUser {
  id: number
  email: string
  role: 'admin' | 'user'
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (e) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    loading,
    isLoggedIn: !!user,
    isAdmin: user?.role === 'admin',
    refresh: checkAuth,
  }
}
