"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, updateDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Save, Building2 } from 'lucide-react'

export default function SettingsPage() {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    email: '',
    phone: ''
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (association) {
      setFormData({
        name: association.name || '',
        address: association.address || '',
        email: association.email || '',
        phone: association.phone || ''
      })
    }
  }, [association])

  const handleSave = async () => {
    if (!association) return
    setSaving(true)

    try {
      const docRef = doc(db, 'associations', association.id)
      await updateDoc(docRef, {
        name: formData.name,
        address: formData.address,
        email: formData.email,
        phone: formData.phone,
        updatedAt: Timestamp.now()
      })

      toast({
        title: "Gespeichert",
        description: "Die Vereinsdaten wurden aktualisiert."
      })

      const stored = localStorage.getItem('vereins-wahlen-auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.name = formData.name
        parsed.address = formData.address
        parsed.email = formData.email
        parsed.phone = formData.phone
        localStorage.setItem('vereins-wahlen-auth', JSON.stringify(parsed))
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast({
        title: "Fehler",
        description: "Die Daten konnten nicht gespeichert werden.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!association) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Vereinseinstellungen</h1>
            <p className="text-slate-600">Verwalten Sie Ihre Vereinsdaten</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Speichern...' : 'Speichern'}
          </Button>
        </div>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-slate-400" />
                <div>
                  <CardTitle>Vereinsdaten</CardTitle>
                  <CardDescription>
                    Diese Informationen erscheinen auf exportierten Dokumenten.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vereinsNummer">Vereinsnummer</Label>
                <Input
                  id="vereinsNummer"
                  value={association.vereinsNummer}
                  disabled
                  className="bg-slate-50"
                />
                <p className="text-xs text-slate-500">Die Vereinsnummer kann nicht geändert werden.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Vereinsname</Label>
                <Input
                  id="name"
                  placeholder="z.B. Sportverein Musterstadt e.V."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  placeholder="Straße und Hausnummer"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="kontakt@verein.de"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+49 123 456789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

              </main>
    </div>
  )
}
