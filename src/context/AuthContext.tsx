"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import type { Association } from '@/types'

interface AuthContextType {
  association: Association | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (vereinsNummer: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [association, setAssociation] = useState<Association | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('vereins-wahlen-auth')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setAssociation(parsed)
      } catch {
        localStorage.removeItem('vereins-wahlen-auth')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (vereinsNummer: string, password: string): Promise<boolean> => {
    try {
      const associationsRef = collection(db, 'associations')
      const q = query(
        associationsRef,
        where('vereinsNummer', '==', vereinsNummer),
        where('password', '==', password)
      )
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return false
      }

      const doc = querySnapshot.docs[0]
      const data = doc.data()
      const assoc: Association = {
        id: doc.id,
        vereinsNummer: data.vereinsNummer,
        name: data.name || '',
        address: data.address,
        email: data.email,
        phone: data.phone,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      }

      setAssociation(assoc)
      localStorage.setItem('vereins-wahlen-auth', JSON.stringify(assoc))
      return true
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    setAssociation(null)
    localStorage.removeItem('vereins-wahlen-auth')
  }

  return (
    <AuthContext.Provider value={{
      association,
      isAuthenticated: !!association,
      isLoading,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
