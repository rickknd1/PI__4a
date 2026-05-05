package esprit.com.clubhub.entity;

/**
 * Mode d'appartenance aux comités pour un club
 */
public enum CommitteeMembershipMode {
    /**
     * Un membre peut appartenir à plusieurs comités à la fois
     */
    MULTIPLE_ALLOWED,
    
    /**
     * Un membre ne peut appartenir qu'à un seul comité à la fois
     */
    SINGLE_ONLY
}
