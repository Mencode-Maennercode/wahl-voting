"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Printer, RefreshCw, QrCode, Link as LinkIcon } from 'lucide-react'
import QRCode from 'qrcode'
import type { Election, VoterCode } from '@/types'
import { generateUniqueCode } from '@/lib/utils'

export default function CodesPage() {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const electionId = params.id as string
  const printRef = useRef<HTMLDivElement>(null)

  const [election, setElection] = useState<Election | null>(null)
  const [codes, setCodes] = useState<VoterCode[]>([])
  const [qrDataUrls, setQrDataUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (electionId && association) {
      loadData()
    }
  }, [electionId, association])

  const loadData = async () => {
    try {
      const docRef = doc(db, 'elections', electionId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        
        if (data.associationId !== association?.id) {
          router.push('/admin')
          return
        }

        const electionData: Election = {
          id: docSnap.id,
          associationId: data.associationId,
          title: data.title,
          description: data.description,
          electionDate: data.electionDate?.toDate() || new Date(),
          maxVoters: data.maxVoters,
          invitationText: data.invitationText,
          showLinkWithCode: data.showLinkWithCode || false,
          status: data.status,
          codesGenerated: data.codesGenerated,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        }

        setElection(electionData)

        const codesRef = collection(db, 'voterCodes')
        const q = query(codesRef, where('electionId', '==', electionId))
        const codesSnap = await getDocs(q)
        
        const loadedCodes: VoterCode[] = []
        codesSnap.forEach((doc) => {
          const codeData = doc.data()
          loadedCodes.push({
            id: doc.id,
            electionId: codeData.electionId,
            code: codeData.code,
            votedQuestions: codeData.votedQuestions || [],
            createdAt: codeData.createdAt?.toDate() || new Date()
          })
        })

        setCodes(loadedCodes)

        if (loadedCodes.length > 0) {
          await generateQrCodes(loadedCodes, electionData)
        }
      } else {
        router.push('/admin')
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const generateQrCodes = async (voterCodes: VoterCode[], electionData: Election) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const newQrDataUrls = new Map<string, string>()

    for (const code of voterCodes) {
      const voteUrl = `${baseUrl}/abstimmen?code=${code.code}`
      try {
        const dataUrl = await QRCode.toDataURL(voteUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff'
          }
        })
        newQrDataUrls.set(code.id, dataUrl)
      } catch (err) {
        console.error('QR generation error:', err)
      }
    }

    setQrDataUrls(newQrDataUrls)
  }

  const handleGenerateCodes = async () => {
    if (!election) return
    setGenerating(true)

    try {
      const codesRef = collection(db, 'voterCodes')
      const existingQ = query(codesRef, where('electionId', '==', electionId))
      const existingSnap = await getDocs(existingQ)
      
      const deletePromises = existingSnap.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deletePromises)

      const newCodes: VoterCode[] = []
      const usedCodes = new Set<string>()

      for (let i = 0; i < election.maxVoters; i++) {
        let code = generateUniqueCode(4)
        while (usedCodes.has(code)) {
          code = generateUniqueCode(4)
        }
        usedCodes.add(code)

        const codeDoc = await addDoc(codesRef, {
          electionId: electionId,
          code: code,
          votedQuestions: [],
          createdAt: Timestamp.now()
        })

        newCodes.push({
          id: codeDoc.id,
          electionId: electionId,
          code: code,
          votedQuestions: [],
          createdAt: new Date()
        })
      }

      await updateDoc(doc(db, 'elections', electionId), {
        codesGenerated: true,
        updatedAt: Timestamp.now()
      })

      setCodes(newCodes)
      await generateQrCodes(newCodes, election)

      toast({
        title: "Codes generiert",
        description: `${election.maxVoters} Stimmzettel wurden erfolgreich erstellt.`
      })

      setElection({ ...election, codesGenerated: true })
    } catch (error) {
      console.error('Error generating codes:', error)
      toast({
        title: "Fehler",
        description: "Codes konnten nicht generiert werden.",
        variant: "destructive"
      })
    } finally {
      setGenerating(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const getBaseUrl = () => {
    return typeof window !== 'undefined' ? window.location.origin : ''
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!election) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50 no-print">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push(`/admin/wahl/${electionId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div className="flex gap-2">
            {codes.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Neu generieren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Codes neu generieren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Alle bestehenden Codes werden gelöscht und neue erstellt. 
                      Bereits gedruckte Stimmzettel werden ungültig.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGenerateCodes}>
                      Neu generieren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {codes.length > 0 && (
              <Button onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Drucken
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="no-print mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Stimmzettel</h1>
          <p className="text-slate-600">{election.title}</p>
        </div>

        {codes.length === 0 ? (
          <Card className="max-w-md mx-auto no-print">
            <CardHeader className="text-center">
              <QrCode className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <CardTitle>Stimmzettel generieren</CardTitle>
              <CardDescription>
                Erstellen Sie {election.maxVoters} einmalige Stimmzettel für die Wahl.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleGenerateCodes} 
                className="w-full" 
                disabled={generating}
              >
                {generating ? 'Generieren...' : `${election.maxVoters} Stimmzettel erstellen`}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="no-print mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">
                <strong>{codes.length} Stimmzettel</strong> wurden generiert. 
                Klicken Sie auf "Drucken" um alle Stimmzettel auszudrucken.
              </p>
            </div>

            <div ref={printRef} className="space-y-0">
              {codes.map((code, index) => (
                <div 
                  key={code.id} 
                  className="ballot-page bg-white p-8 border border-slate-200 mb-4 print:mb-0 print:border-0"
                  style={{ pageBreakAfter: 'always' }}
                >
                  <div className="max-w-md mx-auto text-center">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">
                      {election.title}
                    </h2>
                    <p className="text-slate-600 mb-6">
                      {election.invitationText}
                    </p>
                    
                    <div className="border-t border-b border-slate-200 py-6 my-6">
                      <div className="space-y-4">
                        <p className="text-slate-500">Scannen Sie den QR-Code:</p>
                        {qrDataUrls.get(code.id) && (
                          <img 
                            src={qrDataUrls.get(code.id)} 
                            alt="QR Code" 
                            className="mx-auto"
                          />
                        )}
                        {election.showLinkWithCode && (
                          <>
                            <p className="text-slate-500 text-sm">
                              Oder besuchen Sie {getBaseUrl()}/abstimmen
                            </p>
                            <div className="text-2xl font-bold tracking-widest text-slate-800">
                              Code: {code.code}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-400">
                      Dieser Stimmzettel ist einmalig verwendbar. 
                      Bitte bewahren Sie ihn sicher auf.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Stimmzettel {index + 1} von {codes.length}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
