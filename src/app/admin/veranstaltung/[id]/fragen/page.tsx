"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Plus, Trash2, Play, Square, Eye, Clock, AlertTriangle } from 'lucide-react'
import type { Event, EventQuestion, QuestionOption } from '@/types'

export default function EventQuestionsPage({ params }: { params: { id: string } }) {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [event, setEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<EventQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewQuestion, setShowNewQuestion] = useState(false)
  const [showEditQuestion, setShowEditQuestion] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<EventQuestion | null>(null)
  
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    allowInvalidVotes: false,
    options: [{ text: '', order: 0 }, { text: '', order: 1 }]
  })
  
  const [editQuestion, setEditQuestion] = useState({
    question: '',
    allowInvalidVotes: false,
    options: [{ text: '', order: 0 }, { text: '', order: 1 }]
  })

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
      const eventsRef = collection(db, 'events')
      const q = query(eventsRef, where('associationId', '==', association.id))
      const querySnapshot = await getDocs(q)
      
      const eventData = querySnapshot.docs.find(doc => doc.id === params.id)
      if (eventData) {
        setEvent({
          id: eventData.id,
          ...eventData.data()
        } as Event)
      }
    } catch (error) {
      console.error('Error loading event:', error)
      toast({
        title: "Fehler",
        description: "Veranstaltung konnte nicht geladen werden.",
        variant: "destructive"
      })
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
          ...data
        } as EventQuestion)
      })
      
      setQuestions(loadedQuestions.sort((a, b) => a.order - b.order))
    } catch (error) {
      console.error('Error loading questions:', error)
      toast({
        title: "Fehler",
        description: "Fragen konnten nicht geladen werden.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateQuestion = async () => {
    if (!association || !newQuestion.question) {
      toast({
        title: "Felder ausfüllen",
        description: "Bitte geben Sie eine Frage ein.",
        variant: "destructive"
      })
      return
    }

    const validOptions = newQuestion.options.filter(opt => opt.text.trim())
    if (validOptions.length < 2) {
      toast({
        title: "Optionen fehlen",
        description: "Bitte geben Sie mindestens zwei Antwortoptionen ein.",
        variant: "destructive"
      })
      return
    }

    try {
      const questionData = {
        eventId: params.id,
        question: newQuestion.question,
        options: validOptions.map((opt, index) => ({
          ...opt,
          order: index
        })),
        allowInvalidVotes: newQuestion.allowInvalidVotes,
        status: 'draft',
        order: questions.length,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }

      await addDoc(collection(db, 'eventQuestions'), questionData)
      
      toast({
        title: "Frage erstellt",
        description: "Die Wahlfrage wurde erfolgreich erstellt."
      })
      
      setShowNewQuestion(false)
      setNewQuestion({
        question: '',
        allowInvalidVotes: false,
        options: [{ text: '', order: 0 }, { text: '', order: 1 }]
      })
      
      loadQuestions()
    } catch (error) {
      console.error('Error creating question:', error)
      toast({
        title: "Fehler",
        description: "Die Frage konnte nicht erstellt werden.",
        variant: "destructive"
      })
    }
  }

  const startQuestion = async (questionId: string) => {
    try {
      const questionRef = doc(db, 'eventQuestions', questionId)
      await updateDoc(questionRef, {
        status: 'active',
        startedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      
      toast({
        title: "Frage gestartet",
        description: "Die Wahlfrage ist nun aktiv und kann beantwortet werden."
      })
      
      loadQuestions()
    } catch (error) {
      console.error('Error starting question:', error)
      toast({
        title: "Fehler",
        description: "Die Frage konnte nicht gestartet werden.",
        variant: "destructive"
      })
    }
  }

  const closeQuestion = async (questionId: string) => {
    try {
      const questionRef = doc(db, 'eventQuestions', questionId)
      await updateDoc(questionRef, {
        status: 'closed',
        closedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      
      toast({
        title: "Frage geschlossen",
        description: "Die Wahlfrage wurde geschlossen. Es können keine weiteren Stimmen abgegeben werden."
      })
      
      loadQuestions()
    } catch (error) {
      console.error('Error closing question:', error)
      toast({
        title: "Fehler",
        description: "Die Frage konnte nicht geschlossen werden.",
        variant: "destructive"
      })
    }
  }

  const deleteQuestion = async (questionId: string) => {
    try {
      await deleteDoc(doc(db, 'eventQuestions', questionId))
      
      toast({
        title: "Frage gelöscht",
        description: "Die Wahlfrage wurde erfolgreich gelöscht."
      })
      
      loadQuestions()
    } catch (error) {
      console.error('Error deleting question:', error)
      toast({
        title: "Fehler",
        description: "Die Frage konnte nicht gelöscht werden.",
        variant: "destructive"
      })
    }
  }

  const addOption = () => {
    const newOrder = newQuestion.options.length
    setNewQuestion({
      ...newQuestion,
      options: [...newQuestion.options, { text: '', order: newOrder }]
    })
  }

  const updateOption = (index: number, text: string) => {
    const updatedOptions = [...newQuestion.options]
    updatedOptions[index] = { ...updatedOptions[index], text }
    setNewQuestion({ ...newQuestion, options: updatedOptions })
  }

  const removeOption = (index: number) => {
    if (newQuestion.options.length > 2) {
      const updatedOptions = newQuestion.options.filter((_, i) => i !== index)
      setNewQuestion({ ...newQuestion, options: updatedOptions })
    }
  }

  const openEditDialog = (question: EventQuestion) => {
    setSelectedQuestion(question)
    setEditQuestion({
      question: question.question,
      allowInvalidVotes: question.allowInvalidVotes,
      options: [...question.options]
    })
    setShowEditQuestion(true)
  }

  const handleEditQuestion = async () => {
    if (!selectedQuestion) return

    try {
      const questionRef = doc(db, 'eventQuestions', selectedQuestion.id)
      await updateDoc(questionRef, {
        question: editQuestion.question,
        allowInvalidVotes: editQuestion.allowInvalidVotes,
        options: editQuestion.options,
        updatedAt: Timestamp.now()
      })
      
      toast({
        title: "Frage aktualisiert",
        description: "Die Wahlfrage wurde erfolgreich aktualisiert."
      })
      
      setShowEditQuestion(false)
      setSelectedQuestion(null)
      setEditQuestion({
        question: '',
        allowInvalidVotes: false,
        options: [{ text: '', order: 0 }, { text: '', order: 1 }]
      })
      
      loadQuestions()
    } catch (error) {
      console.error('Error updating question:', error)
      toast({
        title: "Fehler",
        description: "Die Frage konnte nicht aktualisiert werden.",
        variant: "destructive"
      })
    }
  }

  const addEditOption = () => {
    const newOrder = editQuestion.options.length
    setEditQuestion({
      ...editQuestion,
      options: [...editQuestion.options, { text: '', order: newOrder }]
    })
  }

  const updateEditOption = (index: number, text: string) => {
    const updatedOptions = [...editQuestion.options]
    updatedOptions[index] = { ...updatedOptions[index], text }
    setEditQuestion({ ...editQuestion, options: updatedOptions })
  }

  const removeEditOption = (index: number) => {
    if (editQuestion.options.length > 2) {
      const updatedOptions = editQuestion.options.filter((_, i) => i !== index)
      setEditQuestion({ ...editQuestion, options: updatedOptions })
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!isAuthenticated || !event) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Veranstaltungen
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">{event.title}</span>
            <span className="text-slate-500 text-sm">| Wahlfragen</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Wahlfragen verwalten</h1>
            <p className="text-slate-600">Erstellen und verwalten Sie die Wahlfragen für diese Veranstaltung</p>
          </div>
          <Dialog open={showNewQuestion} onOpenChange={setShowNewQuestion}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neue Frage erstellen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Neue Wahlfrage erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie eine neue Wahlfrage für die Veranstaltung.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="question">Frage *</Label>
                  <Textarea
                    id="question"
                    placeholder="z.B. Wer soll zum neuen Vorsitzenden gewählt werden?"
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Antwortoptionen *</Label>
                  {newQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 w-8">{index + 1}.</span>
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option.text}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="flex-1"
                      />
                      {newQuestion.options.length > 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Option hinzufügen
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="allowInvalidVotes">Ungültige Antworten zulassen</Label>
                    <p className="text-sm text-slate-500">Stimmen ohne gültige Auswahl als gültig zählen</p>
                  </div>
                  <Switch
                    id="allowInvalidVotes"
                    checked={newQuestion.allowInvalidVotes}
                    onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, allowInvalidVotes: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewQuestion(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleCreateQuestion}>
                  Frage erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Question Dialog */}
        <Dialog open={showEditQuestion} onOpenChange={setShowEditQuestion}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Wahlfrage bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die vorhandene Wahlfrage. Fragen können nur im Entwurfsstatus geändert werden.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editQuestion">Frage</Label>
                <Textarea
                  id="editQuestion"
                  placeholder="Geben Sie Ihre Wahlfrage ein..."
                  value={editQuestion.question}
                  onChange={(e) => setEditQuestion({ ...editQuestion, question: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Antwortoptionen</Label>
                <div className="space-y-2">
                  {editQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="font-medium text-sm w-8">{index + 1}.</span>
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option.text}
                        onChange={(e) => updateEditOption(index, e.target.value)}
                        className="flex-1"
                      />
                      {editQuestion.options.length > 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeEditOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEditOption}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Option hinzufügen
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="editAllowInvalidVotes">Ungültige Antworten zulassen</Label>
                    <p className="text-sm text-slate-500">Stimmen ohne gültige Auswahl als gültig zählen</p>
                  </div>
                  <Switch
                    id="editAllowInvalidVotes"
                    checked={editQuestion.allowInvalidVotes}
                    onCheckedChange={(checked) => setEditQuestion({ ...editQuestion, allowInvalidVotes: checked })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditQuestion(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleEditQuestion}>
                Frage speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-slate-500">Fragen werden geladen...</div>
          </div>
        ) : questions.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-slate-700 mb-2">Keine Wahlfragen vorhanden</h3>
              <p className="text-slate-500 mb-4">Erstellen Sie Ihre erste Wahlfrage, um loszulegen.</p>
              <Button onClick={() => setShowNewQuestion(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Frage erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
              <Card key={question.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{question.question}</CardTitle>
                        {getStatusBadge(question.status)}
                      </div>
                      <div className="text-sm text-slate-600">
                        {question.options.length} Antwortoptionen
                        {question.allowInvalidVotes && ' • Ungültige Antworten erlaubt'}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {question.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{index + 1}.</span>
                        <span>{option.text}</span>
                      </div>
                    ))}
                  </div>
                  
                  {question.status === 'active' && (
                    <div className="flex items-center gap-2 text-sm p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg mb-4">
                      <Clock className="h-4 w-4" />
                      <span>Frage ist aktiv - Wähler können abstimmen. Bearbeitung nicht mehr möglich.</span>
                    </div>
                  )}
                  
                  {question.status === 'closed' && (
                    <div className="flex items-center gap-2 text-sm p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Frage geschlossen - Keine weiteren Stimmen möglich. Bearbeitung nicht mehr möglich.</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {question.status === 'draft' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openEditDialog(question)}
                          variant="outline"
                        >
                          Bearbeiten
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => startQuestion(question.id)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Starten
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteQuestion(question.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Löschen
                        </Button>
                      </>
                    )}
                    
                    {question.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closeQuestion(question.id)}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Beenden
                      </Button>
                    )}
                    
                    {question.status === 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/admin/veranstaltung/${params.id}/frage/${question.id}/ergebnis`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ergebnis anzeigen
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
