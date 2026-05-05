// Ajoutez ces nouvelles interfaces
export interface Position {
  id?: string;
  title: string;           // "PRESIDENT", "SECRETARY", "TREASURER", "MEMBER"
  description: string;
  maxCandidates: number;
  requiredSubGroups: string[];
  candidates: string[];
}

export interface Candidate {
  userId: string;
  name: string;
  email: string;           // ← AJOUTER (important)
  manifesto: string;
  status: string;
  applicationDate?: Date;
  
  // NOUVEAUX CHAMPS pour les candidatures avancées
  positionId?: string;
  subGroupTarget?: string;
  yearsInClub?: number;
  isActiveMember?: boolean;
  motivation?: string;
  cvUrl?: string;
  skills?: string[];
  conditionsAccepted?: boolean;
  rejectionReason?: string;
}

export interface Vote {
  voterId: string;
  candidateId: string;
  voteDate?: Date;
}

export interface ElectionResults {
  totalVotes: number;
  voteCount: { [key: string]: number };
  winnerId: string;
  calculatedAt: Date;
}

export interface ElectionLocation {
  address: string;
  latitude: number;
  longitude: number;
  placeName?: string;
}

export interface Election {
  id?: string;
  clubId: string;
  title: string;
  description: string;
  type: string;
  electionType: string;
  votingMode?: string;
  startDate: Date;
  endDate: Date;
  status: string;
  anonymous: boolean;
  candidates: Candidate[];
  votes: Vote[];
  results?: ElectionResults;
  positions?: Position[];
  location?: ElectionLocation;
}

// NOUVELLES INTERFACES
export interface EligibilityCriteria {
  electionType: string;
  minYearsInClub?: number;
  mustBeActive?: boolean;
  mustBeApproved?: boolean;
  mustBeInSubGroup?: boolean;
  description: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}