package com.clubhub.treasury.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Helper statique pour recuperer l'utilisateur courant depuis n'importe quel
 * service ou controller, sans avoir a injecter HttpServletRequest.
 */
public final class CurrentUser {

    private CurrentUser() {}

    public static String email() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null ? (String) a.getPrincipal() : null;
    }

    public static String userId() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null ? (String) a.getDetails() : null;
    }

    public static String role() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null) return null;
        return a.getAuthorities().stream()
            .findFirst()
            .map(g -> g.getAuthority().replaceFirst("^ROLE_", ""))
            .orElse(null);
    }

    public static boolean hasRole(String role) {
        return role.equals(role());
    }
}
