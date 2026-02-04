// Automatische Datenlöschung nach 24 Stunden für Veranstaltungen und Wahlfragen
// Stellt sicher, dass keine Daten länger als erlaubt gespeichert bleiben

import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, deleteDoc, doc, writeBatch, Timestamp } from 'firebase/firestore'
import { Event, EventQuestion } from '@/types'

export class DataCleanupService {
  private static readonly CLEANUP_INTERVAL_HOURS = 1 // Alle Stunden prüfen
  private static readonly RETENTION_HOURS = 24 // 24 Stunden Aufbewahrung
  
  // Startet den automatischen Cleanup-Prozess
  static startAutomaticCleanup(): () => void {
    console.log('Starting automatic data cleanup service...')
    
    // Sofort ausführen
    this.performCleanup()
    
    // Regelmäßig ausführen
    const interval = setInterval(() => {
      this.performCleanup()
    }, this.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000)
    
    // Cleanup-Funktion zurückgeben
    return () => {
      clearInterval(interval)
      console.log('Stopped automatic data cleanup service')
    }
  }
  
  // Führt den eigentlichen Cleanup durch
  static async performCleanup(): Promise<void> {
    try {
      console.log('Performing data cleanup...')
      
      const cleanupStats = {
        eventsProcessed: 0,
        eventsDeleted: 0,
        questionsProcessed: 0,
        questionsDeleted: 0,
        votesDeleted: 0,
        voterCodesDeleted: 0,
        errors: [] as string[]
      }
      
      // 1. Veranstaltungen prüfen und bereinigen
      await this.cleanupEvents(cleanupStats)
      
      // 2. Wahlfragen prüfen und bereinigen  
      await this.cleanupQuestions(cleanupStats)
      
      // 3. Verwaiste Daten bereinigen (Votes/Codes ohne Event)
      await this.cleanupOrphanedData(cleanupStats)
      
      // 4. Audit-Logs für Cleanup erstellen
      await this.logCleanupResults(cleanupStats)
      
      console.log('Data cleanup completed:', cleanupStats)
      
    } catch (error) {
      console.error('Data cleanup failed:', error)
    }
  }
  
  // Bereinigt Veranstaltungen und deren zugehörige Daten
  private static async cleanupEvents(stats: any): Promise<void> {
    const eventsRef = collection(db, 'events')
    const eventsSnapshot = await getDocs(eventsRef)
    
    for (const eventDoc of eventsSnapshot.docs) {
      stats.eventsProcessed++
      
      try {
        const event = eventDoc.data() as Event
        const now = new Date()
        
        // Prüfen ob Veranstaltung bereinigt werden muss
        if (this.shouldCleanupEvent(event, now)) {
          await this.deleteEventData(eventDoc.id, stats)
          stats.eventsDeleted++
        }
      } catch (error) {
        stats.errors.push(`Error processing event ${eventDoc.id}: ${error}`)
      }
    }
  }
  
  // Bereinigt einzelne Wahlfragen
  private static async cleanupQuestions(stats: any): Promise<void> {
    const questionsRef = collection(db, 'eventQuestions')
    const questionsSnapshot = await getDocs(questionsRef)
    
    for (const questionDoc of questionsSnapshot.docs) {
      stats.questionsProcessed++
      
      try {
        const question = questionDoc.data() as EventQuestion
        const now = new Date()
        
        // Prüfen ob Frage bereinigt werden muss
        if (this.shouldCleanupQuestion(question, now)) {
          await this.deleteQuestionData(questionDoc.id, stats)
          stats.questionsDeleted++
        }
      } catch (error) {
        stats.errors.push(`Error processing question ${questionDoc.id}: ${error}`)
      }
    }
  }
  
  // Prüft ob eine Veranstaltung bereinigt werden sollte
  private static shouldCleanupEvent(event: Event, now: Date): boolean {
    // Nur bereinigen wenn Veranstaltung geschlossen oder ausgewertet
    if (event.status !== 'closed' && event.status !== 'evaluated') {
      return false
    }
    
    // Letzte Änderung finden (updatedAt oder spezifische Timestamps)
    const lastChange = event.updatedAt
    
    // Prüfen ob 24 Stunden vergangen sind
    const hoursSinceChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60)
    
