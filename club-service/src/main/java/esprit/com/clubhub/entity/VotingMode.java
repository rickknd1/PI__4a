package esprit.com.clubhub.entity;

/**
 * Mode de vote pour les élections de bureau
 */
public enum VotingMode {
    /**
     * OPTION 1: Tous les membres du club peuvent voter pour tous les comités
     * - Tous les membres du club peuvent voter
     * - Un membre peut voter pour TOUS les comités
     * - Un membre ne peut voter qu'UNE SEULE FOIS par comité
     */
    ALL_CLUB_MEMBERS,
    
    /**
     * OPTION 2: Seuls les membres du comité peuvent voter
     * - Seuls les membres du comité concerné peuvent voter
     * - Chaque membre vote uniquement pour SON comité
     * - Un membre de plusieurs comités peut voter pour chaque comité dont il est membre
     */
    COMMITTEE_MEMBERS_ONLY
}
