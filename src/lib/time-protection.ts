// Zeitmanipulation-Schutz für Veranstaltungen und Wahlfragen
// Verhindert rückdatierte Änderungen und stellt Integrität sicher

import { Timestamp } from 'firebase/firestore'
import { Event, EventQuestion } from '@/types'

export class TimeManipulationProtection {
  // Prüft ob eine Status-Änderung erlaubt ist
  static canChangeStatus(
    currentStatus: string, 
    newStatus: string, 
    startedAt?: Date, 
    closedAt?: Date,
    evaluatedAt?: Date
  ): { allowed: boolean; reason?: string } {
    
    // Status-Flow-Reihenfolge: draft -> active -> closed -> evaluated
    const statusFlow = ['draft', 'active', 'closed', 'evaluated']
    const currentIndex = statusFlow.indexOf(currentStatus)
    const newIndex = statusFlow.indexOf(newStatus)
    
    // 1. Prüfung: Status darf nur vorwärts im Flow gehen
    if (newIndex < currentIndex) {
      return { 
        allowed: false, 
        reason: 'Status darf nicht rückwärts geändert werden' 
      }
    }
    
    // 2. Prüfung: Einmal gestartet kann nicht mehr bearbeitet werden
    if (startedAt && newStatus === 'draft') {
      return { 
        allowed: false, 
        reason: 'Einmal gestartete Fragen können nicht mehr bearbeitet werden' 
      }
    }
    
    // 3. Prüfung: Einmal geschlossen kann nicht wieder aktiviert werden
    if (closedAt && newStatus === 'active') {
      return { 
        allowed: false, 
        reason: 'Geschlossene Fragen können nicht wieder aktiviert werden' 
      }
    }
    
    // 4. Prüfung: Einmal ausgewertet kann nichts mehr geändert werden
    if (evaluatedAt && newStatus !== 'evaluated') {
      return { 
        allowed: false, 
        reason: 'Ausgewertete Fragen können nicht mehr geändert werden' 
      }
    }
    
    return { allowed: true }
  }
  
  // Erstellt unveränderliche Timestamps für Status-Änderungen
  static createStatusTimestamps(
    newStatus: string,
    existingTimestamps?: {
      startedAt?: Date
      closedAt?: Date
      evaluatedAt?: Date
    }
  ): {
    startedAt?: Date
    closedAt?: Date
    evaluatedAt?: Date
  } {
    const now = new Date()
    const timestamps = { ...existingTimestamps }
    
    // Nur bei Status-Wechsel den entsprechenden Timestamp setzen
    switch (newStatus) {
      case 'active':
        if (!timestamps.startedAt) {
          timestamps.startedAt = now
        }
        break
      case 'closed':
        if (!timestamps.closedAt) {
          timestamps.closedAt = now
        }
        break
      case 'evaluated':
        if (!timestamps.evaluatedAt) {
          timestamps.evaluatedAt = now
        }
        break
    }
    
    return timestamps
  }
  
  // Validiert eine Event-Änderung auf Zeitmanipulation
  static validateEventChange(
    originalEvent: Event,
    updatedEvent: Partial<Event>
  ): { valid: boolean; reason?: string } {
    
    // 1. Prüfung: Startdatum darf nicht in die Vergangenheit verschoben werden
    if (updatedEvent.startDate) {
      const originalStart = originalEvent.startDate
      const newStart = updatedEvent.startDate
      
      if (newStart < originalStart) {
        return { 
          valid: false, 
          reason: 'Startdatum darf nicht rückdatiert werden' 
        }
      }
    }
    
    // 2. Prüfung: Wenn Veranstaltung aktiv ist, dürfen keine grundlegenden Änderungen erfolgen
    if (originalEvent.status === 'active') {
      const restrictedFields = ['startDate', 'startTime', 'maxVoters']
      for (const field of restrictedFields) {
        if (updatedEvent[field as keyof Event] !== undefined) {
          return { 
            valid: false, 
            reason: `Feld "${field}" darf bei aktiver Veranstaltung nicht geändert werden` 
          }
        }
      }
    }
    
    // 3. Prüfung: Wenn Veranstaltung geschlossen ist, darf nichts mehr geändert werden
    if (originalEvent.status === 'closed' || originalEvent.status === 'evaluated') {
      const allowedFields = ['status'] // Nur Status-Änderungen zu 'evaluated' erlauben
      for (const [key, value] of Object.entries(updatedEvent)) {
        if (!allowedFields.includes(key)) {
          return { 
            valid: false, 
            reason: `Geschlossene Veranstaltungen dürfen nicht mehr geändert werden` 
          }
        }
      }
    }
    
    return { valid: true }
  }
  
