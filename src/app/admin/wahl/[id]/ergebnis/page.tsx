"use client"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Download, Trash2, BarChart3, Users, CheckCircle2, XCircle } from 'lucide-react'
import { jsPDF } from 'jspdf'
import type { Election, ElectionResult, ElectionQuestion, QuestionResult, OptionResult, Vote } from '@/types'
import { formatDate } from '@/lib/utils'

export default function ResultsPage() {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const electionId = params.id as string

  const [election, setElection] = useState<Election | null>(null)
  const [questions, setQuestions] = useState<ElectionQuestion[]>([])
  const [result, setResult] = useState<ElectionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)

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

        // Fixed: Ensure correct property names for Election type
        const electionData: Election = {
          id: docSnap.id,
          associationId: data.associationId,
          title: data.title,
          description: data.description,
          electionDate: data.electionDate?.toDate() || new Date(),
          maxVoters: data.maxVoters,
          invitationText: data.invitationText,
          showLinkWithCode: data.showLinkWithCode,
          status: data.status,
          codesGenerated: data.codesGenerated,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        }

        setElection(electionData)
        
        const questionsRef = collection(db, 'electionQuestions')
        const questionsQuery = query(questionsRef, where('electionId', '==', electionId))
        const questionsSnap = await getDocs(questionsQuery)
        
        const loadedQuestions: ElectionQuestion[] = []
        questionsSnap.forEach((qDoc) => {
          const qData = qDoc.data()
          loadedQuestions.push({
            id: qDoc.id,
            electionId: qData.electionId,
            question: qData.question,
            options: qData.options,
            allowInvalidVotes: qData.allowInvalidVotes,
            isActive: qData.isActive,
            order: qData.order,
            createdAt: qData.createdAt?.toDate() || new Date(),
            updatedAt: qData.updatedAt?.toDate() || new Date()
          })
        })
        
        loadedQuestions.sort((a, b) => a.order - b.order)
        setQuestions(loadedQuestions)
        
        await calculateResults(electionData, loadedQuestions)
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

  const calculateResults = async (electionData: Election, questionsData: ElectionQuestion[]) => {
    try {
      const votesRef = collection(db, 'votes')
      const q = query(votesRef, where('electionId', '==', electionId))
      const votesSnap = await getDocs(q)

      const votes: Vote[] = []
      votesSnap.forEach((doc) => {
        const data = doc.data()
        votes.push({
          id: doc.id,
          electionId: data.electionId,
          questionId: data.questionId,
          optionId: data.optionId,
          isInvalid: data.isInvalid,
          votedAt: data.votedAt?.toDate() || new Date()
        })
      })

      const codesRef = collection(db, 'voterCodes')
      const codesQ = query(codesRef, where('electionId', '==', electionId))
      const codesSnap = await getDocs(codesQ)

      const questionResults: QuestionResult[] = questionsData.map(question => {
        const questionVotes = votes.filter(v => v.questionId === question.id)
        const totalVotes = questionVotes.length
        const invalidVotes = questionVotes.filter(v => v.isInvalid).length
        const validVotes = questionVotes.filter(v => !v.isInvalid)

        const optionResults: OptionResult[] = question.options.map(option => {
          const optionVotes = validVotes.filter(v => v.optionId === option.id).length
          const validTotal = totalVotes - invalidVotes
          return {
            optionId: option.id,
            text: option.text,
            votes: optionVotes,
            percentage: validTotal > 0 ? (optionVotes / validTotal) * 100 : 0
          }
        })

        optionResults.sort((a, b) => b.votes - a.votes)

        return {
          questionId: question.id,
          question: question.question,
          totalVotes: totalVotes,
          invalidVotes: invalidVotes,
          options: optionResults
        }
      })

      const resultData: ElectionResult = {
        electionId: electionId,
        title: electionData.title,
        questions: questionResults,
        totalVoters: codesSnap.size,
        evaluatedAt: new Date()
      }

      setResult(resultData)
    } catch (error) {
      console.error('Error calculating results:', error)
    }
  }

  const handleExportPdf = async () => {
    if (!result || !election || !association) return

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    
    pdf.setFontSize(20)
    pdf.text('Wahlergebnis', pageWidth / 2, 20, { align: 'center' })
    
    pdf.setFontSize(12)
    pdf.text(result.title, pageWidth / 2, 30, { align: 'center' })
    
    pdf.setFontSize(10)
    let y = 45
    
    pdf.text(`Verein: ${association.name || association.vereinsNummer}`, 20, y)
    y += 7
    pdf.text(`Wahldatum: ${formatDate(election.electionDate)}`, 20, y)
    y += 7
    pdf.text(`Ausgewertet am: ${formatDate(result.evaluatedAt)}`, 20, y)
    y += 15
    
    pdf.setFontSize(12)
    pdf.text(`Berechtigte Wähler: ${result.totalVoters}`, 20, y)
    y += 15
    
    result.questions.forEach((questionResult, qIndex) => {
      if (y > 250) {
        pdf.addPage()
        y = 20
      }
      
      pdf.setFontSize(14)
      pdf.text(`Frage ${qIndex + 1}:`, 20, y)
      y += 7
      pdf.setFontSize(10)
      pdf.text(questionResult.question, 20, y)
      y += 10
      
      pdf.setFontSize(11)
      pdf.text(`Stimmen: ${questionResult.totalVotes} (davon ungültig: ${questionResult.invalidVotes})`, 20, y)
      y += 10
      
      pdf.setFontSize(10)
      questionResult.options.forEach((option, index) => {
        const validVotes = questionResult.totalVotes - questionResult.invalidVotes
        const percentage = validVotes > 0 ? option.percentage.toFixed(1) : '0'
        pdf.text(`${index + 1}. ${option.text}`, 25, y)
        y += 6
        pdf.text(`   ${option.votes} Stimmen (${percentage}%)`, 25, y)
        y += 8
      })
      
      y += 10
    })
    
    y += 10
    pdf.setFontSize(8)
    pdf.setTextColor(128, 128, 128)
    pdf.text('Dieses Dokument wurde automatisch generiert.', 20, y)
    y += 5
    pdf.text('Die Abstimmung wurde anonym durchgeführt - individuelle Stimmen sind nicht rückverfolgbar.', 20, y)
    y += 5
    pdf.text('Nach dem Export wurden alle Abstimmungsdaten unwiderruflich gelöscht.', 20, y)
    
    pdf.save(`wahlergebnis-${election.title.replace(/\s+/g, '-').toLowerCase()}.pdf`)

    toast({
      title: "PDF exportiert",
      description: "Das Wahlergebnis wurde als PDF gespeichert."
    })
  }

  const handleFinalizeAndDelete = async () => {
    if (!election) return
    setEvaluating(true)

    try {
      await handleExportPdf()

      const questionsRef = collection(db, 'electionQuestions')
      const questionsQ = query(questionsRef, where('electionId', '==', electionId))
      const questionsSnap = await getDocs(questionsQ)
      const deleteQuestionsPromises = questionsSnap.docs.map(d => deleteDoc(d.ref))
      await Promise.all(deleteQuestionsPromises)

      const votesRef = collection(db, 'votes')
      const votesQ = query(votesRef, where('electionId', '==', electionId))
      const votesSnap = await getDocs(votesQ)
      const deleteVotesPromises = votesSnap.docs.map(d => deleteDoc(d.ref))
      await Promise.all(deleteVotesPromises)

      const codesRef = collection(db, 'voterCodes')
      const codesQ = query(codesRef, where('electionId', '==', electionId))
      const codesSnap = await getDocs(codesQ)
      const deleteCodesPromises = codesSnap.docs.map(d => deleteDoc(d.ref))
      await Promise.all(deleteCodesPromises)

      await updateDoc(doc(db, 'elections', electionId), {
        status: 'evaluated',
        updatedAt: Timestamp.now()
      })

      toast({
        title: "Auswertung abgeschlossen",
        description: "Das Ergebnis wurde exportiert und alle Abstimmungsdaten wurden gelöscht."
      })

      router.push('/admin')
    } catch (error) {
      console.error('Error finalizing:', error)
      toast({
        title: "Fehler",
        description: "Die Auswertung konnte nicht abgeschlossen werden.",
        variant: "destructive"
      })
    } finally {
      setEvaluating(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!election || !result) return null

  const totalVotesAcrossQuestions = result.questions.reduce((sum, q) => sum + q.totalVotes, 0)
  const totalInvalidVotesAcrossQuestions = result.questions.reduce((sum, q) => sum + q.invalidVotes, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push(`/admin/wahl/${electionId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPdf}>
              <Download className="h-4 w-4 mr-2" />
              PDF exportieren
            </Button>
            {election.status !== 'evaluated' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={evaluating}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Auswerten & Daten löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auswertung abschließen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Das Ergebnis wird als PDF exportiert. Danach werden alle 
                      Abstimmungsdaten (Codes und Stimmen) unwiderruflich gelöscht. 
                      Dies entspricht den Datenschutzanforderungen für anonyme Wahlen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFinalizeAndDelete}>
                      Auswerten & Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Wahlergebnis</h1>
          <p className="text-slate-600">{election.title}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-slate-400" />
                <div>
                  <div className="text-2xl font-bold">{result.totalVoters}</div>
                  <div className="text-sm text-slate-500">Berechtigte Wähler</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-slate-400" />
                <div>
                  <div className="text-2xl font-bold">{totalVotesAcrossQuestions}</div>
                  <div className="text-sm text-slate-500">Stimmen gesamt</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-slate-400" />
                <div>
                  <div className="text-2xl font-bold">{totalInvalidVotesAcrossQuestions}</div>
                  <div className="text-sm text-slate-500">Ungültige Stimmen</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {result.questions.map((questionResult, qIndex) => (
          <Card key={questionResult.questionId} className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
                  Frage {qIndex + 1}
                </span>
              </div>
              <CardTitle className="text-lg">{questionResult.question}</CardTitle>
              <CardDescription>
                {questionResult.totalVotes} Stimmen ({questionResult.totalVotes - questionResult.invalidVotes} gültig, {questionResult.invalidVotes} ungültig)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {questionResult.options.map((option, index) => {
                const validVotes = questionResult.totalVotes - questionResult.invalidVotes
                const percentage = validVotes > 0 ? option.percentage : 0
                const isWinner = index === 0 && option.votes > 0

                return (
                  <div key={option.optionId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isWinner && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                        <span className={`font-medium ${isWinner ? 'text-green-700' : ''}`}>
                          {option.text}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{option.votes}</span>
                        <span className="text-slate-500 ml-2">({percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <Progress value={percentage} className={isWinner ? 'bg-green-100' : ''} />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}

        {election.status === 'evaluated' && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <p className="text-blue-800">
                <strong>Diese Wahl wurde bereits ausgewertet.</strong> Alle Abstimmungsdaten 
                wurden gemäß den Datenschutzbestimmungen gelöscht. Es verbleiben nur die 
                aggregierten Ergebnisse.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
