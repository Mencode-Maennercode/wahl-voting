"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Download, FileSpreadsheet, FileText, FileImage, BarChart3, Users, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Event, EventQuestion, Vote, QuestionOption } from '@/types'

export default function EventResultsPage({ params }: { params: { id: string } }) {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [event, setEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<EventQuestion[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  const [stats, setStats] = useState({
    totalVotes: 0,
    validVotes: 0,
    invalidVotes: 0,
    uniqueVoters: 0,
    participationRate: 0
  })

  useEffect(() => {
    if (association && params.id) {
      loadData()
    }
  }, [association, params.id])

  useEffect(() => {
    if (event && votes.length > 0) {
      calculateStatistics()
    }
  }, [event, votes])

  const calculateStatistics = async () => {
    const statistics = await getEventStatistics()
    setStats(statistics)
  }

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
          invitationText: eventData.invitationText,
          showLinkWithCode: eventData.showLinkWithCode,
          status: eventData.status,
          createdAt: eventData.createdAt?.toDate() || new Date(),
          updatedAt: eventData.updatedAt?.toDate() || new Date()
        })
      }

      // Load questions
      const questionsRef = collection(db, 'eventQuestions')
      const questionsQuery = query(questionsRef, where('eventId', '==', params.id))
      const questionsSnapshot = await getDocs(questionsQuery)
      
      const loadedQuestions: EventQuestion[] = []
      questionsSnapshot.forEach((doc) => {
        const data = doc.data()
        loadedQuestions.push({
          id: doc.id,
          eventId: data.eventId,
          question: data.question,
          options: data.options,
          allowInvalidVotes: data.allowInvalidVotes,
          status: data.status,
          order: data.order || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        })
      })
      
      setQuestions(loadedQuestions.sort((a, b) => a.order - b.order))

      // Load all votes for this event (aggregated only)
      const votesRef = collection(db, 'votes')
      const votesQuery = query(votesRef, where('eventId', '==', params.id))
      const votesSnapshot = await getDocs(votesQuery)
      
      const loadedVotes: Vote[] = []
      votesSnapshot.forEach((doc) => {
        const data = doc.data()
        // Load votes without individual identifiers
        loadedVotes.push({
          id: doc.id,
          eventId: data.eventId,
          questionId: data.questionId,
          optionId: data.optionId,
          isInvalid: data.isInvalid,
          votedAt: data.votedAt?.toDate() || new Date()
        })
      })
      
      setVotes(loadedVotes)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateQuestionResults = (questionId: string) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return []

    const questionVotes = votes.filter(vote => vote.questionId === questionId)
    const results = question.options.map((option, index) => {
      const optionVotes = questionVotes.filter(vote => vote.optionId === option.id)
      return {
        optionId: option.id,
        text: option.text,
        votes: optionVotes.length,
        percentage: questionVotes.length > 0 ? Math.round((optionVotes.length / questionVotes.length) * 100) : 0
      }
    })

    return results.sort((a, b) => b.votes - a.votes)
  }

  const getEventStatistics = async () => {
    const totalVotes = votes.length
    const validVotes = votes.filter(vote => !vote.isInvalid).length
    const invalidVotes = votes.filter(vote => vote.isInvalid).length
    
    // Count unique voters by checking VoterCode collection separately
    const voterCodesRef = collection(db, 'voterCodes')
    const voterCodesQuery = query(voterCodesRef, where('eventId', '==', params.id))
    const voterCodesSnapshot = await getDocs(voterCodesQuery)
    const uniqueVoters = voterCodesSnapshot.size
    
    const participationRate = event ? Math.round((uniqueVoters / event.maxVoters) * 100) : 0

    return {
      totalVotes,
      validVotes,
      invalidVotes,
      uniqueVoters,
      participationRate
    }
  }

  const exportToCSV = () => {
    if (!event || questions.length === 0) return

    setExporting(true)
    
    try {
      let csvContent = '\ufeff' // UTF-8 BOM for Excel compatibility
      
      // Header
      csvContent += 'VERANSTALTUNGSERGEBNISSE\n'
      csvContent += `Titel:;${event.title}\n`
      csvContent += `Beschreibung:;${event.description}\n`
      csvContent += `Datum:;${event.startDate.toLocaleDateString('de-DE')}\n`
      csvContent += `Uhrzeit:;${event.startTime}\n`
      csvContent += `Max. Teilnehmer:;${event.maxVoters}\n`
      csvContent += `Teilgenommen:;${stats.uniqueVoters}\n`
      csvContent += `Beteiligung:;${stats.participationRate}%\n\n`

      // Statistics
      csvContent += 'GESAMTSTATISTIK\n'
      csvContent += 'Kennzahl;Wert\n'
      csvContent += `Gesamte Stimmen;${stats.totalVotes}\n`
      csvContent += `Gültige Stimmen;${stats.validVotes}\n`
      csvContent += `Ungültige Stimmen;${stats.invalidVotes}\n`
      csvContent += `Eindeutige Wähler;${stats.uniqueVoters}\n`
      csvContent += `Beteiligungsquote;${stats.participationRate}%\n\n`

      // Questions and Results
      questions.forEach((question, qIndex) => {
        const results = calculateQuestionResults(question.id)
        const questionVotes = votes.filter(vote => vote.questionId === question.id)
        
        csvContent += `FRAGE ${qIndex + 1}\n`
        csvContent += `Frage:;${question.question}\n`
        csvContent += `Stimmen insgesamt:;${questionVotes.length}\n`
        csvContent += `Ungültige Stimmen erlaubt:;${question.allowInvalidVotes ? 'Ja' : 'Nein'}\n\n`
        
        csvContent += 'ERGEBNISSE\n'
        csvContent += 'Position;Option;Stimmen;Prozent\n'
        
        results.forEach((result, index) => {
          csvContent += `${index + 1};${result.text};${result.votes};${result.percentage}%\n`
        })
        
        csvContent += '\n'
      })

      // NO INDIVIDUAL VOTES - Privacy protection
      csvContent += '# Datenschutz: Individuelle Stimmen werden nicht exportiert\n'
      csvContent += '# Nur aggregierte Ergebnisse werden angezeigt\n'

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ergebnisse-${event.title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
    } finally {
      setExporting(false)
    }
  }

  const exportToPDF = () => {
    if (!event || questions.length === 0) return

    setExporting(true)
    
    try {
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Ergebnisse - ${event.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            h1 { color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            h2 { color: #475569; margin-top: 30px; }
            .header-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
            .stat-card { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; }
            .stat-number { font-size: 24px; font-weight: bold; color: #3b82f6; }
            .stat-label { font-size: 12px; color: #64748b; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { background: #f8fafc; font-weight: bold; }
            .winner { background: #dcfce7; font-weight: bold; }
            .progress-bar { width: 100%; height: 20px; background: #e2e8f0; border-radius: 10px; overflow: hidden; }
            .progress-fill { height: 100%; background: #3b82f6; }
            @media print { body { margin: 10px; } }
          </style>
        </head>
        <body>
          <h1>VERANSTALTUNGSERGEBNISSE</h1>
          
          <div class="header-info">
            <h2>${event.title}</h2>
            <p><strong>Beschreibung:</strong> ${event.description}</p>
            <p><strong>Datum:</strong> ${event.startDate.toLocaleDateString('de-DE')} um ${event.startTime}</p>
            <p><strong>Max. Teilnehmer:</strong> ${event.maxVoters}</p>
            <p><strong>Teilgenommen:</strong> ${stats.uniqueVoters}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${stats.uniqueVoters}</div>
              <div class="stat-label">Teilnehmer</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${stats.participationRate}%</div>
              <div class="stat-label">Beteiligung</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${stats.validVotes}</div>
              <div class="stat-label">Gültige Stimmen</div>
            </div>
          </div>

          <h2>GESAMTSTATISTIK</h2>
          <table>
            <tr>
              <th>Kennzahl</th>
              <th>Wert</th>
            </tr>
            <tr>
              <td>Gesamte Stimmen</td>
              <td>${stats.totalVotes}</td>
            </tr>
            <tr>
              <td>Gültige Stimmen</td>
              <td>${stats.validVotes}</td>
            </tr>
            <tr>
              <td>Ungültige Stimmen</td>
              <td>${stats.invalidVotes}</td>
            </tr>
            <tr>
              <td>Eindeutige Wähler</td>
              <td>${stats.uniqueVoters}</td>
            </tr>
            <tr>
              <td>Beteiligungsquote</td>
              <td>${stats.participationRate}%</td>
            </tr>
          </table>
      `

      questions.forEach((question, qIndex) => {
        const results = calculateQuestionResults(question.id)
        const questionVotes = votes.filter(vote => vote.questionId === question.id)
        
        htmlContent += `
          <h2>FRAGE ${qIndex + 1}</h2>
          <p><strong>Frage:</strong> ${question.question}</p>
          <p><strong>Stimmen insgesamt:</strong> ${questionVotes.length}</p>
          <p><strong>Ungültige Stimmen erlaubt:</strong> ${question.allowInvalidVotes ? 'Ja' : 'Nein'}</p>
          
          <table>
            <tr>
              <th>Position</th>
              <th>Option</th>
              <th>Stimmen</th>
              <th>Prozent</th>
              <th>Visualisierung</th>
            </tr>
        `
        
        results.forEach((result, index) => {
          htmlContent += `
            <tr class="${index === 0 && result.votes > 0 ? 'winner' : ''}">
              <td>${index + 1}</td>
              <td>${result.text}</td>
              <td>${result.votes}</td>
              <td>${result.percentage}%</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${result.percentage}%"></div>
                </div>
              </td>
            </tr>
          `
        })
        
        htmlContent += '</table>'
      })

      htmlContent += `
        </body>
        </html>
      `

      // Create and download PDF
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(htmlContent)
        printWindow.document.close()
        printWindow.print()
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
    } finally {
      setExporting(false)
    }
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <span className="font-semibold text-slate-800">Ergebnisse exportieren</span>
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
                Wählen Sie das Export-Format für die vollständigen Ergebnisse
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Statistics Overview */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{stats.uniqueVoters}</div>
                <p className="text-xs text-slate-600">Teilnehmer</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{stats.validVotes}</div>
                <p className="text-xs text-slate-600">Gültige Stimmen</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-amber-600">{stats.invalidVotes}</div>
                <p className="text-xs text-slate-600">Ungültige Stimmen</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-purple-600">{stats.participationRate}%</div>
                <p className="text-xs text-slate-600">Beteiligung</p>
              </CardContent>
            </Card>
          </div>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export-Format wählen</CardTitle>
              <CardDescription>
                Wählen Sie das gewünschte Format für den Download der Ergebnisse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportToCSV}>
                  <CardContent className="pt-6 text-center">
                    <FileSpreadsheet className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">CSV/Excel</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Ideal für Excel und Datenanalyse. Kompatibel mit Tabellenkalkulationen.
                    </p>
                    <Button disabled={exporting} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      CSV herunterladen
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportToPDF}>
                  <CardContent className="pt-6 text-center">
                    <FileImage className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">PDF</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Druckfertiges Dokument für Präsentationen und Archivierung.
                    </p>
                    <Button disabled={exporting} variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      PDF herunterladen
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Questions Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fragen-Übersicht</CardTitle>
              <CardDescription>
                Vorschau der enthaltenen Fragen und Ergebnisse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {questions.map((question, qIndex) => {
                  const results = calculateQuestionResults(question.id)
                  const questionVotes = votes.filter(vote => vote.questionId === question.id)
                  
                  return (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">Frage {qIndex + 1}: {question.question}</h4>
                          <p className="text-sm text-slate-600">{questionVotes.length} Stimmen</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {results.map((result, index) => (
                          <div key={result.optionId} className="flex items-center justify-between">
                            <span className="text-sm">{result.text}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{result.votes} ({result.percentage}%)</span>
                              <Progress value={result.percentage} className="w-20 h-2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Export Status */}
          {exporting && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-800">
                  <Download className="h-5 w-5 animate-pulse" />
                  <span className="font-medium">Export wird vorbereitet...</span>
                </div>
                <p className="text-blue-700 mt-2">
                  Die Ergebnisse werden aufbereitet und zum Download bereitgestellt.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
