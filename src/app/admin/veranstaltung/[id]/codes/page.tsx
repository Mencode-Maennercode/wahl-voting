"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Download, Printer, QrCode, Users, Settings } from 'lucide-react'
import type { Event, VoterCode } from '@/types'
import { generateUniqueCode } from '@/lib/utils'

export default function EventCodesPage({ params }: { params: { id: string } }) {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [event, setEvent] = useState<Event | null>(null)
    const [voterCodes, setVoterCodes] = useState<VoterCode[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (association && params.id) {
      loadData()
    }
  }, [association, params.id])

  const loadData = async () => {
    if (!association) return

    try {
      // Load event
      const eventRef = doc(db, 'events', params.id)
      const eventDoc = await getDoc(eventRef)
      
      if (eventDoc.exists()) {
        const eventData = eventDoc.data()
        setEvent({
          id: eventDoc.id,
          associationId: eventData.associationId,
          title: eventData.title,
          description: eventData.description,
          startDate: eventData.startDate?.toDate() || new Date(),
          endDate: eventData.endDate?.toDate(),
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          maxVoters: eventData.maxVoters,
          showLinkWithCode: eventData.showLinkWithCode,
          status: eventData.status,
          createdAt: eventData.createdAt?.toDate() || new Date(),
          updatedAt: eventData.updatedAt?.toDate() || new Date()
        })
      }

      // Load existing voter codes
      const codesRef = collection(db, 'voterCodes')
      const codesQuery = query(codesRef, where('eventId', '==', params.id))
      const codesSnapshot = await getDocs(codesQuery)
      
      const loadedCodes: VoterCode[] = []
      codesSnapshot.forEach((doc) => {
        const data = doc.data()
        loadedCodes.push({
          id: doc.id,
          eventId: data.eventId,
          code: data.code,
          votedQuestions: data.votedQuestions || [],
          createdAt: data.createdAt?.toDate() || new Date()
        })
      })
      
      setVoterCodes(loadedCodes)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateCodes = async () => {
    if (!event) return

    setGenerating(true)
    try {
      const codesToGenerate = event.maxVoters - voterCodes.length
      const newCodes: VoterCode[] = []

      for (let i = 0; i < codesToGenerate; i++) {
        const code = generateUniqueCode()
        const voterCode = {
          eventId: event.id,
          code,
          votedQuestions: [],
          createdAt: Timestamp.now()
        }

        const docRef = await addDoc(collection(db, 'voterCodes'), voterCode)
        newCodes.push({
          id: docRef.id,
          eventId: event.id,
          code,
          votedQuestions: [],
          createdAt: new Date()
        })
      }

      setVoterCodes([...voterCodes, ...newCodes])
    } catch (error) {
      console.error('Error generating codes:', error)
    } finally {
      setGenerating(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date)
  }

  const generateBallotHTML = (codes: VoterCode[], startIndex: number) => {
    if (!event) return ''

    const baseUrl = window.location.origin
    const entryUrl = `${baseUrl}/abstimmen`

    // Wir erwarten hier max. 2 Codes pro Seite
    const topCode = codes[0]
    const bottomCode = codes[1]

    const renderHalf = (voterCode: VoterCode | undefined, indexOffset: number) => {
      if (!voterCode) {
        return ''
      }

      const directUrl = `${entryUrl}?code=${voterCode.code}`
      const qrData = event.showLinkWithCode ? directUrl : entryUrl
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}`

      return `
        <div style="flex: 1; padding: 16mm 12mm; display: flex; flex-direction: column; justify-content: center;">
          <div style="text-align: center; margin-bottom: 16px;">
            <h1 style="margin: 0; font-size: 22px; color: #0f172a; font-weight: 700; letter-spacing: 0.02em;">${event.title}</h1>
            ${event.description ? `<p style=\"margin: 8px 0 0 0; font-size: 13px; color: #64748b;\">${event.description}</p>` : ''}
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">${formatDate(event.startDate)} um ${event.startTime}</p>
          </div>

          <div style="display: flex; flex-direction: row; align-items: center; gap: 18px; max-width: 160mm; margin: 0 auto;">
            <div style="flex-shrink: 0;">
              <div style="background: #ffffff; padding: 8px; border-radius: 12px; box-shadow: 0 4px 10px rgba(15,23,42,0.08); border: 1px solid #e2e8f0;">
                <img src="${qrSrc}" alt="QR Code" style="width: 70mm; height: 70mm; border-radius: 10px;" />
              </div>
            </div>
            <div style="flex: 1;">
              <div style="margin-bottom: 8px; font-size: 13px; color: #0369a1; background: #e0f2fe; border-radius: 10px; padding: 10px 14px; border: 1px solid #bae6fd;">
                <p style="margin: 0;">
                  Scannen Sie den QR-Code oder rufen Sie <strong>${entryUrl}</strong> auf und geben Sie den unten stehenden individuellen Code ein.
                </p>
              </div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">Ihr individueller Abstimmcode:</div>
              <div style="font-weight: 700; font-size: 26px; letter-spacing: 0.22em; color: #0f172a; margin-bottom: 8px;">
                ${voterCode.code}
              </div>
            </div>
          </div>
        </div>
      `
    }

    return `
      <div class="ballot-sheet" style="width: 210mm; height: 297mm; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; display: flex; flex-direction: column;">
        <!-- obere Hälfte -->
        ${renderHalf(topCode, 0)}

        <!-- Schneidelinie -->
        <div style="height: 0; border-top: 1px dashed #cbd5e1; margin: 0 12mm; position: relative;">
          <div style="position: absolute; left: 50%; top: -9px; transform: translateX(-50%); background: #f8fafc; padding: 0 6px; font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 4px;">
            <span>✂</span>
            <span>hier schneiden</span>
          </div>
        </div>

        <!-- untere Hälfte -->
        ${renderHalf(bottomCode, 1)}
      </div>
    `
  }

  const printBallots = () => {
    if (!event || voterCodes.length === 0) return

    const codesPerSheet = 2
    const totalSheets = Math.ceil(voterCodes.length / codesPerSheet)
    
    let printHTML = `
      <html>
        <head>
          <title>Stimmzettel - ${event.title}</title>
          <style>
            @page { margin: 15mm; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            .page-break { page-break-after: always; }
          </style>
        </head>
        <body>
    `

    for (let sheet = 0; sheet < totalSheets; sheet++) {
      const startIndex = sheet * codesPerSheet
      const endIndex = Math.min(startIndex + codesPerSheet, voterCodes.length)
      const sheetCodes = voterCodes.slice(startIndex, endIndex)
      
      printHTML += generateBallotHTML(sheetCodes, startIndex)
      
      if (sheet < totalSheets - 1) {
        printHTML += '<div class="page-break"></div>'
      }
    }

    printHTML += `
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printHTML)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const downloadBallots = () => {
    if (!event || voterCodes.length === 0) return

    const codesPerSheet = 2
    const totalSheets = Math.ceil(voterCodes.length / codesPerSheet)
    
    let htmlContent = `
      <html>
        <head>
          <title>Stimmzettel - ${event.title}</title>
          <style>
            @page { margin: 15mm; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            .page-break { page-break-after: always; }
          </style>
        </head>
        <body>
    `

    for (let sheet = 0; sheet < totalSheets; sheet++) {
      const startIndex = sheet * codesPerSheet
      const endIndex = Math.min(startIndex + codesPerSheet, voterCodes.length)
      const sheetCodes = voterCodes.slice(startIndex, endIndex)
      
      htmlContent += generateBallotHTML(sheetCodes, startIndex)
      
      if (sheet < totalSheets - 1) {
        htmlContent += '<div class="page-break"></div>'
      }
    }

    htmlContent += `
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stimmzettel-${event.title.replace(/\s+/g, '-').toLowerCase()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!isAuthenticated || !event) {
    return null
  }

  const codesGenerated = voterCodes.length > 0
  const allCodesUsed = voterCodes.filter(code => code.votedQuestions.length > 0).length === voterCodes.length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <span className="font-semibold text-slate-800">Stimmzettel & Codes</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Removed Fragen button */}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Event Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{event.title}</CardTitle>
              <CardDescription>
                Stimmzettel und Zugangscodes für die Veranstaltung generieren und verwalten
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Status Overview */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{event.maxVoters}</div>
                <p className="text-xs text-slate-600">Max. Teilnehmer</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{voterCodes.length}</div>
                <p className="text-xs text-slate-600">Codes generiert</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-amber-600">{voterCodes.filter(c => c.votedQuestions.length > 0).length}</div>
                <p className="text-xs text-slate-600">Codes verwendet</p>
              </CardContent>
            </Card>
          </div>

          
          {/* Code Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Code-Generierung</CardTitle>
              <CardDescription>
                Generieren Sie eindeutige Zugangscodes für die Wähler
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!codesGenerated ? (
                <div className="text-center py-8">
                  <QrCode className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700 mb-2">Keine Codes generiert</h3>
                  <p className="text-slate-500 mb-4">
                    Generieren Sie {event.maxVoters} Zugangscodes für die maximale Teilnehmerzahl.
                  </p>
                  <Button onClick={generateCodes} disabled={generating}>
                    {generating ? 'Generiere...' : `${event.maxVoters} Codes generieren`}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-green-800">Codes generiert</h4>
                      <p className="text-green-700 text-sm">
                        {voterCodes.length} von {event.maxVoters} Codes wurden generiert
                      </p>
                    </div>
                    <Users className="h-5 w-5 text-green-600" />
                  </div>

                  {voterCodes.length < event.maxVoters && (
                    <Button onClick={generateCodes} disabled={generating} variant="outline">
                      {generating ? 'Generiere...' : `Weitere ${event.maxVoters - voterCodes.length} Codes generieren`}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          
          {/* Export Options */}
          {codesGenerated && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export & Druck</CardTitle>
                <CardDescription>
                  Stimmzettel drucken oder als HTML-Datei herunterladen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button onClick={printBallots}>
                    <Printer className="h-4 w-4 mr-2" />
                    Stimmzettel drucken
                  </Button>
                  <Button variant="outline" onClick={downloadBallots}>
                    <Download className="h-4 w-4 mr-2" />
                    HTML herunterladen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Status */}
          {codesGenerated && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Verwendungs-Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Codes verwendet:</span>
                    <span className="font-medium">
                      {voterCodes.filter(c => c.votedQuestions.length > 0).length} / {voterCodes.length}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${(voterCodes.filter(c => c.votedQuestions.length > 0).length / voterCodes.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