  // Validiert eine Frage-Änderung auf Zeitmanipulation
  static validateQuestionChange(
    originalQuestion: EventQuestion,
    updatedQuestion: Partial<EventQuestion>
  ): { valid: boolean; reason?: string } {
    
    // 1. Prüfung: Einmal gestartet darf nicht mehr bearbeitet werden
    if (originalQuestion.status === 'active' || originalQuestion.startedAt) {
      const allowedFields = ['status'] // Nur Status-Änderungen erlauben
      for (const [key, value] of Object.entries(updatedQuestion)) {
        if (!allowedFields.includes(key)) {
          return { 
            valid: false, 
            reason: 'Aktive Fragen dürfen nicht mehr bearbeitet werden' 
          }
        }
      }
    }
    
    // 2. Prüfung: Einmal geschlossen darf nichts mehr geändert werden
    if (originalQuestion.status === 'closed' || originalQuestion.closedAt) {
      const allowedFields = ['status'] // Nur zu 'evaluated'
      for (const [key, value] of Object.entries(updatedQuestion)) {
        if (!allowedFields.includes(key)) {
          return { 
            valid: false, 
            reason: 'Geschlossene Fragen dürfen nicht mehr geändert werden' 
          }
        }
      }
    }
    
    // 3. Prüfung: Einmal ausgewertet darf nichts mehr geändert werden
    if (originalQuestion.status === 'evaluated' || originalQuestion.evaluatedAt) {
      return { 
        valid: false, 
        reason: 'Ausgewertete Fragen dürfen nicht mehr geändert werden' 
      }
    }
    
    return { valid: true }
  }
  
  // Erstellt einen Audit-Log-Eintrag für wichtige Änderungen
  static createAuditLog(
    action: string,
    entityType: 'event' | 'question',
    entityId: string,
    userId: string,
    changes: Record<string, any>,
    timestamp: Date = new Date()
  ) {
    return {
      action,
      entityType,
      entityId,
      userId,
      changes,
      timestamp: Timestamp.fromDate(timestamp),
      clientTimestamp: timestamp.toISOString(), // Client-Zeit als Referenz
      serverTimestamp: Timestamp.now() // Server-Zeit als Wahrheitsquelle
    }
  }
  
  // Prüft auf verdächtige Zeit-Abweichungen
  static detectTimeAnomalies(
    clientTimestamp: Date,
    serverTimestamp: Date,
    maxDeviationMinutes: number = 5
  ): { suspicious: boolean; deviation: number } {
    
    const deviation = Math.abs(
      clientTimestamp.getTime() - serverTimestamp.getTime()
    ) / (1000 * 60) // in Minuten
    
    return {
      suspicious: deviation > maxDeviationMinutes,
      deviation
    }
  }
}

// Hilfsfunktion für sichere Status-Änderungen
export async function safeStatusChange(
  currentEntity: Event | EventQuestion,
  newStatus: string,
  userId: string
): Promise<{ 
  success: boolean; 
  reason?: string; 
  auditLog?: any;
  updatedData?: any;
}> {
  
  const startedAt = 'startedAt' in currentEntity ? currentEntity.startedAt : undefined
  const closedAt = 'closedAt' in currentEntity ? currentEntity.closedAt : undefined
  const evaluatedAt = 'evaluatedAt' in currentEntity ? currentEntity.evaluatedAt : undefined
  
  // 1. Prüfen ob Status-Änderung erlaubt ist
  const statusCheck = TimeManipulationProtection.canChangeStatus(
    currentEntity.status,
    newStatus,
    startedAt,
    closedAt,
    evaluatedAt
  )
  
  if (!statusCheck.allowed) {
    return { success: false, reason: statusCheck.reason }
  }
  
  // 2. Neue Timestamps erstellen
  const newTimestamps = TimeManipulationProtection.createStatusTimestamps(
    newStatus,
    { startedAt, closedAt, evaluatedAt }
  )
  
  // 3. Audit-Log erstellen
  const auditLog = TimeManipulationProtection.createAuditLog(
    'status_change',
    'event' in currentEntity ? 'event' : 'question',
    currentEntity.id,
    userId,
    {
      oldStatus: currentEntity.status,
      newStatus,
      timestamps: newTimestamps
    }
  )
  
  return { 
    success: true, 
    auditLog,
    updatedData: {
      status: newStatus,
      ...newTimestamps,
      updatedAt: new Date()
    }
  }
}
