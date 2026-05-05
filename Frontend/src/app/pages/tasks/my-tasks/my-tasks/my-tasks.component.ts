// src/app/pages/tasks/my-tasks/my-tasks.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
  DragDropModule,
  CdkDrag,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { TaskService } from '../../../../shared/services/Task.service';
import { Task, TaskCompletionOutcome } from '../../../../shared/interfaces/task.interface';
import { TASK_COMPLETE_NOTE_CHIPS } from '../../../../shared/constants/task-completion-chips';
import { AuthService, StoredUser } from '../../../../shared/services/auth.service';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, CdkDrag, CdkDropList, CdkDropListGroup],
  templateUrl: './my-tasks.component.html',
  styleUrls: ['../../../../shared/styles/all-events-shell.css'],
})
export class MyTasksComponent implements OnInit {
  tasks: Task[] = [];
  loading = false;
  currentUser: StoredUser | null = null;
  notLoggedIn = false;

  readonly columns = [
    { id: 'todo' as const, label: 'To do',       dotClass: 'bg-gray-400' },
    { id: 'in_progress' as const, label: 'In progress',  dotClass: 'bg-blue-400' },
    { id: 'done' as const, label: 'Done',         dotClass: 'bg-green-500' },
  ];

  /** Quick lines for completion note (drag-to-done modal). */
  readonly completeNoteChips = TASK_COMPLETE_NOTE_CHIPS;

  // ── Complete-task review modal ────────────────────────────────────────────
  showCompleteModal = false;
  completingTask: Task | null = null;
  completeOutcome: TaskCompletionOutcome = 'success';
  completeNote = '';
  completeReason = '';
  completeSubmitted = false;
  completeSaving = false;
  completeError = '';
  private pendingRevert: (() => void) | null = null;

