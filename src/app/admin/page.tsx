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
import { Progress } from '@/components/ui/progress'
import { Vote as VoteIcon, Plus, LogOut, Settings, Trash2, Eye, Printer, BarChart3, Calendar, Users, CheckCircle2, Play, Square, TrendingUp, Clock, AlertTriangle } from 'lucide-react'
import type { Event, EventQuestion, EventResult, OptionResult, Vote } from '@/types'
import { generateUniqueCode, formatDate, formatDateShort } from '@/lib/utils'

export default function AdminDashboard() {
  const { association, isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showResultsDialog, setShowResultsDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [eventResults, setEventResults] = useState<EventResult | null>(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [countdowns, setCountdowns] = useState<Record<string, string>>({})
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '',
    maxVoters: 50,
    showLinkWithCode: false
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (association) {
      loadEvents()
    }
  }, [association])

  // Countdown timer effect
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns: Record<string, string> = {}
      
      events.forEach(event => {
        if (event.status === 'closed' || event.status === 'evaluated') {
          // Find when the event was closed (use updatedAt as approximation)
          const closedAt = event.updatedAt
          const deletionTime = new Date(closedAt.getTime() + 24 * 60 * 60 * 1000) // 24 hours from closing
          const now = new Date()
          
          if (now < deletionTime) {
            const timeRemaining = deletionTime.getTime() - now.getTime()
            const hours = Math.floor(timeRemaining / (1000 * 60 * 60))
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)
            
            newCountdowns[event.id] = `${hours}h ${minutes}m ${seconds}s`
          } else {
            newCountdowns[event.id] = 'Löschen fällig'
          }
        }
      })
      
      setCountdowns(newCountdowns)
    }

    // Update immediately
    updateCountdowns()
    
    // Set up interval to update every second
    const interval = setInterval(updateCountdowns, 1000)
    
    return () => clearInterval(interval)
  }, [events])

  const loadEvents = async () => {
    if (!association) return
    
    try {
      const eventsRef = collection(db, 'events')
      const eventsQuery = query(eventsRef, where('associationId', '==', association.id))
      const eventsSnapshot = await getDocs(eventsQuery)
      
      const loadedEvents: Event[] = []
      eventsSnapshot.forEach((doc) => {
        const data = doc.data()
        loadedEvents.push({
          id: doc.id,
          associationId: data.associationId,
          title: data.title,
          description: data.description,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate(),
          startTime: data.startTime,
          endTime: data.endTime,
          maxVoters: data.maxVoters,
          invitationText: data.invitationText,
          showLinkWithCode: data.showLinkWithCode,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        })
      })
      
      setEvents(loadedEvents)
    } catch (error) {
      console.error('Error loading events:', error)
      toast({
        title: "Fehler beim Laden",
        description: "Veranstaltungen konnten nicht geladen werden.",
        variant: "destructive"
      })
    } finally {
      setLoadingEvents(false)
    }
  }

  const handleCreateEvent = async () => {
    if (!association) return
    
    if (!newEvent.title || !newEvent.startDate) {
      toast({
        title: "Felder ausfüllen",
        description: "Bitte geben Sie mindestens einen Titel und Startdatum ein.",
        variant: "destructive"
      })
      return
    }

    try {
      const eventData: {
        title: string
        description: string
        startDate: Date
        startTime: string
        maxVoters: number
        showLinkWithCode: boolean
        endDate?: Date
        endTime?: string
      } = {
        title: newEvent.title,
        description: newEvent.description,
        startDate: new Date(newEvent.startDate),
        startTime: newEvent.startTime,
        maxVoters: newEvent.maxVoters,
        showLinkWithCode: newEvent.showLinkWithCode
      }

      // Enddatum/Endzeit nur hinzufügen wenn ausgefüllt
      if (newEvent.endDate) {
        eventData.endDate = new Date(newEvent.endDate)
      }
      if (newEvent.endTime) {
        eventData.endTime = newEvent.endTime
      }

      const eventRef = await addDoc(collection(db, 'events'), {
        ...eventData,
        associationId: association.id,
        status: 'draft',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      const eventId = eventRef.id
      
      toast({
        title: "Veranstaltung erstellt",
        description: "Die Veranstaltung wurde erfolgreich erstellt. Fügen Sie jetzt Wahlfragen hinzu."
      })
      
      setShowNewEvent(false)
      setNewEvent({
        title: '',
        description: '',
        startDate: '',
        startTime: '09:00',
        endDate: '',
        endTime: '',
        maxVoters: 50,
        showLinkWithCode: false
      })
      
      router.push(`/admin/veranstaltung/${eventId}/fragen`)
    } catch (error) {
      console.error('Error creating event:', error)
      toast({
        title: "Fehler",
        description: "Die Veranstaltung konnte nicht erstellt werden.",
        variant: "destructive"
      })
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const startEvent = async (eventId: string) => {
    try {
      const eventRef = doc(db, 'events', eventId)
      await updateDoc(eventRef, {
        status: 'active',
        updatedAt: Timestamp.now()
      })
      
      toast({
        title: "Veranstaltung gestartet",
        description: "Die Veranstaltung wurde erfolgreich gestartet. Wähler können jetzt teilnehmen."
      })
      loadEvents()
    } catch (error) {
      console.error('Error starting event:', error)
      toast({
        title: "Fehler",
        description: "Die Veranstaltung konnte nicht gestartet werden.",
        variant: "destructive"
      })
    }
  }

  const closeEvent = async (eventId: string) => {
    try {
      const eventRef = doc(db, 'events', eventId)
      await updateDoc(eventRef, {
        status: 'closed',
        updatedAt: Timestamp.now()
      })
      
      toast({
        title: "Veranstaltung geschlossen",
        description: "Die Veranstaltung wurde erfolgreich geschlossen. Keine weiteren Stimmen mehr möglich."
      })
      loadEvents()
    } catch (error) {
      console.error('Error closing event:', error)
      toast({
        title: "Fehler",
        description: "Die Veranstaltung konnte nicht geschlossen werden.",
        variant: "destructive"
      })
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

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VoteIcon className="h-6 w-6 text-slate-700" />
            <span className="font-semibold text-slate-800">Vereins-Wahlen</span>
            {association && (
              <span className="text-slate-500 text-sm ml-2">| {association.name || association.vereinsNummer}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/einstellungen')}>
              <Settings className="h-4 w-4 mr-1" />
              Einstellungen
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Veranstaltungen verwalten</h1>
            <p className="text-slate-600">Erstellen und verwalten Sie Ihre Vereinsveranstaltungen</p>
          </div>
          <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neue Veranstaltung erstellen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neue Veranstaltung erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie eine neue Veranstaltung mit Start- und Enddatum. Wahlfragen können Sie anschließend hinzufügen.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel der Veranstaltung *</Label>
                  <Input
                    id="title"
                    placeholder="z.B. Mitgliederversammlung 2024"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    placeholder="Optionale Beschreibung der Veranstaltung"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Startdatum *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newEvent.startDate?.split('T')[0] || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Startzeit *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Enddatum (optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Endzeit (optional)</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxVoters">Maximale Teilnehmer</Label>
                  <Input
                    id="maxVoters"
                    type="number"
                    min={1}
                    value={newEvent.maxVoters}
                    onChange={(e) => setNewEvent({ ...newEvent, maxVoters: parseInt(e.target.value) || 50 })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="showLinkWithCode">Link mit Code drucken</Label>
                    <p className="text-sm text-slate-500">Zusätzlich zum QR-Code auch Link und Code anzeigen</p>
                  </div>
                  <Switch
                    id="showLinkWithCode"
                    checked={newEvent.showLinkWithCode}
                    onCheckedChange={(checked) => setNewEvent({ ...newEvent, showLinkWithCode: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewEvent(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleCreateEvent}>
                  Veranstaltung erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loadingEvents ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-slate-500">Veranstaltungen werden geladen...</div>
          </div>
        ) : events.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <VoteIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">Keine Veranstaltungen vorhanden</h3>
              <p className="text-slate-500 mb-4">Erstellen Sie Ihre erste Veranstaltung, um loszulegen.</p>
              <Button onClick={() => setShowNewEvent(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Veranstaltung erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <Card key={event.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                      <CardDescription className="mt-1">{event.description}</CardDescription>
                    </div>
                    {getStatusBadge(event.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDateShort(event.startDate)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {event.maxVoters} Teilnehmer
                    </div>
                  </div>
                  
                  {/* Countdown Timer for Closed/Evaluated Events */}
                  {(event.status === 'closed' || event.status === 'evaluated') && countdowns[event.id] && (
                    <div className={`flex items-center gap-2 text-sm p-3 rounded-lg mb-4 ${
                      countdowns[event.id] === 'Löschen fällig' 
                        ? 'bg-red-50 border border-red-200 text-red-700' 
                        : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}>
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">
                        {countdowns[event.id] === 'Löschen fällig' ? (
                          <>
                            <AlertTriangle className="h-4 w-4 inline mr-1" />
                            Ergebnisse werden gelöscht
                          </>
                        ) : (
                          'Ergebnisse gelöscht in: ' + countdowns[event.id]
                        )}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(`/admin/veranstaltung/${event.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ansehen
                    </Button>
                    
                    {event.status === 'draft' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/admin/veranstaltung/${event.id}/fragen`)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Fragen bearbeiten
                      </Button>
                    )}
                    
                    {event.status === 'draft' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/admin/veranstaltung/${event.id}/codes`)}
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        Stimmzettel
                      </Button>
                    )}
                    
                    {event.status === 'draft' && (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => startEvent(event.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Starten
                      </Button>
                    )}
                    
                    {event.status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => closeEvent(event.id)}
                        className="border-amber-600 text-amber-600 hover:bg-amber-50"
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Schließen
                      </Button>
                    )}
                    
                    {event.status === 'closed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/admin/veranstaltung/${event.id}/ergebnis`)}
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Alle Ergebnisse
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Veranstaltungsergebnisse: {eventResults?.title}</DialogTitle>
            <DialogDescription>
              Ergebnisse der Veranstaltung vom {selectedEvent && formatDateShort(selectedEvent.startDate)}
            </DialogDescription>
          </DialogHeader>
          
          {eventResults && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <p className="text-slate-600">Ergebnis-Anzeige wird implementiert...</p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowResultsDialog(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
