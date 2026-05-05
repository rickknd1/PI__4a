package esprit.com.clubhub.entity;

public enum Permission {
    // Gestion des membres
    VIEW_MEMBERS("Voir les membres"),
    ADD_MEMBERS("Ajouter des membres"),
    EDIT_MEMBERS("Modifier les membres"),
    DELETE_MEMBERS("Supprimer des membres"),
    APPROVE_MEMBERS("Approuver les membres"),
    
    // Gestion des sous-groupes
    VIEW_SUBGROUPS("Voir les sous-groupes"),
    CREATE_SUBGROUPS("Créer des sous-groupes"),
    EDIT_SUBGROUPS("Modifier les sous-groupes"),
    DELETE_SUBGROUPS("Supprimer des sous-groupes"),
    ASSIGN_TO_SUBGROUPS("Assigner aux sous-groupes"),
    
    // Gestion des élections
    VIEW_ELECTIONS("Voir les élections"),
    CREATE_ELECTIONS("Créer des élections"),
    EDIT_ELECTIONS("Modifier les élections"),
    DELETE_ELECTIONS("Supprimer des élections"),
    VOTE_ELECTIONS("Voter aux élections"),
    
    // Gestion du club
    VIEW_CLUB_INFO("Voir les infos du club"),
    EDIT_CLUB_INFO("Modifier les infos du club"),
    DELETE_CLUB("Supprimer le club"),
    
    // Gestion des événements
    VIEW_EVENTS("Voir les événements"),
    CREATE_EVENTS("Créer des événements"),
    EDIT_EVENTS("Modifier les événements"),
    DELETE_EVENTS("Supprimer des événements"),
    
    // Gestion des canaux vocaux
    VIEW_VOICE_CHANNELS("Voir les canaux vocaux"),
    CREATE_VOICE_CHANNELS("Créer des canaux vocaux"),
    EDIT_VOICE_CHANNELS("Modifier les canaux vocaux"),
    DELETE_VOICE_CHANNELS("Supprimer des canaux vocaux"),
    JOIN_VOICE_CHANNELS("Rejoindre les canaux vocaux"),
    
    // Gestion des rapports
    VIEW_REPORTS("Voir les rapports"),
    CREATE_REPORTS("Créer des rapports"),
    REVIEW_REPORTS("Examiner les rapports"),
    
    // Administration
    MANAGE_ROLES("Gérer les rôles"),
    VIEW_ANALYTICS("Voir les statistiques");

    private final String description;

    Permission(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
