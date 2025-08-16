'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { authService } from '../lib/supabase-service'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[AUTH DEBUG] AuthProvider useEffect started, loading:', loading)
    
    // Get initial user
    authService.getCurrentUser().then((user) => {
      console.log('[AUTH DEBUG] getCurrentUser resolved with user:', user ? 'USER_FOUND' : 'NO_USER')
      setUser(user)
      setLoading(false)
      console.log('[AUTH DEBUG] Auth state updated - user:', user ? 'SET' : 'NULL', 'loading: false')
    }).catch((error) => {
      // Handle auth session errors silently to prevent console spam
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log('[AUTH DEBUG] getCurrentUser error:', errorMessage)
      if (!errorMessage.includes('Auth session missing') && 
          !errorMessage.includes('session_not_found') &&
          !errorMessage.includes('AuthSessionMissingError')) {
        console.warn('Auth initialization error:', error)
      }
      setUser(null)
      setLoading(false)
      console.log('[AUTH DEBUG] Auth state updated after error - user: NULL, loading: false')
    })

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      console.log('[AUTH DEBUG] Auth state change detected, user:', user ? 'USER_FOUND' : 'NO_USER')
      setUser(user)
      setLoading(false)
      console.log('[AUTH DEBUG] Auth state updated from listener - user:', user ? 'SET' : 'NULL', 'loading: false')
    })

    return () => {
      console.log('[AUTH DEBUG] AuthProvider cleanup - unsubscribing')
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await authService.signIn(email, password)
      if (error) {
        toast.error(error.message)
        throw error
      }
      toast.success('Signed in successfully!')
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      setLoading(true)
      const { error } = await authService.signUp(email, password, fullName)
      if (error) {
        toast.error(error.message)
        throw error
      }
      toast.success('Account created successfully! Please check your email to verify your account.')
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }



  const signOut = async () => {
    try {
      setLoading(true)
      
      // Check if user is already signed out
      if (!user) {
        toast.success('Already signed out!')
        return
      }
      
      const { error } = await authService.signOut()
      if (error) {
        // Handle specific auth session errors gracefully
        if (error.message.includes('Auth session missing') || 
            error.message.includes('session_not_found') ||
            error.message.includes('AuthSessionMissingError') ||
            error.message.includes('403') ||
            error.message.includes('Forbidden')) {
          toast.success('Signed out successfully!')
          // Clear user state immediately to prevent blinking
          setUser(null)
          return
        }
        toast.error(error.message)
        throw error
      }
      toast.success('Signed out successfully!')
      // Clear user state immediately
      setUser(null)
    } catch (error: unknown) {
      // Handle auth session errors gracefully
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Auth session missing') || 
          errorMessage.includes('session_not_found') ||
          errorMessage.includes('AuthSessionMissingError') ||
          errorMessage.includes('403') ||
          errorMessage.includes('Forbidden')) {
        toast.success('Signed out successfully!')
        // Clear user state immediately to prevent blinking
        setUser(null)
        return
      }
      console.error('Sign out error:', error)
      toast.error('Failed to sign out. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}