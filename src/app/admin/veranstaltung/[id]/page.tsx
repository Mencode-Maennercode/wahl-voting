"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Settings, Users, Calendar, Clock, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react'
import type { Event, EventQuestion } from '@/types'
import { generateUniqueCode } from '@/lib/utils'

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [event, setEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<EventQuestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (association && params.id) {
      loadEvent()
      loadQuestions()
    }
  }, [association, params.id])

  const loadEvent = async () => {
    if (!association) return

    try {
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
    } catch (error) {
      console.error('Error loading event:', error)
    }
  }

  const loadQuestions = async () => {
    if (!association) return

    try {
      const questionsRef = collection(db, 'eventQuestions')
      const q = query(questionsRef, where('eventId', '==', params.id))
      const querySnapshot = await getDocs(q)
      
      const loadedQuestions: EventQuestion[] = []
      querySnapshot.forEach((doc) => {
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
      
      setQuestions(loadedQuestions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()))
    } catch (error) {
      console.error('Error loading questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700',
      active: 'bg-green-100 text-green-700',
      closed: 'bg-amber-100 text-amber-700',
      evaluated: 'bg-blue-100 text-blue-700'
    }
    const labels: Record<string, string> = {
      draft: 'Entwurf',
      active: 'Aktiv',
      closed: 'Geschlossen',
      evaluated: 'Ausgewertet'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    )
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date)
  }

  const formatTime = (time: string) => {
    return time
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
            <span className="font-semibold text-slate-800">Veranstaltungsdetails</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Removed Ergebnisse button from header */}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Event Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">{event.title}</CardTitle>
                  <CardDescription className="text-base">{event.description}</CardDescription>
                </div>
                {getStatusBadge(event.status)}
              </div>
            </CardHeader>
          </Card>

          {/* Event Details */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Zeitplan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Startdatum:</span>
                    <span className="font-medium">{formatDate(event.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Startzeit:</span>
                    <span className="font-medium">{formatTime(event.startTime)}</span>
                  </div>
                  {event.endDate && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Enddatum:</span>
                        <span className="font-medium">{formatDate(event.endDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Endzeit:</span>
                        <span className="font-medium">{formatTime(event.endTime || '')}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Teilnehmer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Max. Teilnehmer:</span>
                    <span className="font-medium">{event.maxVoters}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Anzahl Fragen:</span>
                    <span className="font-medium">{questions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Status:</span>
                    <span>{getStatusBadge(event.status)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Questions Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wahlfragen</CardTitle>
              <CardDescription>
                Übersicht aller Wahlfragen dieser Veranstaltung
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700 mb-2">Keine Fragen vorhanden</h3>
                  <p className="text-slate-500 mb-4">Erstellen Sie Wahlfragen für diese Veranstaltung.</p>
                  {event.status === 'draft' && (
                    <Button onClick={() => router.push(`/admin/veranstaltung/${event.id}/fragen`)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Fragen erstellen
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-slate-600">Frage {index + 1}:</span>
                            {getStatusBadge(question.status)}
                          </div>
                          <h4 className="font-medium text-slate-800">{question.question}</h4>
                        </div>
                      </div>
                      
                      <div className="text-sm text-slate-600 mb-3">
                        {question.options.length} Antwortoptionen
                        {question.allowInvalidVotes && ' • Ungültige Antworten erlaubt'}
                      </div>

                      {question.status === 'active' && (
                        <div className="flex items-center gap-2 text-sm p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg mb-3">
                          <Clock className="h-4 w-4" />
                          <span>Frage ist aktiv - Wähler können abstimmen</span>
                        </div>
                      )}
                      
                      {question.status === 'closed' && (
                        <div className="flex items-center gap-2 text-sm p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg mb-3">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Frage geschlossen - Keine weiteren Stimmen möglich</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {question.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/admin/veranstaltung/${event.id}/fragen`)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </Button>
                        )}
                        
                        {question.status === 'closed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/admin/veranstaltung/${event.id}/frage/${question.id}/ergebnis`)}
                          >
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Ergebnis
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Messages */}
          {event.status === 'draft' && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-800">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Veranstaltung im Entwurfsstatus</span>
                </div>
                <p className="text-blue-700 mt-2">
                  Die Veranstaltung ist noch nicht gestartet. Sie können noch Fragen bearbeiten und Einstellungen anpassen.
                </p>
              </CardContent>
            </Card>
          )}

          {event.status === 'active' && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Veranstaltung aktiv</span>
                </div>
                <p className="text-green-700 mt-2">
                  Die Veranstaltung läuft und Wähler können an den aktiven Fragen teilnehmen.
                </p>
              </CardContent>
            </Card>
          )}

          {event.status === 'closed' && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Veranstaltung geschlossen</span>
                </div>
                <p className="text-amber-700 mt-2">
                  Die Veranstaltung wurde beendet. Keine weiteren Stimmen mehr möglich. Ergebnisse können eingesehen werden.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
