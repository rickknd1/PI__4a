import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Force withCredentials: true sur toutes les requetes HTTP afin que le navigateur
 * envoie le cookie jwt pose par le module User.
 *
 * Redirige vers /treasury/login en cas de 401 SAUF si on est deja sur /login
 * (evite boucle infinie quand refreshFromServer() echoue).
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const cloned = req.clone({ withCredentials: true });

  return next(cloned).pipe(
    catchError((err) => {
      if (err?.status === 401 && !router.url.includes('/signin') && !router.url.includes('/login')) {
        router.navigateByUrl('/signin');
      }
      return throwError(() => err);
    })
  );
};
