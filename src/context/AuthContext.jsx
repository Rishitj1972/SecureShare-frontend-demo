import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext()

export function useAuth(){
  return useContext(AuthContext)
}

export function AuthProvider({ children }){
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  // Listen for logout triggered by axios interceptor or other tabs
  useEffect(() => {
    const handleLogout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('logout_triggered')
      setUser(null)
    }

    // Listen for logout event from axios interceptor
    window.addEventListener('logout', handleLogout)
    
    // Listen for storage changes from other tabs
    const handleStorageChange = (e) => {
      if (e.key === 'logout_triggered' || (e.key === 'token' && !e.newValue)) {
        handleLogout()
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // Check if logout was triggered on app load
    if (localStorage.getItem('logout_triggered')) {
      handleLogout()
    }

    return () => {
      window.removeEventListener('logout', handleLogout)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password }, {withCredentials: true})
      const accessToken = res.data?.accessToken || res.data?.token
      if(!accessToken) throw new Error('Invalid login response: no access token')
      
      localStorage.setItem('token', accessToken)
      
      // Use user data from login response
      const currentUser = res.data?.user
      if(!currentUser) throw new Error('Invalid login response: no user data')
      
      localStorage.setItem('user', JSON.stringify(currentUser))
      localStorage.removeItem('logout_triggered')
      setUser(currentUser)
      return currentUser
    } catch (error) {
      throw error
    }
  }

  const register = async (data) => {
    const res = await api.post('/auth/register', data)
    return res.data
  }

  const logout = async () => {
    try {
      // Call logout endpoint to invalidate token on server
      await api.post('/auth/logout')
    } catch (error) {
      // Even if logout fails, clear local storage
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('logout_triggered')
      setUser(null)
    }
  }

  const value = { user, login, register, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
