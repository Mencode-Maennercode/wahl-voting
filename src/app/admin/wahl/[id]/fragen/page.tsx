"use client"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, Timestamp, orderBy } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Plus, Trash2, Edit, CheckCircle2, XCircle, GripVertical, Power } from 'lucide-react'
import type { Election, ElectionQuestion, ElectionOption } from '@/types'

export default function QuestionsPage() {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const electionId = params.id as string

  const [election, setElection] = useState<Election | null>(null)
  const [questions, setQuestions] = useState<ElectionQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewQuestion, setShowNewQuestion] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<ElectionQuestion | null>(null)

  const [newQuestion, setNewQuestion] = useState({
    question: '',
    options: [{ id: '1', text: '', order: 0 }, { id: '2', text: '', order: 1 }],
    allowInvalidVotes: true
  })

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

        const questionsRef = collection(db, 'electionQuestions')
        const q = query(questionsRef, where('electionId', '==', electionId), orderBy('order', 'asc'))
        const questionsSnap = await getDocs(q)
        
        const loadedQuestions: ElectionQuestion[] = []
        questionsSnap.forEach((doc) => {
          const qData = doc.data()
          loadedQuestions.push({
            id: doc.id,
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

        setQuestions(loadedQuestions)
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

  const handleCreateQuestion = async () => {
    if (!election) return
    
    if (!newQuestion.question || newQuestion.options.some(o => !o.text)) {
      toast({
        title: "Felder ausfüllen",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      })
      return
    }

    try {
      const questionData = {
        electionId: electionId,
        question: newQuestion.question,
        options: newQuestion.options.map((o, i) => ({ ...o, order: i })),
        allowInvalidVotes: newQuestion.allowInvalidVotes,
        isActive: false,
        order: questions.length,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }

      await addDoc(collection(db, 'electionQuestions'), questionData)
      
      toast({
        title: "Wahlfrage erstellt",
        description: "Die Wahlfrage wurde erfolgreich erstellt."
      })
      
      setShowNewQuestion(false)
      setNewQuestion({
        question: '',
        options: [{ id: '1', text: '', order: 0 }, { id: '2', text: '', order: 1 }],
        allowInvalidVotes: true
      })
      loadData()
    } catch (error) {
      console.error('Error creating question:', error)
      toast({
        title: "Fehler",
        description: "Die Wahlfrage konnte nicht erstellt werden.",
        variant: "destructive"
      })
    }
  }

  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return
    
    if (!newQuestion.question || newQuestion.options.some(o => !o.text)) {
      toast({
        title: "Felder ausfüllen",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      })
      return
    }

    try {
      const questionRef = doc(db, 'electionQuestions', editingQuestion.id)
      await updateDoc(questionRef, {
        question: newQuestion.question,
        options: newQuestion.options.map((o, i) => ({ ...o, order: i })),
        allowInvalidVotes: newQuestion.allowInvalidVotes,
        updatedAt: Timestamp.now()
      })
      
      toast({
        title: "Wahlfrage aktualisiert",
        description: "Die Wahlfrage wurde erfolgreich aktualisiert."
      })
      
      setEditingQuestion(null)
      setNewQuestion({
        question: '',
        options: [{ id: '1', text: '', order: 0 }, { id: '2', text: '', order: 1 }],
        allowInvalidVotes: true
      })
      loadData()
    } catch (error) {
      console.error('Error updating question:', error)
      toast({
        title: "Fehler",
        description: "Die Wahlfrage konnte nicht aktualisiert werden.",
        variant: "destructive"
      })
    }
  }

  const toggleQuestionActive = async (question: ElectionQuestion) => {
    try {
      const questionRef = doc(db, 'electionQuestions', question.id)
      await updateDoc(questionRef, {
        isActive: !question.isActive,
        updatedAt: Timestamp.now()
      })
      
      toast({
        title: question.isActive ? "Wahlfrage deaktiviert" : "Wahlfrage aktiviert",
        description: question.isActive 
          ? "Die Wahlfrage ist nun für Wähler nicht mehr sichtbar." 
          : "Die Wahlfrage ist nun für Wähler sichtbar."
      })
      
      loadData()
    } catch (error) {
      console.error('Error toggling question:', error)
      toast({
        title: "Fehler",
        description: "Der Status konnte nicht geändert werden.",
        variant: "destructive"
      })
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Möchten Sie diese Wahlfrage wirklich löschen? Alle zugehörigen Stimmen werden ebenfalls gelöscht.')) {
      return
    }

    try {
      const votesRef = collection(db, 'votes')
      const votesQuery = query(votesRef, where('questionId', '==', questionId))
      const votesSnap = await getDocs(votesQuery)
      
      for (const voteDoc of votesSnap.docs) {
        await deleteDoc(doc(db, 'votes', voteDoc.id))
      }

      await deleteDoc(doc(db, 'electionQuestions', questionId))
      
      toast({
        title: "Wahlfrage gelöscht",
        description: "Die Wahlfrage wurde erfolgreich gelöscht."
      })
      
      loadData()
    } catch (error) {
      console.error('Error deleting question:', error)
      toast({
        title: "Fehler",
        description: "Die Wahlfrage konnte nicht gelöscht werden.",
        variant: "destructive"
      })
    }
  }

  const startEdit = (question: ElectionQuestion) => {
    setEditingQuestion(question)
    setNewQuestion({
      question: question.question,
      options: question.options,
      allowInvalidVotes: question.allowInvalidVotes
    })
  }

  const addOption = () => {
    const newId = (newQuestion.options.length + 1).toString()
    setNewQuestion({
      ...newQuestion,
      options: [...newQuestion.options, { id: newId, text: '', order: newQuestion.options.length }]
    })
  }

  const removeOption = (index: number) => {
    if (newQuestion.options.length <= 2) return
    const updated = newQuestion.options.filter((_, i) => i !== index)
    setNewQuestion({ ...newQuestion, options: updated })
  }

  const updateOption = (index: number, text: string) => {
    const updated = [...newQuestion.options]
    updated[index].text = text
    setNewQuestion({ ...newQuestion, options: updated })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!election) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.push(`/admin/wahl/${electionId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Wahl
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">{election.title}</h1>
          <p className="text-slate-600">Wahlfragen verwalten</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Wahlfragen ({questions.length})</h2>
            <p className="text-sm text-slate-600">Erstellen und verwalten Sie mehrere Wahlfragen für diese Veranstaltung</p>
          </div>
          <Dialog open={showNewQuestion || editingQuestion !== null} onOpenChange={(open) => {
            if (!open) {
              setShowNewQuestion(false)
              setEditingQuestion(null)
              setNewQuestion({
                question: '',
                options: [{ id: '1', text: '', order: 0 }, { id: '2', text: '', order: 1 }],
                allowInvalidVotes: true
              })
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setShowNewQuestion(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Neue Wahlfrage
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQuestion ? 'Wahlfrage bearbeiten' : 'Neue Wahlfrage erstellen'}</DialogTitle>
                <DialogDescription>
                  Definieren Sie die Wahlfrage und die möglichen Antworten.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="question">Wahlfrage *</Label>
                  <Input
                    id="question"
                    placeholder="z.B. Wen wählen Sie zum neuen Vorsitzenden?"
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Antwortmöglichkeiten *</Label>
                  {newQuestion.options.map((option, index) => (
                    <div key={option.id} className="flex gap-2">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option.text}
                        onChange={(e) => updateOption(index, e.target.value)}
                      />
                      {newQuestion.options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4 text-slate-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Option hinzufügen
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="allowInvalid">Ungültige Stimmen erlauben</Label>
                    <p className="text-sm text-slate-500">Teilnehmer können ohne Auswahl abstimmen</p>
                  </div>
                  <Switch
                    id="allowInvalid"
                    checked={newQuestion.allowInvalidVotes}
                    onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, allowInvalidVotes: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowNewQuestion(false)
                  setEditingQuestion(null)
                  setNewQuestion({
                    question: '',
                    options: [{ id: '1', text: '', order: 0 }, { id: '2', text: '', order: 1 }],
                    allowInvalidVotes: true
                  })
                }}>
                  Abbrechen
                </Button>
                <Button onClick={editingQuestion ? handleUpdateQuestion : handleCreateQuestion}>
                  {editingQuestion ? 'Aktualisieren' : 'Erstellen'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {questions.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">Keine Wahlfragen vorhanden</h3>
              <p className="text-slate-500 mb-4">Erstellen Sie die erste Wahlfrage für diese Veranstaltung.</p>
              <Button onClick={() => setShowNewQuestion(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Wahlfrage erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {questions.map((question, index) => (
              <Card key={question.id} className={`${question.isActive ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        <GripVertical className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">Frage {index + 1}</CardTitle>
                          {question.isActive ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Aktiv
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              Inaktiv
                            </span>
                          )}
                        </div>
                        <CardDescription className="text-sm">{question.question}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-2">Antwortmöglichkeiten:</p>
                      <div className="space-y-1">
                        {question.options.map((option, idx) => (
                          <div key={option.id} className="text-sm text-slate-700 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-medium">
                              {idx + 1}
                            </span>
                            {option.text}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleQuestionActive(question)}
                        className={question.isActive ? 'border-amber-600 text-amber-600 hover:bg-amber-50' : 'border-green-600 text-green-600 hover:bg-green-50'}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        {question.isActive ? 'Deaktivieren' : 'Aktivieren'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(question)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Löschen
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {election.status === 'active' && (
          <Card className="mt-6 bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">Wahl ist aktiv</h3>
                  <p className="text-sm text-blue-700">
                    Sie können während der laufenden Veranstaltung neue Wahlfragen hinzufügen und bestehende Fragen aktivieren/deaktivieren. 
                    Wähler sehen nur aktivierte Fragen und werden über neue Fragen automatisch informiert.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
