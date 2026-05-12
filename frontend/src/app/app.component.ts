import { Component, NgZone, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { ToastService } from './shared/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    ToastContainerComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'ClubHub';

  constructor(private toast: ToastService, private zone: NgZone) {}

  ngOnInit(): void {
    // Override window.alert -> toast in-app.
    // La code base contient ~137 alert() qu'on ne veut plus voir comme popups
    // natifs du navigateur. Plutot que de patcher chaque site, on intercepte
    // l'appel ici. Severite auto-detectee depuis les emojis (❌/✅/⚠️).
    // confirm() et prompt() ne sont PAS interceptes (ils sont synchrones et
    // attendent une reponse user — un toast ne peut pas les remplacer).
    if (typeof window !== 'undefined') {
      window.alert = (msg?: any): void => {
        const text = msg == null ? '' : String(msg);
        const sev = this.toast.guessSeverity(text);
        // L'override peut etre appele depuis du code hors zone Angular
        // (ex: callbacks tiers). On force le rendu dans la zone.
        this.zone.run(() => this.toast.show(text, sev));
      };
    }
  }
}
