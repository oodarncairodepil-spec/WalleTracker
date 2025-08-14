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
    // Get initial user
    authService.getCurrentUser().then((user) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      setUser(user)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
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
        if (error.message.includes('Auth session missing') || error.message.includes('session_not_found')) {
          toast.success('Signed out successfully!')
          return
        }
        toast.error(error.message)
        throw error
      }
      toast.success('Signed out successfully!')
    } catch (error: any) {
      // Handle auth session errors gracefully
      if (error?.message?.includes('Auth session missing') || error?.message?.includes('session_not_found')) {
        toast.success('Signed out successfully!')
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