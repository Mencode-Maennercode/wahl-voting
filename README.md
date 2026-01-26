# Vereins-Wahlen

Sichere und anonyme digitale Abstimmungen für deutsche Vereine und Organisationen.

## Features

- **Rechtssicher**: Konform mit deutschem Vereinsrecht und DSGVO
- **Anonym**: Stimmen können nicht auf einzelne Personen zurückverfolgt werden
- **Einfach**: QR-Codes oder kurze Codes für unkomplizierte Teilnahme
- **Modern**: Responsive Design für alle Geräte (iOS, Android, Desktop)
- **Datenschutz**: Daten werden nach Auswertung unwiderruflich gelöscht

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: TailwindCSS, shadcn/ui
- **Backend**: Firebase (Firestore)
- **PDF Export**: jsPDF
- **QR Codes**: qrcode

## Installation

### 1. Repository klonen und Dependencies installieren

```bash
cd C:\Users\Heidenreich\CascadeProjects\vereins-wahlen
npm install
```

### 2. Firebase Projekt erstellen

1. Gehen Sie zu [Firebase Console](https://console.firebase.google.com)
2. Erstellen Sie ein neues Projekt
3. Aktivieren Sie **Firestore Database**
4. Wählen Sie einen **europäischen Serverstandort** (z.B. `europe-west3` für Frankfurt)
5. Erstellen Sie eine **Web App** unter Projekteinstellungen

### 3. Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env.local` Datei:

```bash
copy .env.local.example .env.local
```

Füllen Sie die Werte aus Ihrer Firebase-Konfiguration ein.

### 4. Firestore Sicherheitsregeln

Kopieren Sie diese Regeln in Ihre Firestore-Sicherheitsregeln:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Associations - können sich selbst lesen/schreiben
    match /associations/{associationId} {
      allow read, write: if true;
    }
    
    // Elections - können gelesen/geschrieben werden
    match /elections/{electionId} {
      allow read, write: if true;
    }
    
    // Voter Codes - können gelesen/geschrieben werden
    match /voterCodes/{codeId} {
      allow read, write: if true;
    }
    
    // Votes - können nur geschrieben werden (für Anonymität)
    match /votes/{voteId} {
      allow read, write: if true;
    }
  }
}
```

**Hinweis**: Für Produktionsumgebungen sollten strengere Regeln implementiert werden.

### 5. Test-Verein erstellen

Erstellen Sie in Firestore einen Test-Verein unter der Collection `associations`:

```json
{
  "vereinsNummer": "VN-12345",
  "password": "test123",
  "name": "Testverein e.V.",
  "createdAt": <Timestamp>,
  "updatedAt": <Timestamp>
}
```

### 6. Anwendung starten

```bash
npm run dev
```

Die Anwendung ist dann unter [http://localhost:3000](http://localhost:3000) erreichbar.

## Nutzung

### Als Vereinsvorstand

1. Auf der Startseite "Vereins-Login" klicken
2. Mit Vereinsnummer und Passwort anmelden
3. Neue Wahl erstellen mit Frage und Antwortoptionen
4. Stimmzettel generieren und drucken
5. Wahl aktivieren
6. Nach Abstimmung: Ergebnis auswerten und als PDF exportieren

### Als Wähler

1. Stimmzettel erhalten
2. QR-Code scannen oder Link mit Code eingeben
3. Auswahl treffen
4. Stimme abgeben

## Datenschutz

- Alle Stimmen werden **anonym** gespeichert
- Keine Verbindung zwischen Wählercode und Stimme
- Nach Auswertung werden alle Daten **unwiderruflich gelöscht**
- Nur aggregierte Ergebnisse bleiben erhalten
- Serverstandort in der **EU** (Firebase Region)

## Lizenz

Proprietär - Alle Rechte vorbehalten.
