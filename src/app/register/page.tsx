"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/use-toast'
import { Vote, CheckCircle2, Copy } from 'lucide-react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [createdVereinsNummer, setCreatedVereinsNummer] = useState<string | null>(null)
  const { register } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== passwordConfirm) {
      toast({
        title: "Passwörter stimmen nicht überein",
        description: "Bitte überprüfen Sie Ihr Passwort.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    const result = await register({ name, email, password })
    setIsLoading(false)

    if (result.success && result.vereinsNummer) {
      setCreatedVereinsNummer(result.vereinsNummer)
      toast({
        title: "Verein erfolgreich registriert",
        description: `Ihre Vereinsnummer lautet ${result.vereinsNummer}.`,
      })
    } else {
      toast({
        title: "Registrierung fehlgeschlagen",
        description: result.error || "Bitte versuchen Sie es erneut.",
        variant: "destructive",
      })
    }
  }

  const handleCopy = () => {
    if (createdVereinsNummer) {
      navigator.clipboard.writeText(createdVereinsNummer)
      toast({ title: "Kopiert", description: "Vereinsnummer in Zwischenablage kopiert." })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Vote className="h-8 w-8 text-slate-700" />
            <span className="text-xl font-semibold text-slate-800">Vereins-Wahlen</span>
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/')}>
              Zur Startseite
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-16 max-w-md">
          <Card className="animate-fade-in">
            {createdVereinsNummer ? (
              <>
                <CardHeader className="text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl">Registrierung erfolgreich</CardTitle>
                  <CardDescription>
                    Bitte notieren Sie Ihre Vereinsnummer. Sie können sich damit oder mit Ihrer E-Mail anmelden.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-slate-50 p-4 text-center">
                    <p className="text-sm text-slate-600">Ihre Vereinsnummer</p>
                    <p className="text-2xl font-bold tracking-wider text-slate-800 mt-1">
                      {createdVereinsNummer}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={handleCopy}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Kopieren
                    </Button>
                  </div>
                  <Button className="w-full" onClick={() => router.push('/admin')}>
                    Zum Dashboard
                  </Button>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Verein registrieren</CardTitle>
                  <CardDescription>
                    Erstellen Sie ein kostenloses Konto für Ihren Verein.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name des Vereins</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="z.B. TSV Musterstadt e.V."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-Mail</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="vorstand@verein.de"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Passwort</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Mindestens 8 Zeichen"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordConfirm">Passwort bestätigen</Label>
                      <Input
                        id="passwordConfirm"
                        type="password"
                        placeholder="Passwort wiederholen"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        minLength={8}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? 'Registrieren...' : 'Verein registrieren'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => router.push('/')}
                    >
                      Bereits registriert? Zum Login
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
          <p className="text-xs text-slate-500 text-center mt-4">
            Mit der Registrierung stimmen Sie der Verarbeitung Ihrer Daten gemäß DSGVO zu.
            Ihr Passwort wird verschlüsselt gespeichert.
          </p>
        </section>
      </main>
    </div>
  )
}
