import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RoleEventsService {
  // Événement émis quand un rôle est créé, modifié ou supprimé
  private roleChangedSubject = new Subject<void>();
  public roleChanged$ = this.roleChangedSubject.asObservable();

  /**
   * Notifie que les rôles ont changé
   */
  notifyRoleChanged(): void {
    console.log('📢 Notification: Les rôles ont changé');
    this.roleChangedSubject.next();
  }
}