"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore'
import bcrypt from 'bcryptjs'
import type { Association } from '@/types'

interface RegisterInput {
  name: string
  email: string
  password: string
}

interface RegisterResult {
  success: boolean
  error?: string
  vereinsNummer?: string
}

interface AuthContextType {
  association: Association | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<boolean>
  register: (input: RegisterInput) => Promise<RegisterResult>
  logout: () => void
}

function generateVereinsNummer(): string {
  const digits = Math.floor(10000 + Math.random() * 90000)
  return `VN-${digits}`
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

  const login = async (identifier: string, password: string): Promise<boolean> => {
    try {
      const associationsRef = collection(db, 'associations')
      const trimmed = identifier.trim()
      const isEmail = trimmed.includes('@')
      const field = isEmail ? 'email' : 'vereinsNummer'
      const value = isEmail ? trimmed.toLowerCase() : trimmed

      const q = query(associationsRef, where(field, '==', value))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return false
      }

      const docSnap = querySnapshot.docs[0]
      const data = docSnap.data()

      let passwordOk = false
      let needsUpgrade = false

      if (data.passwordHash && typeof data.passwordHash === 'string') {
        passwordOk = await bcrypt.compare(password, data.passwordHash)
      } else if (data.password && typeof data.password === 'string') {
        // Legacy plaintext fallback; upgrade to hash on successful login
        passwordOk = data.password === password
        needsUpgrade = passwordOk
      }

      if (!passwordOk) {
        return false
      }

      if (needsUpgrade) {
        try {
          const newHash = await bcrypt.hash(password, 10)
          await updateDoc(doc(db, 'associations', docSnap.id), {
            passwordHash: newHash,
            password: null,
            updatedAt: Timestamp.now()
          })
        } catch (upgradeError) {
          console.warn('Password hash upgrade failed:', upgradeError)
        }
      }

      const assoc: Association = {
        id: docSnap.id,
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

  const register = async ({ name, email, password }: RegisterInput): Promise<RegisterResult> => {
    try {
      const cleanEmail = email.trim().toLowerCase()
      const cleanName = name.trim()

      if (!cleanName || !cleanEmail || !password) {
        return { success: false, error: 'Bitte alle Felder ausfüllen.' }
      }
      if (password.length < 8) {
        return { success: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }
      }

      const associationsRef = collection(db, 'associations')

      // Check duplicate email
      const emailQuery = query(associationsRef, where('email', '==', cleanEmail))
      const emailSnap = await getDocs(emailQuery)
      if (!emailSnap.empty) {
        return { success: false, error: 'Diese E-Mail ist bereits registriert.' }
      }

      // Generate unique vereinsNummer
      let vereinsNummer = generateVereinsNummer()
      for (let i = 0; i < 5; i++) {
        const vnQuery = query(associationsRef, where('vereinsNummer', '==', vereinsNummer))
        const vnSnap = await getDocs(vnQuery)
        if (vnSnap.empty) break
        vereinsNummer = generateVereinsNummer()
      }

      const passwordHash = await bcrypt.hash(password, 10)

      const now = Timestamp.now()
      const newDoc = await addDoc(associationsRef, {
        name: cleanName,
        email: cleanEmail,
        vereinsNummer,
        passwordHash,
        createdAt: now,
        updatedAt: now
      })

      const assoc: Association = {
        id: newDoc.id,
        vereinsNummer,
        name: cleanName,
        email: cleanEmail,
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      }

      setAssociation(assoc)
      localStorage.setItem('vereins-wahlen-auth', JSON.stringify(assoc))
      return { success: true, vereinsNummer }
    } catch (error) {
      console.error('Register error:', error)
      return { success: false, error: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.' }
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
      register,
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
