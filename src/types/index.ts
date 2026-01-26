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
  question: string
  options: ElectionOption[]
  allowInvalidVotes: boolean
  electionDate: Date
  maxVoters: number
  invitationText: string
  showLinkWithCode: boolean
  status: 'draft' | 'active' | 'closed' | 'evaluated'
  codesGenerated: boolean
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
  hasVoted: boolean
  votedAt?: Date
  createdAt: Date
}

export interface Vote {
  id: string
  electionId: string
  optionId: string | null
  isInvalid: boolean
  votedAt: Date
}

export interface ElectionResult {
  electionId: string
  title: string
  question: string
  totalVoters: number
  totalVotes: number
  invalidVotes: number
  options: OptionResult[]
  evaluatedAt: Date
}

export interface OptionResult {
  optionId: string
  text: string
  votes: number
  percentage: number
}
