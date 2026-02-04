export interface BallotTemplate {
  logoUrl?: string
  headerText?: string
  footerText?: string
  backgroundColor?: string
  textColor?: string
  showLogo?: boolean
  showHeader?: boolean
  showFooter?: boolean
  customStyles?: string
  richContent?: string
}

export interface Association {
  id: string
  vereinsNummer: string
  name: string
  address?: string
  email?: string
  phone?: string
  ballotTemplate?: BallotTemplate
  createdAt: Date
  updatedAt: Date
}

export interface Event {
  id: string
  associationId: string
  title: string
  description: string
  startDate: Date
  endDate?: Date
  startTime: string
  endTime?: string
  maxVoters: number
  invitationText?: string
  showLinkWithCode: boolean
  status: 'draft' | 'active' | 'closed' | 'evaluated'
  templateId?: string
  createdAt: Date
  updatedAt: Date
}

export interface EventQuestion {
  id: string
  eventId: string
  question: string
  options: QuestionOption[]
  allowInvalidVotes: boolean
  status: 'draft' | 'active' | 'closed' | 'evaluated'
  startedAt?: Date
  closedAt?: Date
  evaluatedAt?: Date
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface QuestionOption {
  id: string
  text: string
  order: number
}

export interface VoterCode {
  id: string
  eventId: string
  code: string
  votedQuestions: string[]
  createdAt: Date
}

export interface Vote {
  id: string
  eventId: string
  questionId: string
  optionId: string | null
  isInvalid: boolean
  votedAt: Date
}

export interface EventResult {
  eventId: string
  title: string
  questions: QuestionResult[]
  totalVoters: number
  evaluatedAt: Date
}

export interface QuestionResult {
  questionId: string
  question: string
  totalVotes: number
  invalidVotes: number
  options: OptionResult[]
}

export interface OptionResult {
  optionId: string
  text: string
  votes: number
  percentage: number
}
