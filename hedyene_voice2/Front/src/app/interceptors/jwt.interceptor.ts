import { HttpInterceptorFn } from '@angular/common/http';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  // Clone la requête avec withCredentials pour envoyer le cookie automatiquement
  const cloned = req.clone({
    withCredentials: true
  });
  return next(cloned);
};