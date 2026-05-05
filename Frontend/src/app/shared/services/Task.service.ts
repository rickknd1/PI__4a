// src/app/shared/services/Task.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Task, TaskCompletionPayload } from '../interfaces/task.interface';
import { apiUrl } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private baseUrl = apiUrl('/api/tasks');

  constructor(private http: HttpClient) {}

  // Récupérer TOUTES les tâches (sans filtre)
  getAllTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.baseUrl);
  }

  // Récupérer les tâches par événement
  getTasksByEvent(eventId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/event/${eventId}`);
  }

  // Récupérer les tâches par utilisateur (pour plus tard avec auth)
  getTasksByUser(userId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/user/${userId}`);
  }

  // Créer une tâche
  createTask(task: Task): Observable<Task> {
    return this.http.post<Task>(this.baseUrl, task);
  }

  // Mettre à jour une tâche
  updateTask(id: string, task: Task): Observable<Task> {
    return this.http.put<Task>(`${this.baseUrl}/${id}`, task);
  }

  // Mettre à jour le statut
  updateStatus(id: string, status: Task['status']): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/${id}/status`, { status });
  }

  // Marquer une tâche comme terminée avec review (outcome + note + raison)
  completeTask(id: string, payload: TaskCompletionPayload): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/${id}/complete`, payload);
  }

  // Supprimer une tâche
  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}