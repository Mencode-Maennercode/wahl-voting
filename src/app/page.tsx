"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/use-toast'
import { Vote, Shield, Users, Lock, QrCode, FileText } from 'lucide-react'

export default function HomePage() {
  const [vereinsNummer, setVereinsNummer] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const { login } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const success = await login(vereinsNummer, password)

    if (success) {
      toast({
        title: "Erfolgreich angemeldet",
        description: "Sie werden zum Dashboard weitergeleitet.",
      })
      router.push('/admin')
    } else {
      toast({
        title: "Anmeldung fehlgeschlagen",
        description: "Vereinsnummer oder Passwort ist falsch.",
        variant: "destructive",
      })
    }

    setIsLoading(false)
  }

  const handleVoterAccess = () => {
    router.push('/abstimmen')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="h-8 w-8 text-slate-700" />
            <span className="text-xl font-semibold text-slate-800">Vereins-Wahlen</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleVoterAccess}>
              Abstimmen
            </Button>
            <Button onClick={() => setShowLogin(true)}>
              Vereins-Login
            </Button>
          </div>
        </div>
      </header>

      <main>
        {showLogin ? (
          <section className="container mx-auto px-4 py-16 max-w-md">
            <Card className="animate-fade-in">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Vereins-Anmeldung</CardTitle>
                <CardDescription>
                  Melden Sie sich mit Ihrer Vereinsnummer und Ihrem Passwort an.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vereinsNummer">Vereinsnummer</Label>
                    <Input
                      id="vereinsNummer"
                      type="text"
                      placeholder="z.B. VN-12345"
                      value={vereinsNummer}
                      onChange={(e) => setVereinsNummer(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Ihr Passwort"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Anmelden...' : 'Anmelden'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowLogin(false)}
                  >
                    Zurück zur Startseite
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        ) : (
          <>
            <section className="container mx-auto px-4 py-20 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6">
                Sichere digitale Abstimmungen<br />für Ihren Verein
              </h1>
              <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
                Führen Sie rechtskonforme Wahlen und Abstimmungen durch - 
                anonym, sicher und DSGVO-konform nach deutschem Vereinsrecht.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" onClick={() => setShowLogin(true)}>
                  Jetzt starten
                </Button>
                <Button size="lg" variant="outline" onClick={handleVoterAccess}>
                  <QrCode className="mr-2 h-5 w-5" />
                  Zur Abstimmung
                </Button>
              </div>
            </section>

            <section className="container mx-auto px-4 py-16">
              <h2 className="text-2xl font-bold text-center text-slate-800 mb-12">
                Warum Vereins-Wahlen?
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                <Card className="text-center p-6">
                  <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Rechtssicher</h3>
                  <p className="text-slate-600">
                    Konform mit deutschem Vereinsrecht und DSGVO. Gehostet in Europa.
                  </p>
                </Card>
                <Card className="text-center p-6">
                  <Lock className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Anonym</h3>
                  <p className="text-slate-600">
                    Stimmen können nicht auf einzelne Personen zurückverfolgt werden.
                  </p>
                </Card>
                <Card className="text-center p-6">
                  <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Einfach</h3>
                  <p className="text-slate-600">
                    QR-Codes oder kurze Links für unkomplizierte Teilnahme aller Mitglieder.
                  </p>
                </Card>
              </div>
            </section>

            <section className="container mx-auto px-4 py-16 bg-white rounded-xl shadow-sm my-8">
              <h2 className="text-2xl font-bold text-center text-slate-800 mb-12">
                So funktioniert es
              </h2>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 font-bold text-xl flex items-center justify-center mx-auto mb-4">
                    1
                  </div>
                  <h3 className="font-semibold mb-2">Wahl erstellen</h3>
                  <p className="text-sm text-slate-600">
                    Definieren Sie Frage und Antwortmöglichkeiten
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 font-bold text-xl flex items-center justify-center mx-auto mb-4">
                    2
                  </div>
                  <h3 className="font-semibold mb-2">Stimmzettel drucken</h3>
                  <p className="text-sm text-slate-600">
                    QR-Codes oder Einmal-Codes für jeden Wähler
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 font-bold text-xl flex items-center justify-center mx-auto mb-4">
                    3
                  </div>
                  <h3 className="font-semibold mb-2">Abstimmen</h3>
                  <p className="text-sm text-slate-600">
                    Mitglieder stimmen anonym per Smartphone ab
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 font-bold text-xl flex items-center justify-center mx-auto mb-4">
                    4
                  </div>
                  <h3 className="font-semibold mb-2">Auswerten</h3>
                  <p className="text-sm text-slate-600">
                    Ergebnis als PDF exportieren, Daten werden gelöscht
                  </p>
                </div>
              </div>
            </section>

            <section className="container mx-auto px-4 py-16 text-center">
              <div className="bg-slate-800 text-white rounded-xl p-8 md:p-12">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-80" />
                <h2 className="text-2xl font-bold mb-4">
                  Datenschutz hat Priorität
                </h2>
                <p className="text-slate-300 max-w-2xl mx-auto mb-6">
                  Nach der Auswertung werden alle Daten unwiderruflich gelöscht. 
                  Es bleiben nur die Ergebnisse - keine Stimmen, keine Codes, keine Rückverfolgung.
                </p>
                <Button 
                  variant="secondary" 
                  size="lg"
                  onClick={() => setShowLogin(true)}
                >
                  Verein registrieren
                </Button>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t bg-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-slate-600">
          <p>&copy; {new Date().getFullYear()} Vereins-Wahlen. Alle Rechte vorbehalten.</p>
          <p className="text-sm mt-2">
            Gehostet in der EU | DSGVO-konform | Deutsches Vereinsrecht
          </p>
        </div>
      </footer>
    </div>
  )
}
