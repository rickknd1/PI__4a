import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, switchMap, take } from 'rxjs';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/treasury.models';

/**
 * Guard generique. Si pas de user en memoire, tente un refresh via cookie.
 * Si toujours rien, redirige vers login.
 */
export const authGuard = (allowedRoles: UserRole[] = []): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.user$.pipe(
      take(1),
      switchMap((user) => {
        if (user) return of(user);
        // Pas en memoire — essaie le cookie
        return auth.refreshFromServer();
      }),
      map((user) => {
        if (!user) {
          router.navigateByUrl('/signin');
          return false;
        }
        if (allowedRoles.length === 0) return true;
        if (allowedRoles.includes(user.role)) return true;

        // Safety break : if we're already trying to land on espace-membre,
        // don't redirect there again — that's how we used to crash the tab
        // when the role didn't match the allowed list AND was not a member
        // alias either. Letting the user through prevents the freeze; the
        // page itself will render a "not authorized" state.
        const target = router.routerState.snapshot.url;
        if (target === '/treasury/espace-membre') return true;

        router.navigateByUrl('/treasury/espace-membre');
        return false;
      })
    );
  };
};
