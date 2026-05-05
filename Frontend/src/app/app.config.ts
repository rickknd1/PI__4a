import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideCharts } from 'ng2-charts';
import { routes } from './app.routes';
import { jwtInterceptor } from './interceptors/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Un seul provideHttpClient — avec intercepteur JWT (ne pas le dupliquer dans main.ts).
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideCharts(),
  ],
};
