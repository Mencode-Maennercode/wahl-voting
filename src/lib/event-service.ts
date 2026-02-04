// Direkter Start mit neuer Veranstaltungs-Struktur
// Keine Migration nötig für Testdaten - alte Collections können ignoriert werden

import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore'
import { Event, EventQuestion } from '@/types'

export class EventService {
  // Erstellt eine neue Veranstaltung direkt mit der neuen Struktur
  static async createEvent(associationId: string, eventData: Partial<Event>): Promise<string> {
    const event: any = {
      associationId,
      title: eventData.title || 'Neue Veranstaltung',
      description: eventData.description || '',
      startDate: eventData.startDate || new Date(),
      startTime: eventData.startTime || '09:00',
      maxVoters: eventData.maxVoters || 50,
      invitationText: eventData.invitationText || 'Sie sind zur Abstimmung eingeladen.',
      showLinkWithCode: eventData.showLinkWithCode || false,
      status: 'draft' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }

    // Nur Enddatum/Endzeit hinzufügen wenn vorhanden
    if (eventData.endDate) {
      event.endDate = eventData.endDate
    }
    if (eventData.endTime) {
      event.endTime = eventData.endTime
    }

    const docRef = await addDoc(collection(db, 'events'), event)
    return docRef.id
  }

  // Erstellt eine neue Wahlfrage für eine Veranstaltung
  static async createQuestion(eventId: string, questionData: Partial<EventQuestion>): Promise<string> {
    const question = {
      eventId,
      question: questionData.question || 'Neue Frage',
      options: questionData.options || [],
      allowInvalidVotes: questionData.allowInvalidVotes || false,
      status: 'draft' as const,
      order: questionData.order || 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }

    const docRef = await addDoc(collection(db, 'eventQuestions'), question)
    return docRef.id
  }

  // Lädt alle Veranstaltungen einer Association
  static async getEvents(associationId: string): Promise<Event[]> {
    const eventsRef = collection(db, 'events')
    const q = query(eventsRef, where('associationId', '==', associationId))
    const querySnapshot = await getDocs(q)
    
    const events: Event[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      events.push({
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate() || new Date(),
        endDate: data.endDate?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Event)
    })
    
    return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  // Lädt alle Fragen einer Veranstaltung
  static async getQuestions(eventId: string): Promise<EventQuestion[]> {
    const questionsRef = collection(db, 'eventQuestions')
    const q = query(questionsRef, where('eventId', '==', eventId))
    const querySnapshot = await getDocs(q)
    
    const questions: EventQuestion[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      questions.push({
        id: doc.id,
        ...data,
        startedAt: data.startedAt?.toDate(),
        closedAt: data.closedAt?.toDate(),
        evaluatedAt: data.evaluatedAt?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as EventQuestion)
    })
    
    return questions.sort((a, b) => a.order - b.order)
  }
}

// Alte Collections können optional bereinigt werden (nur für Testdaten)
export class TestDataCleanup {
  static async cleanupOldTestData(): Promise<void> {
    console.log('Cleaning up old test data...')
    
    try {
      // Alte Collections leeren (nur wenn sicher dass es Testdaten sind)
      const oldCollections = [
        'elections',
        'electionQuestions', 
        'votes',
        'voterCodes'
      ]
      
      for (const collectionName of oldCollections) {
        const collectionRef = collection(db, collectionName)
        const snapshot = await getDocs(collectionRef)
        
        const batch = writeBatch(db)
        snapshot.forEach((doc) => {
          batch.delete(doc.ref)
        })
        
        if (snapshot.size > 0) {
          await batch.commit()
          console.log(`Deleted ${snapshot.size} documents from ${collectionName}`)
        }
      }
      
      console.log('Old test data cleanup completed')
      
    } catch (error) {
      console.error('Error cleaning up old test data:', error)
    }
  }
}