  constructor(
    public taskService: TaskService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser?.id) {
      this.notLoggedIn = true;
      return;
    }
    this.loadMyTasks();
  }

  /** Recharge les tâches affectées à l'utilisateur courant. */
  loadAllTasks() {
    this.loadMyTasks();
  }

  /**
   * Récupère uniquement les tâches assignées à l'utilisateur connecté.
   * - Tente d'abord l'endpoint dédié `/api/tasks/user/{userId}`.
   * - En cas d'échec (404, endpoint absent…), fallback : récupère toutes
   *   les tâches puis filtre côté client sur `assignedTo === currentUser.id`.
   */
  loadMyTasks() {
    const userId = this.currentUser?.id;
    if (!userId) {
      this.tasks = [];
      this.notLoggedIn = true;
      return;
    }

    this.loading = true;
    this.taskService.getTasksByUser(userId).subscribe({
      next: (tasks: Task[]) => {
        // Filtre défensif : certains backends retournent quand même
        // d'autres tâches si le paramètre n'est pas pris en compte.
        this.tasks = (tasks || []).filter(t => this.isAssignedToCurrentUser(t));
        this.loading = false;
      },
      error: (err: any) => {
        console.warn('[MyTasks] /user/:id failed, fallback to client-side filter:', err);
        // Fallback : filtre côté client sur la liste complète.
        this.taskService.getAllTasks().subscribe({
          next: (tasks: Task[]) => {
            this.tasks = (tasks || []).filter(t => this.isAssignedToCurrentUser(t));
            this.loading = false;
          },
          error: (err2: any) => {
            console.error('[MyTasks] Failed to load tasks:', err2);
            this.tasks = [];
            this.loading = false;
          }
        });
      }
    });
  }

  /** Une tâche appartient au user courant si `assignedTo` matche son id. */
  private isAssignedToCurrentUser(task: Task): boolean {
    const userId = this.currentUser?.id;
    if (!userId || !task?.assignedTo) return false;
    return String(task.assignedTo) === String(userId);
  }

  getColumnTasks(status: 'todo' | 'in_progress' | 'done'): Task[] {
    return this.tasks.filter(t => t.status === status);
  }

  drop(event: CdkDragDrop<Task[]>, newStatus: 'todo' | 'in_progress' | 'done') {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const task = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    const oldStatus = task.status;
    const prevContainerData = event.previousContainer.data;
    const curContainerData  = event.container.data;
    const prevIndex = event.previousIndex;
    const curIndex  = event.currentIndex;
    task.status = newStatus;

    const revert = () => {
      transferArrayItem(curContainerData, prevContainerData, curIndex, prevIndex);
      task.status = oldStatus;
    };

    // Moving TO done → require a structured completion review
    if (newStatus === 'done' && oldStatus !== 'done') {
      this.pendingRevert = revert;
      this.openCompleteModal(task);
      return;
    }

    // Any other transition → simple status update
    this.taskService.updateStatus(task.id!, newStatus).subscribe({
      next: () => {
        if (newStatus !== 'done') {
          task.completionNote = undefined;
          task.completionOutcome = undefined;
          task.completionReason = undefined;
          task.completedAt = undefined;
        }
      },
      error: revert
    });
  }

  // ── Smart complete-task flow ──────────────────────────────────────────────
  openCompleteModal(task: Task): void {
    this.completingTask = task;
    this.completeOutcome = 'success';
    this.completeNote = '';
    this.completeReason = '';
    this.completeSubmitted = false;
    this.completeSaving = false;
    this.completeError = '';
    this.showCompleteModal = true;
  }

  closeCompleteModal(): void {
    this.showCompleteModal = false;
    this.completingTask = null;
    this.completeSubmitted = false;
    this.completeError = '';
    // If the modal was opened because of a drag, undo the drop
    if (this.pendingRevert) {
      this.pendingRevert();
      this.pendingRevert = null;
    }
  }

  isTaskOverdue(task: Task | null): boolean {
    if (!task?.dueDate) return false;
    const due = new Date(task.dueDate); due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  }

  get completeOutcomeError(): string {
    if (!this.completeSubmitted) return '';
    return this.completeOutcome ? '' : 'Please pick an outcome.';
  }
  get completeNoteError(): string {
    if (!this.completeSubmitted) return '';
    const n = (this.completeNote || '').trim();
    if (n.length === 0) return 'Add a short note describing what was done.';
    if (n.length < 5) return 'The note is too short — be a bit more specific.';
    return '';
  }
  get completeReasonError(): string {
    if (!this.completeSubmitted) return '';
    const needsReason = this.completeOutcome !== 'success' || this.isTaskOverdue(this.completingTask);
    if (needsReason && !(this.completeReason || '').trim()) {
      return this.completeOutcome === 'success'
        ? 'This task is overdue — please explain the delay.'
        : 'Please explain why the task was only partial / skipped.';
    }
    return '';
  }

  submitComplete(): void {
    this.completeSubmitted = true;
    if (!this.completingTask?.id) return;
    if (this.completeOutcomeError || this.completeNoteError || this.completeReasonError) return;

    this.completeSaving = true;
    this.completeError = '';
    const payload = {
      outcome: this.completeOutcome,
      note: (this.completeNote || '').trim(),
      reason: (this.completeReason || '').trim() || undefined,
    };
    this.taskService.completeTask(this.completingTask.id, payload).subscribe({
      next: (updated) => {
        Object.assign(this.completingTask!, updated);
        this.completeSaving = false;
        this.showCompleteModal = false;
        this.completingTask = null;
        this.pendingRevert = null; // keep the drop: task is truly done
        this.loadAllTasks();
      },
      error: (err) => {
        this.completeSaving = false;
        this.completeError = err?.error?.error || err?.message || 'Failed to complete the task.';
      }
    });
  }

  appendCompleteNoteChip(text: string): void {
    const cur = (this.completeNote || '').trim();
    this.completeNote = cur ? `${cur}\n${text}` : text;
  }

  get completionPct(): number {
    if (!this.tasks.length) return 0;
    return Math.round(this.tasks.filter(t => t.status === 'done').length / this.tasks.length * 100);
  }

  get overdueTasks(): Task[] {
    const now = new Date(); now.setHours(0,0,0,0);
    return this.tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now);
  }

  get urgentOpenCount(): number {
    return this.tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length;
  }

  getDueDateLabel(task: Task): string {
    if (!task.dueDate) return '';
    const diff = Math.round((new Date(task.dueDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
    if (diff < 0)  return `Overdue ${Math.abs(diff)}d`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getDueDateClass(task: Task): string {
    if (!task.dueDate || task.status === 'done') return 'text-gray-400 dark:text-gray-600';
    const diff = Math.round((new Date(task.dueDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
    if (diff < 0)  return 'text-red-500 font-medium';
    if (diff <= 1) return 'text-orange-500 font-medium';
    return 'text-gray-400';
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'high':   return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default:       return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  }

  getSmartTip(task: Task): string | null {
    if (task.status === 'done') return null;
    if (task.priority === 'urgent') return 'Handle first — blocks other tasks.';
    if (task.priority === 'high' && task.dueDate) {
      const diff = Math.round((new Date(task.dueDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
      if (diff <= 3) return 'Due soon — schedule dedicated time.';
    }
    return null;
  }
}