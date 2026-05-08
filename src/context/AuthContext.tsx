"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { db, auth } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  type User
} from 'firebase/auth'
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
  login: (email: string, password: string) => Promise<boolean>
  register: (input: RegisterInput) => Promise<RegisterResult>
  logout: () => Promise<void>
}

function generateVereinsNummer(): string {
  const digits = Math.floor(10000 + Math.random() * 90000)
  return `VN-${digits}`
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function loadAssociationForUser(user: User): Promise<Association | null> {
  const ref = doc(db, 'associations', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    id: snap.id,
    vereinsNummer: data.vereinsNummer,
    name: data.name || user.displayName || '',
    address: data.address,
    email: data.email || user.email || undefined,
    phone: data.phone,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date()
  }
}

function mapAuthError(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-Mail oder Passwort ist falsch.'
    case 'auth/email-already-in-use':
      return 'Diese E-Mail ist bereits registriert.'
    case 'auth/invalid-email':
      return 'Ungültige E-Mail-Adresse.'
    case 'auth/weak-password':
      return 'Das Passwort ist zu schwach (mind. 6 Zeichen).'
    case 'auth/too-many-requests':
      return 'Zu viele Versuche. Bitte später erneut versuchen.'
    case 'auth/network-request-failed':
      return 'Netzwerkfehler. Bitte Internetverbindung prüfen.'
    default:
      return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [association, setAssociation] = useState<Association | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const assoc = await loadAssociationForUser(user)
          setAssociation(assoc)
        } catch (err) {
          console.error('Failed to load association:', err)
          setAssociation(null)
        }
      } else {
        setAssociation(null)
      }
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
      const assoc = await loadAssociationForUser(cred.user)
      setAssociation(assoc)
      return !!assoc
    } catch (error: any) {
      console.error('Login error:', error?.code || error)
      return false
    }
  }

  const register = async ({ name, email, password }: RegisterInput): Promise<RegisterResult> => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()

    if (!cleanName || !cleanEmail || !password) {
      return { success: false, error: 'Bitte alle Felder ausfüllen.' }
    }
    if (password.length < 8) {
      return { success: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password)
      try {
        await updateProfile(cred.user, { displayName: cleanName })
      } catch {
        /* non-fatal */
      }

      // Generate unique vereinsNummer
      const associationsRef = collection(db, 'associations')
      let vereinsNummer = generateVereinsNummer()
      for (let i = 0; i < 5; i++) {
        const vnQuery = query(associationsRef, where('vereinsNummer', '==', vereinsNummer))
        const vnSnap = await getDocs(vnQuery)
        if (vnSnap.empty) break
        vereinsNummer = generateVereinsNummer()
      }

      const now = Timestamp.now()
      await setDoc(doc(db, 'associations', cred.user.uid), {
        name: cleanName,
        email: cleanEmail,
        vereinsNummer,
        ownerUid: cred.user.uid,
        createdAt: now,
        updatedAt: now
      })

      const assoc: Association = {
        id: cred.user.uid,
        vereinsNummer,
        name: cleanName,
        email: cleanEmail,
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      }
      setAssociation(assoc)
      return { success: true, vereinsNummer }
    } catch (error: any) {
      console.error('Register error:', error?.code || error)
      return { success: false, error: mapAuthError(error?.code) }
    }
  }

  const logout = async () => {
    await signOut(auth)
    setAssociation(null)
    try {
      localStorage.removeItem('vereins-wahlen-auth')
    } catch {
      /* ignore */
    }
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
