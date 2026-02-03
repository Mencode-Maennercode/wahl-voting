"use client"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Save, Trash2, Play, Square, Printer, BarChart3, Users, MessageSquare } from 'lucide-react'
import type { Election } from '@/types'
import { formatDate } from '@/lib/utils'

export default function ElectionDetailPage() {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const electionId = params.id as string

  const [election, setElection] = useState<Election | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [votedCount, setVotedCount] = useState(0)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    invitationText: '',
    showLinkWithCode: false,
    maxVoters: 50
  })
  
  const [questionCount, setQuestionCount] = useState(0)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (electionId && association) {
      loadElection()
    }
  }, [electionId, association])

  const loadElection = async () => {
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
        setFormData({
          title: electionData.title,
          description: electionData.description,
          invitationText: electionData.invitationText,
          showLinkWithCode: electionData.showLinkWithCode,
          maxVoters: electionData.maxVoters
        })
        
        const questionsRef = collection(db, 'electionQuestions')
        const questionsQuery = query(questionsRef, where('electionId', '==', electionId))
        const questionsSnap = await getDocs(questionsQuery)
        setQuestionCount(questionsSnap.size)

        const codesRef = collection(db, 'voterCodes')
        const q = query(codesRef, where('electionId', '==', electionId))
        const codesSnap = await getDocs(q)
        
        let votedCodesCount = 0
        codesSnap.forEach((doc) => {
          const data = doc.data()
          if (data.votedQuestions && data.votedQuestions.length > 0) {
            votedCodesCount++
          }
        })
        setVotedCount(votedCodesCount)
      } else {
        router.push('/admin')
      }
    } catch (error) {
      console.error('Error loading election:', error)
      toast({
        title: "Fehler",
        description: "Die Wahl konnte nicht geladen werden.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!election) return
    setSaving(true)

    try {
      const docRef = doc(db, 'elections', electionId)
      const electionData = {
        title: formData.title,
        description: formData.description,
        invitationText: formData.invitationText,
        showLinkWithCode: formData.showLinkWithCode,
        maxVoters: formData.maxVoters,
        updatedAt: Timestamp.now()
      }

      await updateDoc(docRef, electionData)

      toast({
        title: "Gespeichert",
        description: "Die Änderungen wurden gespeichert."
      })

      loadElection()
    } catch (error) {
      console.error('Error saving:', error)
      toast({
        title: "Fehler",
        description: "Änderungen konnten nicht gespeichert werden.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    if (!election || !election.codesGenerated) {
      toast({
        title: "Codes erforderlich",
        description: "Bitte generieren Sie zuerst die Stimmzettel.",
        variant: "destructive"
      })
      return
    }

    try {
      const docRef = doc(db, 'elections', electionId)
      await updateDoc(docRef, {
        status: 'active',
        updatedAt: Timestamp.now()
      })

      toast({
        title: "Wahl aktiviert",
        description: "Die Wahl ist jetzt aktiv. Teilnehmer können abstimmen."
      })

      loadElection()
    } catch (error) {
      console.error('Error activating:', error)
      toast({
        title: "Fehler",
        description: "Die Wahl konnte nicht aktiviert werden.",
        variant: "destructive"
      })
    }
  }

  const handleClose = async () => {
    try {
      const docRef = doc(db, 'elections', electionId)
      await updateDoc(docRef, {
        status: 'closed',
        updatedAt: Timestamp.now()
      })

      toast({
        title: "Wahl geschlossen",
        description: "Die Wahl wurde geschlossen. Es können keine weiteren Stimmen abgegeben werden."
      })

      loadElection()
    } catch (error) {
      console.error('Error closing:', error)
      toast({
        title: "Fehler",
        description: "Die Wahl konnte nicht geschlossen werden.",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async () => {
    try {
      const codesRef = collection(db, 'voterCodes')
      const q = query(codesRef, where('electionId', '==', electionId))
      const codesSnap = await getDocs(q)
      
      const deletePromises = codesSnap.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deletePromises)

      const votesRef = collection(db, 'votes')
      const votesQ = query(votesRef, where('electionId', '==', electionId))
      const votesSnap = await getDocs(votesQ)
      
      const deleteVotesPromises = votesSnap.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deleteVotesPromises)

      await deleteDoc(doc(db, 'elections', electionId))

      toast({
        title: "Wahl gelöscht",
        description: "Die Wahl und alle zugehörigen Daten wurden gelöscht."
      })

      router.push('/admin')
    } catch (error) {
      console.error('Error deleting:', error)
      toast({
        title: "Fehler",
        description: "Die Wahl konnte nicht gelöscht werden.",
        variant: "destructive"
      })
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!election) return null

  const canEdit = election.status === 'draft'
  const canActivate = election.status === 'draft' && election.codesGenerated
  const canClose = election.status === 'active'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{election.title}</h1>
            <p className="text-slate-600">{election.description || 'Keine Beschreibung'}</p>
          </div>
          <div className="flex items-center gap-2">
            {canActivate && (
              <Button onClick={handleActivate}>
                <Play className="h-4 w-4 mr-2" />
                Wahl starten
              </Button>
            )}
            {canClose && (
              <Button variant="outline" onClick={handleClose}>
                <Square className="h-4 w-4 mr-2" />
                Wahl schließen
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-slate-400" />
                <div>
                  <div className="text-2xl font-bold">{votedCount} / {election.maxVoters}</div>
                  <div className="text-sm text-slate-500">Stimmen abgegeben</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-slate-500 mb-1">Status</div>
              <div className="font-medium">
                {election.status === 'draft' && 'Entwurf'}
                {election.status === 'active' && 'Aktiv'}
                {election.status === 'closed' && 'Geschlossen'}
                {election.status === 'evaluated' && 'Ausgewertet'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-slate-500 mb-1">Wahldatum</div>
              <div className="font-medium">{formatDate(election.electionDate)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Button 
            variant="outline" 
            className="h-auto py-4"
            onClick={() => router.push(`/admin/wahl/${electionId}/fragen`)}
          >
            <MessageSquare className="h-5 w-5 mr-2" />
            <div className="text-left">
              <div className="font-medium">Wahlfragen ({questionCount})</div>
              <div className="text-sm text-slate-500">Fragen erstellen und verwalten</div>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-auto py-4"
            onClick={() => router.push(`/admin/wahl/${electionId}/codes`)}
          >
            <Printer className="h-5 w-5 mr-2" />
            <div className="text-left">
              <div className="font-medium">Stimmzettel</div>
              <div className="text-sm text-slate-500">QR-Codes generieren und drucken</div>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-auto py-4"
            onClick={() => router.push(`/admin/wahl/${electionId}/ergebnis`)}
            disabled={election.status === 'draft'}
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            <div className="text-left">
              <div className="font-medium">Ergebnis</div>
              <div className="text-sm text-slate-500">Wahlergebnis auswerten</div>
            </div>
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Wahleinstellungen</CardTitle>
            <CardDescription>
              {canEdit 
                ? 'Bearbeiten Sie die Einstellungen der Wahl.'
                : 'Die Wahl ist aktiv oder abgeschlossen. Einstellungen können nicht mehr geändert werden.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invitationText">Einladungstext</Label>
              <Textarea
                id="invitationText"
                value={formData.invitationText}
                onChange={(e) => setFormData({ ...formData, invitationText: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxVoters">Maximale Teilnehmer</Label>
              <Input
                id="maxVoters"
                type="number"
                value={formData.maxVoters}
                onChange={(e) => setFormData({ ...formData, maxVoters: parseInt(e.target.value) || 50 })}
                disabled={!canEdit}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Ungültige Stimmen erlauben</Label>
                <p className="text-sm text-slate-500">Teilnehmer können ohne Auswahl abstimmen</p>
              </div>
              <Switch
                checked={formData.allowInvalidVotes}
                onCheckedChange={(checked) => setFormData({ ...formData, allowInvalidVotes: checked })}
                disabled={!canEdit}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label htmlFor="showLinkWithCode">Link mit Code drucken</Label>
                <p className="text-sm text-slate-500">Zusätzlich zum QR-Code auch Link und Code anzeigen</p>
              </div>
              <Switch
                checked={formData.showLinkWithCode}
                onCheckedChange={(checked) => setFormData({ ...formData, showLinkWithCode: checked })}
                disabled={!canEdit}
              />
            </div>

            {canEdit && (
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Speichern...' : 'Änderungen speichern'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Gefahrenzone</CardTitle>
            <CardDescription>
              Diese Aktionen können nicht rückgängig gemacht werden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Wahl löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Wahl wirklich löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten der Wahl, 
                    einschließlich aller Codes und Stimmen, werden unwiderruflich gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    Endgültig löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
