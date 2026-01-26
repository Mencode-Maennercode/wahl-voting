"use client"

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { Vote, Shield, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { Election, VoterCode } from '@/types'

function VotingContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const [step, setStep] = useState<'code' | 'voting' | 'done' | 'error'>('code')
  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [voterCode, setVoterCode] = useState<VoterCode | null>(null)
  const [election, setElection] = useState<Election | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showInvalidWarning, setShowInvalidWarning] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // Always show code input dialog, even if code is in URL
    const codeFromUrl = searchParams.get('code')
    if (codeFromUrl) {
      setInputCode(codeFromUrl.toUpperCase())
    }
  }, [searchParams])

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = (codeToVerify || inputCode).toUpperCase().trim()
    if (!code || code.length !== 4) {
      toast({
        title: "Ungültiger Code",
        description: "Bitte geben Sie einen gültigen 4-stelligen Code ein.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const codesRef = collection(db, 'voterCodes')
      const q = query(codesRef, where('code', '==', code))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        setErrorMessage('Dieser Code ist ungültig oder existiert nicht.')
        setStep('error')
        setLoading(false)
        return
      }

      const codeDoc = querySnapshot.docs[0]
      const codeData = codeDoc.data()

      if (codeData.hasVoted) {
        setErrorMessage('Mit diesem Code wurde bereits abgestimmt. Jeder Code kann nur einmal verwendet werden.')
        setStep('error')
        setLoading(false)
        return
      }

      const voterCodeData: VoterCode = {
        id: codeDoc.id,
        electionId: codeData.electionId,
        code: codeData.code,
        hasVoted: codeData.hasVoted,
        votedAt: codeData.votedAt?.toDate(),
        createdAt: codeData.createdAt?.toDate() || new Date()
      }

      const electionRef = doc(db, 'elections', codeData.electionId)
      const electionSnap = await getDoc(electionRef)

      if (!electionSnap.exists()) {
        setErrorMessage('Die zugehörige Wahl existiert nicht mehr.')
        setStep('error')
        setLoading(false)
        return
      }

      const electionData = electionSnap.data()

      if (electionData.status !== 'active') {
        if (electionData.status === 'draft') {
          setErrorMessage('Diese Wahl wurde noch nicht gestartet.')
        } else if (electionData.status === 'closed' || electionData.status === 'evaluated') {
          setErrorMessage('Diese Wahl ist bereits beendet.')
        } else {
          setErrorMessage('Diese Wahl ist nicht aktiv.')
        }
        setStep('error')
        setLoading(false)
        return
      }

      const electionObj: Election = {
        id: electionSnap.id,
        associationId: electionData.associationId,
        title: electionData.title,
        description: electionData.description,
        question: electionData.question,
        options: electionData.options,
        allowInvalidVotes: electionData.allowInvalidVotes,
        electionDate: electionData.electionDate?.toDate() || new Date(),
        maxVoters: electionData.maxVoters,
        invitationText: electionData.invitationText,
        showLinkWithCode: electionData.showLinkWithCode || false,
        status: electionData.status,
        codesGenerated: electionData.codesGenerated,
        createdAt: electionData.createdAt?.toDate() || new Date(),
        updatedAt: electionData.updatedAt?.toDate() || new Date()
      }

      setVoterCode(voterCodeData)
      setElection(electionObj)
      setStep('voting')
    } catch (error) {
      console.error('Error verifying code:', error)
      setErrorMessage('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitVote = async () => {
    if (!voterCode || !election) return

    if (!selectedOption && !election.allowInvalidVotes) {
      toast({
        title: "Auswahl erforderlich",
        description: "Bitte wählen Sie eine Option aus.",
        variant: "destructive"
      })
      return
    }

    if (!selectedOption && election.allowInvalidVotes) {
      setShowInvalidWarning(true)
      return
    }

    await submitVote(false)
  }

  const submitVote = async (isInvalid: boolean) => {
    if (!voterCode || !election) return
    setLoading(true)

    try {
      await addDoc(collection(db, 'votes'), {
        electionId: election.id,
        optionId: isInvalid ? null : selectedOption,
        isInvalid: isInvalid,
        votedAt: Timestamp.now()
      })

      await updateDoc(doc(db, 'voterCodes', voterCode.id), {
        hasVoted: true,
        votedAt: Timestamp.now()
      })

      setStep('done')
    } catch (error) {
      console.error('Error submitting vote:', error)
      toast({
        title: "Fehler",
        description: "Ihre Stimme konnte nicht abgegeben werden. Bitte versuchen Sie es erneut.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setShowInvalidWarning(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputCode.length === 4) {
      handleVerifyCode()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Vote className="h-6 w-6 text-slate-700" />
            <span className="font-semibold text-slate-800">Vereins-Wahlen</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        {step === 'code' && (
          <Card className="w-full max-w-md animate-fade-in">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-slate-600" />
              </div>
              <CardTitle className="text-xl">Abstimmung</CardTitle>
              <CardDescription>
                Geben Sie Ihren 4-stelligen Code ein, um an der Abstimmung teilzunehmen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Ihr Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="XXXX"
                    maxLength={4}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    className="text-center text-2xl tracking-widest font-mono"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <Button 
                  onClick={() => handleVerifyCode()} 
                  className="w-full" 
                  disabled={loading || inputCode.length !== 4}
                >
                  {loading ? 'Wird überprüft...' : 'Zur Abstimmung'}
                </Button>
                <p className="text-xs text-center text-slate-500">
                  Ihre Stimme wird anonym abgegeben und kann nicht zurückverfolgt werden.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'voting' && election && (
          <Card className="w-full max-w-lg animate-fade-in">
            <CardHeader>
              <CardTitle className="text-xl">{election.title}</CardTitle>
              {election.description && (
                <CardDescription>{election.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-medium text-lg mb-4">{election.question}</h3>
                  
                  <RadioGroup 
                    value={selectedOption || ''} 
                    onValueChange={setSelectedOption}
                    className="space-y-3"
                  >
                    {election.options
                      .sort((a, b) => a.order - b.order)
                      .map((option) => (
                        <div
                          key={option.id}
                          className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            selectedOption === option.id
                              ? 'border-slate-800 bg-white shadow-sm'
                              : 'border-transparent bg-white hover:border-slate-200'
                          }`}
                          onClick={() => setSelectedOption(option.id)}
                        >
                          <RadioGroupItem value={option.id} id={option.id} />
                          <Label 
                            htmlFor={option.id} 
                            className="flex-1 cursor-pointer text-base"
                          >
                            {option.text}
                          </Label>
                        </div>
                      ))}
                  </RadioGroup>
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={handleSubmitVote} 
                    size="lg" 
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Wird abgesendet...' : 'Stimme abgeben'}
                  </Button>
                  
                  {election.allowInvalidVotes && !selectedOption && (
                    <p className="text-xs text-center text-slate-500">
                      Sie können auch ohne Auswahl fortfahren (ungültige Stimme).
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-800 text-sm">
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  <span>Ihre Stimme wird anonym und verschlüsselt übertragen.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <Card className="w-full max-w-md animate-fade-in text-center">
            <CardContent className="pt-8 pb-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Vielen Dank!
              </h2>
              <p className="text-slate-600 mb-6">
                Ihre Stimme wurde erfolgreich und anonym abgegeben.
              </p>
              <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
                <p>Sie können dieses Fenster nun schließen.</p>
                <p className="mt-2">Der verwendete Code ist nicht mehr gültig.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'error' && (
          <Card className="w-full max-w-md animate-fade-in text-center">
            <CardContent className="pt-8 pb-8">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Fehler
              </h2>
              <p className="text-slate-600 mb-6">
                {errorMessage}
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setStep('code')
                  setInputCode('')
                  setErrorMessage('')
                }}
              >
                Anderen Code eingeben
              </Button>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={showInvalidWarning} onOpenChange={setShowInvalidWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-center">Ungültige Stimme abgeben?</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Sie haben keine Option ausgewählt. Wenn Sie fortfahren, wird Ihre Stimme 
                als ungültig gewertet.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">
                Zurück zur Auswahl
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => submitVote(true)}
                className="w-full sm:w-auto"
              >
                Ungültig abstimmen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>

      <footer className="border-t bg-white py-4">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          Anonyme und sichere Abstimmung | DSGVO-konform
        </div>
      </footer>
    </div>
  )
}

export default function VotingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    }>
      <VotingContent />
    </Suspense>
  )
}
