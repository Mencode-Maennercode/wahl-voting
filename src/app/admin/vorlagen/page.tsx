"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Settings } from 'lucide-react'

export default function TemplatesPage() {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <span className="font-semibold text-slate-800">Einstellungen</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
              <Settings className="h-4 w-4 mr-1" />
              Admin
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <Settings className="h-8 w-8 text-slate-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-4">Stimmzettel-Vorlagen</h1>
            <p className="text-slate-600 mb-8">
              Stimmzettel werden jetzt automatisch mit einem sauberen, einheitlichen Design generiert. 
              Individuelle Vorlagen sind nicht mehr erforderlich.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Was jetzt verfügbar ist:</h2>
              <ul className="text-left space-y-2 text-slate-600">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Automatisch generierte QR-Codes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Veranstaltungs-Informationen
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Individuelle Zugangscodes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  2 Codes pro DIN-A4-Seite mit Schneidelinie
                </li>
              </ul>
            </div>
            <Button onClick={() => router.push('/admin')}>
              <Settings className="h-4 w-4 mr-2" />
              Zurück zum Admin-Dashboard
            </Button>
          </div>
        </div>
        </main>
    </div>
  )
}
