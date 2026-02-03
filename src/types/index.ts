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

export interface Election {
  id: string
  associationId: string
  title: string
  description: string
  electionDate: Date
  maxVoters: number
  invitationText: string
  showLinkWithCode: boolean
  status: 'draft' | 'active' | 'closed' | 'evaluated'
  codesGenerated: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ElectionQuestion {
  id: string
  electionId: string
  question: string
  options: ElectionOption[]
  allowInvalidVotes: boolean
  isActive: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface ElectionOption {
  id: string
  text: string
  order: number
}

export interface VoterCode {
  id: string
  electionId: string
  code: string
  votedQuestions: string[]
  createdAt: Date
}

export interface Vote {
  id: string
  electionId: string
  questionId: string
  optionId: string | null
  isInvalid: boolean
  votedAt: Date
}

export interface ElectionResult {
  electionId: string
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