    return hoursSinceChange >= this.RETENTION_HOURS
  }
  
  // Prüft ob eine Frage bereinigt werden sollte
  private static shouldCleanupQuestion(question: EventQuestion, now: Date): boolean {
    // Nur bereinigen wenn Frage geschlossen oder ausgewertet
    if (question.status !== 'closed' && question.status !== 'evaluated') {
      return false
    }
    
    // Relevanten Timestamp finden
    const relevantTimestamp = question.closedAt || question.evaluatedAt || question.updatedAt
    
    // Prüfen ob 24 Stunden vergangen sind
    const hoursSinceChange = (now.getTime() - relevantTimestamp.getTime()) / (1000 * 60 * 60)
    
    return hoursSinceChange >= this.RETENTION_HOURS
  }
  
  // Löscht alle Daten einer Veranstaltung
  private static async deleteEventData(eventId: string, stats: any): Promise<void> {
    const batch = writeBatch(db)
    
    try {
      // 1. Alle Votes der Veranstaltung löschen
      const votesRef = collection(db, 'votes')
      const votesQuery = query(votesRef, where('eventId', '==', eventId))
      const votesSnapshot = await getDocs(votesQuery)
      
      votesSnapshot.forEach((voteDoc) => {
        batch.delete(doc(db, 'votes', voteDoc.id))
        stats.votesDeleted++
      })
      
      // 2. Alle Voter-Codes der Veranstaltung löschen
      const codesRef = collection(db, 'voterCodes')
      const codesQuery = query(codesRef, where('eventId', '==', eventId))
      const codesSnapshot = await getDocs(codesQuery)
      
      codesSnapshot.forEach((codeDoc) => {
        batch.delete(doc(db, 'voterCodes', codeDoc.id))
        stats.voterCodesDeleted++
      })
      
      // 3. Alle Fragen der Veranstaltung löschen
      const questionsRef = collection(db, 'eventQuestions')
      const questionsQuery = query(questionsRef, where('eventId', '==', eventId))
      const questionsSnapshot = await getDocs(questionsQuery)
      
      questionsSnapshot.forEach((questionDoc) => {
        batch.delete(doc(db, 'eventQuestions', questionDoc.id))
        stats.questionsDeleted++
      })
      
      // 4. Die Veranstaltung selbst löschen
      batch.delete(doc(db, 'events', eventId))
      
      // Batch ausführen
      await batch.commit()
      
      console.log(`Successfully deleted event ${eventId} and all related data`)
      
    } catch (error) {
      console.error(`Error deleting event ${eventId}:`, error)
      throw error
    }
  }
  
  // Löscht alle Daten einer Frage
  private static async deleteQuestionData(questionId: string, stats: any): Promise<void> {
    const batch = writeBatch(db)
    
    try {
      // 1. Alle Votes für diese Frage löschen
      const votesRef = collection(db, 'votes')
      const votesQuery = query(votesRef, where('questionId', '==', questionId))
      const votesSnapshot = await getDocs(votesQuery)
      
      votesSnapshot.forEach((voteDoc) => {
        batch.delete(doc(db, 'votes', voteDoc.id))
        stats.votesDeleted++
      })
      
      // 2. Die Frage selbst löschen
      batch.delete(doc(db, 'eventQuestions', questionId))
      
      // Batch ausführen
      await batch.commit()
      
      console.log(`Successfully deleted question ${questionId} and related votes`)
      
    } catch (error) {
      console.error(`Error deleting question ${questionId}:`, error)
      throw error
    }
  }
  
  // Bereinigt verwaiste Daten (Votes/Codes ohne existierende Events)
  private static async cleanupOrphanedData(stats: any): Promise<void> {
    try {
      // Alle Event-IDs sammeln
      const eventsRef = collection(db, 'events')
      const eventsSnapshot = await getDocs(eventsRef)
      const eventIds = new Set(eventsSnapshot.docs.map(doc => doc.id))
      
      // Verwaiste Votes finden und löschen
      await this.cleanupOrphanedVotes(eventIds, stats)
      
      // Verwaiste Voter-Codes finden und löschen
      await this.cleanupOrphanedVoterCodes(eventIds, stats)
      
    } catch (error) {
      stats.errors.push(`Error in orphaned data cleanup: ${error}`)
    }
  }
  
  // Bereinigt verwaiste Votes
  private static async cleanupOrphanedVotes(eventIds: Set<string>, stats: any): Promise<void> {
    const votesRef = collection(db, 'votes')
    const votesSnapshot = await getDocs(votesRef)
    
    for (const voteDoc of votesSnapshot.docs) {
      const vote = voteDoc.data()
      
      if (!eventIds.has(vote.eventId)) {
        await deleteDoc(doc(db, 'votes', voteDoc.id))
        stats.votesDeleted++
      }
    }
  }
  
  // Bereinigt verwaiste Voter-Codes
  private static async cleanupOrphanedVoterCodes(eventIds: Set<string>, stats: any): Promise<void> {
    const codesRef = collection(db, 'voterCodes')
    const codesSnapshot = await getDocs(codesRef)
    
    for (const codeDoc of codesSnapshot.docs) {
      const code = codeDoc.data()
      
      if (!eventIds.has(code.eventId)) {
        await deleteDoc(doc(db, 'voterCodes', codeDoc.id))
        stats.voterCodesDeleted++
      }
    }
  }
  
  // Erstellt Audit-Logs für den Cleanup
  private static async logCleanupResults(stats: any): Promise<void> {
    try {
      const auditLog = {
        action: 'automatic_cleanup',
        timestamp: Timestamp.now(),
        stats,
        retentionHours: this.RETENTION_HOURS,
        cleanupInterval: this.CLEANUP_INTERVAL_HOURS
      }
      
      // In Audit-Logs Collection speichern
      await this.saveAuditLog(auditLog)
      
    } catch (error) {
      console.error('Error logging cleanup results:', error)
    }
  }
  
  // Speichert einen Audit-Log
  private static async saveAuditLog(logData: any): Promise<void> {
    try {
      const logsRef = collection(db, 'auditLogs')
      // Hier würden wir den Log speichern, aber für jetzt nur console.log
      console.log('Audit log:', logData)
    } catch (error) {
      console.error('Error saving audit log:', error)
    }
  }
  
  // Manuelles Cleanup für eine bestimmte Veranstaltung
  static async cleanupEventManually(eventId: string): Promise<void> {
    try {
      console.log(`Manually cleaning up event: ${eventId}`)
      
      const stats = {
        eventsProcessed: 1,
        eventsDeleted: 0,
        questionsProcessed: 0,
        questionsDeleted: 0,
        votesDeleted: 0,
        voterCodesDeleted: 0,
        errors: [] as string[]
      }
      
      await this.deleteEventData(eventId, stats)
      
      console.log('Manual cleanup completed:', stats)
      
    } catch (error) {
      console.error('Manual cleanup failed:', error)
      throw error
    }
  }
  
  // Prüft wann eine Veranstaltung/Frage gelöscht wird
  static getDeletionTimestamp(entity: Event | EventQuestion): Date | null {
    const now = new Date()
    
    if ('status' in entity) {
      // Event
      const event = entity as Event
      if (event.status === 'closed' || event.status === 'evaluated') {
        const deletionTime = new Date(event.updatedAt.getTime() + this.RETENTION_HOURS * 60 * 60 * 1000)
        return deletionTime > now ? deletionTime : null
      }
    } else {
      // Question
      const question = entity as EventQuestion
      if (question.status === 'closed' || question.status === 'evaluated') {
        const relevantTimestamp = question.closedAt || question.evaluatedAt || question.updatedAt
        const deletionTime = new Date(relevantTimestamp.getTime() + this.RETENTION_HOURS * 60 * 60 * 1000)
        return deletionTime > now ? deletionTime : null
      }
    }
    
    return null
  }
  
  // Formatiert verbleibende Zeit für Anzeige
  static formatRemainingTime(deletionTime: Date): string {
    const now = new Date()
    const remaining = deletionTime.getTime() - now.getTime()
    
    if (remaining <= 0) {
      return 'Löschen fällig'
    }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
    
    return `${hours}h ${minutes}m ${seconds}s`
  }
}
