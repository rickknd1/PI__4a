export interface Member {
    userId: string;
    email: string;
    name: string;
    role: string;
    subGroupId: string | null;
    subGroupRole?: string;   // RESPONSABLE, MEMBRE_COMITE
    status: string;
    joinedDate: Date;
  }
  
  export interface SubGroup {
    id?: string;
    name: string;
    description: string;
    memberIds: string[];
    responsableId?: string;  // ✅ ID du responsable du comité
    memberRoles?: { [userId: string]: string };  // ✅ userId -> "MEMBRE_COMITE" ou "RESPONSABLE"
  }
  
  // ✅ NOUVEAU: Mode d'appartenance aux comités
  export enum CommitteeMembershipMode {
    MULTIPLE_ALLOWED = 'MULTIPLE_ALLOWED',  // Plusieurs comités autorisés
    SINGLE_ONLY = 'SINGLE_ONLY'             // Un seul comité par membre
  }
  
  export interface ClubRules {
    about: string;
    rules: string[];
    requiresApproval: boolean;
    committeeMembershipMode?: CommitteeMembershipMode;  // ✅ NOUVEAU
  }
  
  export interface Club {
    id?: string;
    name: string;
    description: string;
    category: string;
    visibility: string;
    creationDate?: Date;
    createdBy?: string;
    logoUrl?: string;
    colorPalette?: string;
    rules?: ClubRules;
    members: Member[];
    subGroups: SubGroup[];
  }
  
  export interface SubGroupRecommendation {
    subGroupId: string;
    subGroupName: string;
    suggestedRole: string;
    reason: string;
  }