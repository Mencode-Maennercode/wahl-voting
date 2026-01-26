"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, updateDoc, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Save, Eye, Palette, FileText } from 'lucide-react'
import type { Association, BallotTemplate } from '@/types'

export default function TemplatesPage() {
  const { association, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [template, setTemplate] = useState<BallotTemplate>({
    showLogo: true,
    showHeader: true,
    showFooter: true,
    headerText: '',
    footerText: '',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    logoUrl: '',
    customStyles: ''
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (association) {
      setTemplate(association.ballotTemplate || {
        showLogo: true,
        showHeader: true,
        showFooter: true,
        headerText: '',
        footerText: '',
        backgroundColor: '#ffffff',
        textColor: '#1e293b',
        logoUrl: '',
        customStyles: ''
      })
    }
  }, [association])

  const handleSave = async () => {
    if (!association) return
    setSaving(true)

    try {
      const docRef = doc(db, 'associations', association.id)
      await updateDoc(docRef, {
        ballotTemplate: template,
        updatedAt: Timestamp.now()
      })

      toast({
        title: "Vorlage gespeichert",
        description: "Die Stimmzettel-Vorlage wurde aktualisiert."
      })

      const stored = localStorage.getItem('vereins-wahlen-auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.ballotTemplate = template
        localStorage.setItem('vereins-wahlen-auth', JSON.stringify(parsed))
      }
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        title: "Fehler",
        description: "Die Vorlage konnte nicht gespeichert werden.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const renderPreview = () => {
    const styles = `
      .ballot-preview {
        background-color: ${template.backgroundColor};
        color: ${template.textColor};
        padding: 2rem;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        max-width: 400px;
        margin: 0 auto;
        font-family: Arial, sans-serif;
        ${template.customStyles}
      }
      .ballot-preview h2 {
        margin: 0 0 1rem 0;
        font-size: 1.5rem;
        font-weight: bold;
      }
      .ballot-preview p {
        margin: 0.5rem 0;
        line-height: 1.5;
      }
      .ballot-preview .qr-section {
        border-top: 2px solid ${template.textColor};
        border-bottom: 2px solid ${template.textColor};
        padding: 1rem 0;
        margin: 1rem 0;
        text-align: center;
      }
      .ballot-preview .footer {
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 1rem;
      }
    `

    return (
      <div className="ballot-preview">
        <style>{styles}</style>
        {template.showLogo && (
          <div className="text-center mb-4">
            {template.logoUrl ? (
              <img src={template.logoUrl} alt="Logo" className="h-16 mx-auto" />
            ) : (
              <div className="h-16 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                Logo
              </div>
            )}
          </div>
        )}
        
        {template.showHeader && template.headerText && (
          <div className="text-center mb-4">
            <p>{template.headerText}</p>
          </div>
        )}
        
        <h2>Beispiel-Wahl</h2>
        <p>Dies ist eine Beispielabstimmung zur Vorschau der Vorlage.</p>
        
        <div className="qr-section">
          <p>QR-Code Bereich</p>
          <div className="bg-gray-200 w-32 h-32 mx-auto rounded flex items-center justify-center">
            QR
          </div>
          <p className="text-sm mt-2">Code: ABCD</p>
        </div>
        
        {template.showFooter && template.footerText && (
          <div className="footer text-center">
            <p>{template.footerText}</p>
          </div>
        )}
        
        <div className="footer text-center">
          <p>Stimmzettel 1 von 100</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Laden...</div>
      </div>
    )
  }

  if (!association) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Dashboard
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? 'Editor' : 'Vorschau'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Stimmzettel-Vorlage</h1>
          <p className="text-slate-600">
            Gestalten Sie das Aussehen Ihrer gedruckten Stimmzettel.
          </p>
        </div>

        {previewMode ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Vorschau
              </CardTitle>
              <CardDescription>
                So wird der Stimmzettel gedruckt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderPreview()}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Design-Einstellungen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backgroundColor">Hintergrundfarbe</Label>
                  <Input
                    id="backgroundColor"
                    type="color"
                    value={template.backgroundColor}
                    onChange={(e) => setTemplate({ ...template, backgroundColor: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textColor">Textfarbe</Label>
                  <Input
                    id="textColor"
                    type="color"
                    value={template.textColor}
                    onChange={(e) => setTemplate({ ...template, textColor: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo-URL</Label>
                  <Input
                    id="logoUrl"
                    placeholder="https://example.com/logo.png"
                    value={template.logoUrl}
                    onChange={(e) => setTemplate({ ...template, logoUrl: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">
                    URL zu Ihrem Vereinslogo (optional)
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showLogo">Logo anzeigen</Label>
                    <Switch
                      id="showLogo"
                      checked={template.showLogo}
                      onCheckedChange={(checked) => setTemplate({ ...template, showLogo: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="showHeader">Kopfzeile anzeigen</Label>
                    <Switch
                      id="showHeader"
                      checked={template.showHeader}
                      onCheckedChange={(checked) => setTemplate({ ...template, showHeader: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="showFooter">Fußzeile anzeigen</Label>
                    <Switch
                      id="showFooter"
                      checked={template.showFooter}
                      onCheckedChange={(checked) => setTemplate({ ...template, showFooter: checked })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Text-Inhalte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headerText">Kopfzeilentext</Label>
                  <Textarea
                    id="headerText"
                    placeholder="Willkommen zur Wahl des Vereins..."
                    value={template.headerText}
                    onChange={(e) => setTemplate({ ...template, headerText: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footerText">Fußzeilentext</Label>
                  <Textarea
                    id="footerText"
                    placeholder="Diese Wahl wird anonym durchgeführt..."
                    value={template.footerText}
                    onChange={(e) => setTemplate({ ...template, footerText: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customStyles">Benutzerdefinierte CSS</Label>
                  <Textarea
                    id="customStyles"
                    placeholder=".custom-class { font-weight: bold; }"
                    value={template.customStyles}
                    onChange={(e) => setTemplate({ ...template, customStyles: e.target.value })}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Zusätzliches CSS für erweiterte Anpassungen (für Fortgeschrittene)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!previewMode && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Hinweise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>• Die Vorlage wird für alle zukünftigen Wahlen verwendet</p>
              <p>• QR-Codes werden immer gedruckt, Links mit Codes sind optional</p>
              <p>• Änderungen wirken sich nur auf neue Wahlen aus</p>
              <p>• Verwenden Sie die Vorschau um das Ergebnis zu prüfen</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
