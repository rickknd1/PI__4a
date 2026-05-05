import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { register as registerSwiperElements } from 'swiper/element/bundle';

// Compat (certaines libs / SockJS) — comme sur la branche intégrée
(window as any).global = window;
registerSwiperElements();

// HttpClient + charts : dans app.config (évite de perdre l’interceptor JWT)
bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));