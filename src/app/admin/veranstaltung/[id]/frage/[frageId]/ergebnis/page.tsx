"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, BarChart3, Users, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Event, EventQuestion, Vote, QuestionOption } from '@/types'

export default function QuestionResultPage({ params }: { params: { id: string, frageId: string } }) {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [event, setEvent] = useState<Event | null>(null)
  const [question, setQuestion] = useState<EventQuestion | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (association && params.id && params.frageId) {
      loadData()
    }
  }, [association, params.id, params.frageId])

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

      // Load question
      const questionRef = doc(db, 'eventQuestions', params.frageId)
      const questionDoc = await getDoc(questionRef)
      
      if (questionDoc.exists()) {
        const questionData = questionDoc.data()
        setQuestion({
          id: questionDoc.id,
          eventId: questionData.eventId,
          question: questionData.question,
          options: questionData.options,
          allowInvalidVotes: questionData.allowInvalidVotes,
          status: questionData.status,
          createdAt: questionData.createdAt?.toDate() || new Date(),
          updatedAt: questionData.updatedAt?.toDate() || new Date()
        })
      }

      // Load votes for this question
      const votesRef = collection(db, 'votes')
      const votesQuery = query(votesRef, where('questionId', '==', params.frageId))
      const votesSnapshot = await getDocs(votesQuery)
      
      const loadedVotes: Vote[] = []
      votesSnapshot.forEach((doc) => {
        const data = doc.data()
        loadedVotes.push({
          id: doc.id,
          questionId: data.questionId,
          voterCode: data.voterCode,
          selectedOption: data.selectedOption,
          isValid: data.isValid,
          timestamp: data.timestamp?.toDate() || new Date()
        })
      })
      
      setVotes(loadedVotes)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateResults = () => {
    if (!question) return []

    const results = question.options.map((option, index) => {
      const optionVotes = votes.filter(vote => vote.selectedOption === index)
      return {
        optionId: index,
        text: option.text,
        votes: optionVotes.length,
        percentage: votes.length > 0 ? Math.round((optionVotes.length / votes.length) * 100) : 0
      }
    })

    return results.sort((a, b) => b.votes - a.votes)
  }

  const getInvalidVotesCount = () => {
    return votes.filter(vote => !vote.isValid).length
  }

  const getValidVotesCount = () => {
    return votes.filter(vote => vote.isValid).length
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!isAuthenticated || !event || !question) {
    return null
  }

  const results = calculateResults()
  const totalVotes = votes.length
  const validVotes = getValidVotesCount()
  const invalidVotes = getInvalidVotesCount()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <span className="font-semibold text-slate-800">Frage-Ergebnisse</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Event and Question Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{event.title}</CardTitle>
              <CardDescription>{question.question}</CardDescription>
            </CardHeader>
          </Card>

          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{event.maxVoters}</div>
                <p className="text-xs text-slate-600">Max. Teilnehmer</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{validVotes}</div>
                <p className="text-xs text-slate-600">Gültige Stimmen</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-amber-600">{invalidVotes}</div>
                <p className="text-xs text-slate-600">Ungültige Stimmen</p>
              </CardContent>
            </Card>
          </div>

          {/* Participation Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Beteiligung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Wahlbeteiligung</span>
                  <span className="font-medium">
                    {event.maxVoters > 0 
                      ? Math.round((validVotes / event.maxVoters) * 100) 
                      : 0}%
                  </span>
                </div>
                <Progress 
                  value={event.maxVoters > 0 
                    ? (validVotes / event.maxVoters) * 100 
                    : 0} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Results by Option */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ergebnisse nach Optionen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={result.optionId} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {index === 0 && result.votes > 0 && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                        <span className="font-medium">{result.text}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{result.votes} Stimmen</span>
                        <span className="text-sm text-slate-500 ml-2">({result.percentage}%)</span>
                      </div>
                    </div>
                    <Progress value={result.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Invalid Votes */}
          {invalidVotes > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-amber-600">Ungültige Stimmen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600">Ungültige Stimmen</span>
                    <span className="font-medium text-amber-600">
                      {invalidVotes} ({totalVotes > 0 ? Math.round((invalidVotes / totalVotes) * 100) : 0}%)
                    </span>
                  </div>
                  <Progress value={totalVotes > 0 ? (invalidVotes / totalVotes) * 100 : 0} className="h-2 bg-amber-100" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Winner Information */}
          {results.length > 0 && validVotes > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">Gewinner</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-700">
                  {results
                    .filter(r => r.votes > 0)
                    .sort((a, b) => b.votes - a.votes)[0]?.text || 'Keine gültigen Stimmen'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* No Votes Yet */}
          {totalVotes === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">Noch keine Stimmen</h3>
                <p className="text-slate-500">Für diese Frage wurden noch keine Stimmen abgegeben.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
