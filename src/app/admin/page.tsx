"use client"

import { useEffect, useState } from 'react'

import dynamic from 'next/dynamic'

// Dynamically import TemplateEditor to avoid SSR issues
const TemplateEditor = dynamic(() => import('@/components/ui/TemplateEditor').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="border border-slate-200 rounded-lg h-[300px] flex items-center justify-center text-slate-500">Laden...</div>
})

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
import { Vote, Plus, LogOut, Settings, Trash2, Eye, Printer, BarChart3, Calendar, Users, CheckCircle2, Palette, Sparkles } from 'lucide-react'
import type { Election, ElectionOption, BallotTemplate } from '@/types'
import { generateUniqueCode, formatDate, formatDateShort } from '@/lib/utils'

export default function AdminDashboard() {
  const { association, isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [elections, setElections] = useState<Election[]>([])
  const [loadingElections, setLoadingElections] = useState(true)
  const [showNewElection, setShowNewElection] = useState(false)
  const [selectedElection, setSelectedElection] = useState<Election | null>(null)
  
  const [newElection, setNewElection] = useState({
    title: '',
    description: '',
    question: '',
    options: [{ id: '1', text: '', order: 0 }, { id: '2', text: '', order: 1 }],
    allowInvalidVotes: true,
    electionDate: '',
    maxVoters: 50,
    invitationText: 'Sie sind herzlich eingeladen, an der Abstimmung teilzunehmen. Bitte scannen Sie den QR-Code oder geben Sie den Code auf der Webseite ein.',
    showLinkWithCode: false
  })
  
  const [templatePreview, setTemplatePreview] = useState<BallotTemplate>({
    showLogo: true,
    showHeader: true,
    showFooter: true,
    headerText: '',
    footerText: '',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    logoUrl: '',
    customStyles: '',
    richContent: ''
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (association) {
      loadElections()
      setTemplatePreview(association.ballotTemplate || {
        showLogo: true,
        showHeader: true,
        showFooter: true,
        headerText: '',
        footerText: '',
        backgroundColor: '#ffffff',
        textColor: '#1e293b',
        logoUrl: '',
        customStyles: '',
        richContent: ''
      })
    }
  }, [association])

  const loadElections = async () => {
    if (!association) return
    
    try {
      const electionsRef = collection(db, 'elections')
      const q = query(electionsRef, where('associationId', '==', association.id))
      const querySnapshot = await getDocs(q)
      
      const loadedElections: Election[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const electionData: Election = {
          id: doc.id,
          associationId: data.associationId,
          title: data.title,
          description: data.description,
          question: data.question,
          options: data.options,
          allowInvalidVotes: data.allowInvalidVotes,
          electionDate: data.electionDate?.toDate() || new Date(),
          maxVoters: data.maxVoters,
          invitationText: data.invitationText,
          showLinkWithCode: data.showLinkWithCode || false,
          status: data.status,
          codesGenerated: data.codesGenerated,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        }
        loadedElections.push(electionData)
      })
      
      setElections(loadedElections.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
    } catch (error) {
      console.error('Error loading elections:', error)
      toast({
        title: "Fehler beim Laden",
        description: "Wahlen konnten nicht geladen werden.",
        variant: "destructive"
      })
    } finally {
      setLoadingElections(false)
    }
  }

  const handleCreateElection = async () => {
    if (!association) return
    
    if (!newElection.title || !newElection.question || newElection.options.some(o => !o.text)) {
      toast({
        title: "Felder ausfüllen",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      })
      return
    }

    try {
      const electionData = {
        associationId: association.id,
        title: newElection.title,
        description: newElection.description,
        question: newElection.question,
        options: newElection.options.map((o, i) => ({ ...o, order: i })),
        allowInvalidVotes: newElection.allowInvalidVotes,
        electionDate: Timestamp.fromDate(new Date(newElection.electionDate)),
        maxVoters: newElection.maxVoters,
        invitationText: newElection.invitationText,
        showLinkWithCode: newElection.showLinkWithCode,
        status: 'draft',
        codesGenerated: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }

      await addDoc(collection(db, 'elections'), electionData)
      
      toast({
        title: "Wahl erstellt",
        description: "Die Wahl wurde erfolgreich erstellt."
      })
      
      setShowNewElection(false)
      setNewElection({
        title: '',
        description: '',
        question: '',
        options: [{ id: '1', text: '', order: 0 }, { id: '2', text: '', order: 1 }],
        allowInvalidVotes: true,
        electionDate: '',
        maxVoters: 50,
        invitationText: 'Sie sind herzlich eingeladen, an der Abstimmung teilzunehmen. Bitte scannen Sie den QR-Code oder geben Sie den Code auf der Webseite ein.',
        showLinkWithCode: false
      })
      loadElections()
    } catch (error) {
      console.error('Error creating election:', error)
      toast({
        title: "Fehler",
        description: "Die Wahl konnte nicht erstellt werden.",
        variant: "destructive"
      })
    }
  }

  const addOption = () => {
    const newId = (newElection.options.length + 1).toString()
    setNewElection({
      ...newElection,
      options: [...newElection.options, { id: newId, text: '', order: newElection.options.length }]
    })
  }

  const removeOption = (index: number) => {
    if (newElection.options.length <= 2) return
    const updated = newElection.options.filter((_, i) => i !== index)
    setNewElection({ ...newElection, options: updated })
  }

  const updateOption = (index: number, text: string) => {
    const updated = [...newElection.options]
    updated[index].text = text
    setNewElection({ ...newElection, options: updated })
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const generateAITemplate = () => {
    const electionType = newElection.title.toLowerCase()
    let richContent = ''

    if (electionType.includes('vorsitz') || electionType.includes('präsident')) {
      richContent = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e293b; font-size: 24px; font-weight: bold; margin-bottom: 10px;">
            Wahl des Vereinsvorsitzenden
          </h1>
          <p style="color: #64748b; font-size: 14px;">
            ${newElection.description || 'Ihre Stimme ist wichtig für die Zukunft unseres Vereins.'}
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 15px;">Wahlfrage:</h2>
          <p style="color: #334155; font-size: 16px; font-weight: 500;">
            ${newElection.question}
          </p>
        </div>
        
        <div style="margin: 20px 0;">
          <h3 style="color: #1e293b; font-size: 16px; margin-bottom: 10px;">Kandidaten:</h3>
          ${newElection.options.map((option, index) => `
            <div style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: #3b82f6; color: white; border-radius: 50%; margin-right: 15px; font-weight: bold;">
                ${index + 1}
              </span>
              <span style="color: #1e293b; font-size: 15px;">
                ${option.text || 'Kandidat ' + (index + 1)}
              </span>
            </div>
          `).join('')}
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px; text-align: center;">
            Bitte wählen Sie eine Option und geben Sie Ihren Stimmzettel ab.
          </p>
        </div>
      `
    } else if (electionType.includes('kassier') || electionType.includes('schatzmeister')) {
      richContent = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e293b; font-size: 24px; font-weight: bold; margin-bottom: 10px;">
            Wahl des Kassierers
          </h1>
          <p style="color: #64748b; font-size: 14px;">
            ${newElection.description || 'Verantwortliche Verwaltung der Vereinsfinanzen'}
          </p>
        </div>
        
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h2 style="color: #92400e; font-size: 18px; margin-bottom: 15px;">Wahlfrage:</h2>
          <p style="color: #78350f; font-size: 16px; font-weight: 500;">
            ${newElection.question}
          </p>
        </div>
        
        <div style="margin: 20px 0;">
          <h3 style="color: #1e293b; font-size: 16px; margin-bottom: 10px;">Kandidaten:</h3>
          ${newElection.options.map((option, index) => `
            <div style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: #f59e0b; color: white; border-radius: 50%; margin-right: 15px; font-weight: bold;">
                ${index + 1}
              </span>
              <span style="color: #1e293b; font-size: 15px;">
                ${option.text || 'Kandidat ' + (index + 1)}
              </span>
            </div>
          `).join('')}
        </div>
      `
    } else {
      richContent = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e293b; font-size: 24px; font-weight: bold; margin-bottom: 10px;">
            ${newElection.title}
          </h1>
          <p style="color: #64748b; font-size: 14px;">
            ${newElection.description || 'Vereinsabstimmung'}
          </p>
        </div>
        
        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 15px;">Wahlfrage:</h2>
          <p style="color: #334155; font-size: 16px; font-weight: 500;">
            ${newElection.question}
          </p>
        </div>
        
        <div style="margin: 20px 0;">
          <h3 style="color: #1e293b; font-size: 16px; margin-bottom: 10px;">Optionen:</h3>
          ${newElection.options.map((option, index) => `
            <div style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: #6366f1; color: white; border-radius: 50%; margin-right: 15px; font-weight: bold;">
                ${index + 1}
              </span>
              <span style="color: #1e293b; font-size: 15px;">
                ${option.text || 'Option ' + (index + 1)}
              </span>
            </div>
          `).join('')}
        </div>
      `
    }

    setTemplatePreview({ ...templatePreview, richContent })
    
    toast({
      title: "KI-Design erstellt",
      description: "Ein professionelles Design wurde generiert.",
    })
  }

  const renderTemplatePreview = () => {
    const template = templatePreview
    const styles = `
      .ballot-preview {
        background-color: ${template.backgroundColor};
        color: ${template.textColor};
        padding: 2rem;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        max-width: 300px;
        margin: 0 auto;
        font-family: Arial, sans-serif;
        ${template.customStyles}
      }
      .ballot-preview h2 {
        margin: 0 0 1rem 0;
        font-size: 1.2rem;
        font-weight: bold;
      }
      .ballot-preview p {
        margin: 0.5rem 0;
        line-height: 1.4;
        font-size: 0.9rem;
      }
      .ballot-preview .qr-section {
        border-top: 2px solid ${template.textColor};
        border-bottom: 2px solid ${template.textColor};
        padding: 1rem 0;
        margin: 1rem 0;
        text-align: center;
      }
      .ballot-preview .footer {
        font-size: 0.7rem;
        opacity: 0.7;
        margin-top: 1rem;
      }
    `

    return (
      <div className="ballot-preview">
        <style>{styles}</style>
        {template.showLogo && (
          <div className="text-center mb-3">
            {template.logoUrl ? (
              <img src={template.logoUrl} alt="Logo" className="h-12 mx-auto" />
            ) : (
              <div className="h-12 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">
                Logo
              </div>
            )}
          </div>
        )}
        
        {template.showHeader && template.headerText && (
          <div className="text-center mb-3">
            <p className="text-xs">{template.headerText}</p>
          </div>
        )}
        
        <h2>{newElection.title || 'Beispiel-Wahl'}</h2>
        <p className="text-xs">{newElection.question || 'Beispiel-Frage'}</p>
        
        <div className="qr-section">
          <p className="text-xs">QR-Code</p>
          <div className="bg-gray-200 w-20 h-20 mx-auto rounded flex items-center justify-center text-xs">
            QR
          </div>
          {newElection.showLinkWithCode && (
            <p className="text-xs mt-1">Code: ABCD</p>
          )}
        </div>
        
        {template.showFooter && template.footerText && (
          <div className="footer text-center">
            <p>{template.footerText}</p>
          </div>
        )}
        
        <div className="footer text-center">
          <p>Stimmzettel 1 von {newElection.maxVoters}</p>
        </div>
      </div>
    )
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
            <Vote className="h-6 w-6 text-slate-700" />
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
            <h1 className="text-2xl font-bold text-slate-800">Wahlen verwalten</h1>
            <p className="text-slate-600">Erstellen und verwalten Sie Ihre Vereinswahlen</p>
          </div>
          <Dialog open={showNewElection} onOpenChange={setShowNewElection}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neue Wahl erstellen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neue Wahl erstellen</DialogTitle>
                <DialogDescription>
                  Definieren Sie die Wahlfrage und die möglichen Antworten.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Titel der Wahl *</Label>
                    <Input
                      id="title"
                      placeholder="z.B. Vorstandswahl 2024"
                      value={newElection.title}
                      onChange={(e) => setNewElection({ ...newElection, title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Beschreibung</Label>
                    <Textarea
                      id="description"
                      placeholder="Optionale Beschreibung der Wahl"
                      value={newElection.description}
                      onChange={(e) => setNewElection({ ...newElection, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="question">Wahlfrage *</Label>
                    <Input
                      id="question"
                      placeholder="z.B. Wen wählen Sie zum neuen Vorsitzenden?"
                      value={newElection.question}
                      onChange={(e) => setNewElection({ ...newElection, question: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Antwortmöglichkeiten *</Label>
                    {newElection.options.map((option, index) => (
                      <div key={option.id} className="flex gap-2">
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) => updateOption(index, e.target.value)}
                        />
                        {newElection.options.length > 2 && (
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="electionDate">Wahldatum *</Label>
                      <Input
                        id="electionDate"
                        type="datetime-local"
                        value={newElection.electionDate}
                        onChange={(e) => setNewElection({ ...newElection, electionDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxVoters">Maximale Teilnehmer</Label>
                      <Input
                        id="maxVoters"
                        type="number"
                        min={1}
                        value={newElection.maxVoters}
                        onChange={(e) => setNewElection({ ...newElection, maxVoters: parseInt(e.target.value) || 50 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invitationText">Einladungstext</Label>
                    <Textarea
                      id="invitationText"
                      placeholder="Text auf dem Stimmzettel"
                      value={newElection.invitationText}
                      onChange={(e) => setNewElection({ ...newElection, invitationText: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <Label htmlFor="allowInvalid">Ungültige Stimmen erlauben</Label>
                      <p className="text-sm text-slate-500">Teilnehmer können ohne Auswahl abstimmen</p>
                    </div>
                    <Switch
                      id="allowInvalid"
                      checked={newElection.allowInvalidVotes}
                      onCheckedChange={(checked) => setNewElection({ ...newElection, allowInvalidVotes: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <Label htmlFor="showLinkWithCode">Link mit Code drucken</Label>
                      <p className="text-sm text-slate-500">Zusätzlich zum QR-Code auch Link und Code anzeigen</p>
                    </div>
                    <Switch
                      id="showLinkWithCode"
                      checked={newElection.showLinkWithCode}
                      onCheckedChange={(checked) => setNewElection({ ...newElection, showLinkWithCode: checked })}
                    />
                  </div>
                </div>

                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Stimmzettel-Editor</Label>
                      <p className="text-sm text-slate-500">Erstellen Sie Ihren Stimmzettel wie in Word</p>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={generateAITemplate}
                      disabled={!newElection.title}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      KI-Design
                    </Button>
                  </div>
                  
                  <TemplateEditor
                    initialContent={templatePreview.richContent || ''}
                    onChange={(content) => setTemplatePreview({ ...templatePreview, richContent: content })}
                    placeholder="Gestalten Sie hier Ihren Stimmzettel..."
                  />

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Vorschau</Label>
                    <Card className="p-4">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: templatePreview.richContent || '<p class="text-slate-500">Ihr Stimmzettel-Design wird hier angezeigt...</p>' }}
                      />
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Editor-Info</Label>
                    <p className="text-xs text-slate-600">
                      • Verwenden Sie die Toolbar zum Formatieren von Text, Überschriften und Listen
                    </p>
                    <p className="text-xs text-slate-600">
                      • Fügen Sie Bilder und Links ein für professionelle Stimmzettel
                    </p>
                    <p className="text-xs text-slate-600">
                      • "KI-Design" erstellt ein professionelles Design basierend auf dem Wahltyp
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewElection(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleCreateElection}>
                  Wahl erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loadingElections ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-slate-500">Wahlen werden geladen...</div>
          </div>
        ) : elections.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Vote className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">Keine Wahlen vorhanden</h3>
              <p className="text-slate-500 mb-4">Erstellen Sie Ihre erste Wahl, um loszulegen.</p>
              <Button onClick={() => setShowNewElection(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Wahl erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {elections.map((election) => (
              <Card key={election.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{election.title}</CardTitle>
                      <CardDescription className="mt-1">{election.question}</CardDescription>
                    </div>
                    {getStatusBadge(election.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDateShort(election.electionDate)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {election.maxVoters} Teilnehmer
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      {election.options.length} Optionen
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(`/admin/wahl/${election.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                    {election.status === 'draft' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/admin/wahl/${election.id}/codes`)}
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        Stimmzettel
                      </Button>
                    )}
                    {(election.status === 'active' || election.status === 'closed') && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/admin/wahl/${election.id}/ergebnis`)}
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Ergebnis
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
