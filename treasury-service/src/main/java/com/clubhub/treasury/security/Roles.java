package com.clubhub.treasury.security;

/**
 * Constantes de roles + expressions SpEL pretes pour @PreAuthorize.
 *
 * Source de verite des roles: enum esprit.com.clubhub.entity.Role (module User).
 *  PRESIDENT, VICE_PRESIDENT, SECRETAIRE_GENERALE, TRESORIER, RH, MEMBRE_SIMPLE
 *
 * Mapping metier (decide pour le module Tresorerie):
 *  - TRESORIER : full back-office (CRUD, validate, refund, audit)
 *  - PRESIDENT / VICE_PRESIDENT / SECRETAIRE_GENERALE : lecture rapports + validation N2 depenses
 *  - RH : lecture seule
 *  - MEMBRE_SIMPLE : front-office uniquement (payer cotisation, soumettre depense, ses notifs)
 *
 * Usage:
 *   @PreAuthorize(Roles.TRESORIER_ONLY)
 *   @PreAuthorize(Roles.BUREAU_OR_TRESORIER)
 */
public final class Roles {

    private Roles() {}

    public static final String PRESIDENT           = "PRESIDENT";
    public static final String VICE_PRESIDENT      = "VICE_PRESIDENT";
    public static final String SECRETAIRE_GENERALE = "SECRETAIRE_GENERALE";
    public static final String TRESORIER           = "TRESORIER";
    public static final String RH                  = "RH";
    public static final String MEMBRE_SIMPLE       = "MEMBRE_SIMPLE";

    // ── Expressions SpEL pour @PreAuthorize ─────────────────────────────────

    /** Tresorier uniquement — actions sensibles (refund, validate, etc.) */
    public static final String TRESORIER_ONLY =
        "hasRole('TRESORIER')";

    /** Bureau (tous les roles non MEMBRE_SIMPLE et non RH) + Tresorier */
    public static final String BUREAU_OR_TRESORIER =
        "hasAnyRole('TRESORIER','PRESIDENT','VICE_PRESIDENT','SECRETAIRE_GENERALE')";

    /** Lecture rapports/dashboard — tout le bureau + RH */
    public static final String READ_REPORTS =
        "hasAnyRole('TRESORIER','PRESIDENT','VICE_PRESIDENT','SECRETAIRE_GENERALE','RH')";

    /** Validation N2 des depenses — president/VP/SG (apres validation N1 du tresorier) */
    public static final String APPROVE_EXPENSES =
        "hasAnyRole('PRESIDENT','VICE_PRESIDENT','SECRETAIRE_GENERALE')";

    /** Membre simple — actions front-office personnelles */
    public static final String MEMBRE_ONLY =
        "hasRole('MEMBRE_SIMPLE')";

    /** N'importe quel utilisateur authentifie */
    public static final String AUTHENTICATED =
        "isAuthenticated()";
}
