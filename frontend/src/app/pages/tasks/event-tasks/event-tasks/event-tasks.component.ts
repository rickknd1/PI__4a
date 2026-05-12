// src/app/pages/tasks/event-tasks/event-tasks.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TaskService } from '../../../../shared/services/Task.service';
import { EventService, BackendEvent } from '../../../../shared/services/event.service';
import { Task, TaskStats, TaskCompletionOutcome } from '../../../../shared/interfaces/task.interface';
import { Member } from '../../../../shared/interfaces/member.interface';
import { AuthService } from '../../../../shared/services/auth.service';
import { ClubService } from '../../../../shared/services/club.service';
import { forkJoin } from 'rxjs';
import { TASK_COMPLETE_NOTE_CHIPS } from '../../../../shared/constants/task-completion-chips';

// ─── Smart defaults engine ────────────────────────────────────────────────────
// Infers priority + due date from the task title using keyword heuristics.
// Runs entirely on the frontend; no AI API call needed for basic suggestions.
function inferSmartDefaults(title: string, eventDate?: string): {
  priority: 'normal' | 'high' | 'urgent';
  dueDate: string;
  suggestedDescription: string;
} {
  const lower = title.toLowerCase();

  // Priority inference
  let priority: 'normal' | 'high' | 'urgent' = 'normal';
  if (/urgent|asap|critical|immediately|emergency|fix|broken/.test(lower)) {
    priority = 'urgent';
  } else if (/important|payment|contract|speaker|design|launch|release|deadline/.test(lower)) {
    priority = 'high';
  }

  // Due date inference — offset from today (or event date if available)
  const base = eventDate ? new Date(eventDate) : new Date();
  let offsetDays = 7; // default: 1 week
  if (priority === 'urgent') offsetDays = 1;
  else if (priority === 'high') offsetDays = 3;
  else if (/week/.test(lower)) offsetDays = 7;
  else if (/month/.test(lower)) offsetDays = 30;

  const due = new Date(base);
  due.setDate(due.getDate() - offsetDays); // tasks due before the event
  const dueDate = due.toISOString().split('T')[0];

  // Description suggestion
  const descriptions: Record<string, string> = {
    catering:     'Confirm menu, dietary restrictions, and headcount with caterer.',
    venue:        'Verify booking, capacity, AV equipment, and parking.',
    speaker:      'Send confirmation email with schedule, topic, and logistics.',
    payment:      'Set up payment gateway and test checkout flow.',
    design:       'Create mockups in Figma and share for review.',
    email:        'Draft, review, and schedule the email campaign.',
    social:       'Prepare posts for Instagram, LinkedIn, and Twitter.',
    transport:    'Arrange pickup/drop-off schedule for attendees.',
    registration: 'Open registration form and share the link.',
    budget:       'Prepare itemised budget spreadsheet for approval.',
  };
  let suggestedDescription = '';
  for (const [kw, desc] of Object.entries(descriptions)) {
    if (lower.includes(kw)) { suggestedDescription = desc; break; }
  }

  return { priority, dueDate, suggestedDescription };
}

@Component({
  selector: 'app-event-tasks',
  standalone: true,
  styleUrls: ['../../../../shared/styles/all-events-shell.css'],
  imports: [CommonModule, FormsModule],
  templateUrl: './event-tasks.component.html'
})
export class EventTasksComponent implements OnInit {
  eventId = '';
  tasks: Task[] = [];
  stats: TaskStats = { total: 0, todo: 0, in_progress: 0, done: 0 };
  loading = false;
  showForm = false;
  editingTask: Task | null = null;
  submitted = false;

  // Smart-defaults state
  smartSuggestion: { priority: string; dueDate: string; description: string } | null = null;
  smartApplied = false;
  titleDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Duplicate detection
  duplicateWarning: string | null = null;

  // Template suggestions shown in the quick-pick row
  readonly templateSuggestions = [
    { label: '🎤 Book speaker',        title: 'Book keynote speaker',        priority: 'high'   as const },
    { label: '🍽 Arrange catering',    title: 'Arrange catering',            priority: 'high'   as const },
    { label: '💳 Set up payments',     title: 'Set up payment gateway',      priority: 'urgent' as const },
    { label: '📧 Send invitations',    title: 'Send speaker invitations',    priority: 'normal' as const },
    { label: '🎨 Design materials',    title: 'Design event materials',      priority: 'high'   as const },
    { label: '🚌 Arrange transport',   title: 'Arrange transport',           priority: 'normal' as const },
  ];

  events: BackendEvent[] = [];
  selectedEventId = '';

  members: Member[] = [];

  newTask: Partial<Task> & { dueTime?: string } = this.emptyTask();

  // ── Date/Time handling ────────────────────────────────────────────────────
  get minDate(): string {
    // Minimum date is today
    return new Date().toISOString().split('T')[0];
  }

  get dueDateError(): string {
    if (!this.submitted || !this.newTask.dueDate) return '';
    
    const selectedDate = new Date(this.newTask.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return 'Due date cannot be in the past';
    }
    
    return '';
  }

  // ── Bulk-selection state ──────────────────────────────────────────────────
  selectedTaskIds: Set<string> = new Set();
  bulkStatus: Task['status'] = 'done';
  showBulkBar = false;

  // ── Filter / sort state ───────────────────────────────────────────────────
  filterPriority = 'all';
  filterStatus   = 'all';
  sortBy: 'dueDate' | 'priority' | 'title' = 'dueDate';

  // ── Complete-task review modal ────────────────────────────────────────────
  showCompleteModal = false;
  completingTask: Task | null = null;
  completeOutcome: TaskCompletionOutcome = 'success';
  completeNote = '';
  completeReason = '';
  completeSubmitted = false;
  completeSaving = false;
  completeError = '';

  /** Quick lines appended to the completion note (single + bulk). */
  readonly completeNoteChips = TASK_COMPLETE_NOTE_CHIPS;

  /** Bulk “mark as done” with the same structured review for every selected task. */
  showBulkCompleteModal = false;
  bulkCompleteIds: string[] = [];
  bulkCompleteOutcome: TaskCompletionOutcome = 'success';
  bulkCompleteNote = '';
  bulkCompleteReason = '';
  bulkCompleteSubmitted = false;
  bulkCompleteSaving = false;
  bulkCompleteError = '';

  constructor(
    public route: ActivatedRoute,
    public taskService: TaskService,
    private eventService: EventService,
    private authService: AuthService,
    private clubService: ClubService
  ) {}

  ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';
    this.selectedEventId = this.eventId;
    this.loadMembers();
    this.loadEvents();
    this.loadTasks();
  }

  /**
   * Populate the "Assign To" dropdown with the SIMPLE members of the current
   * club's Events committee. Rationale:
   *   - Tasks belong to a club event, so assignees must be in that club.
   *   - Only the Events committee is in charge of event execution, so the
   *     responsable should not be able to pick, say, the Treasurer.
   *   - The responsable (current user) is excluded — one doesn't assign to
   *     oneself, and the committee lead coordinates, they don't execute.
   * Name-matching follows the same accent-insensitive rule as the sidebar
   * (`event` / `evenement`), so a committee called "Événements" still works.
   */
  loadMembers() {
    const clubId = this.authService.getCurrentClubId();
    if (!clubId) {
      this.members = [];
      return;
    }

    this.clubService.getClubById(clubId).subscribe({
      next: (club) => {
        const normalize = (s?: string) =>
          (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        const eventSubGroups = (club.subGroups ?? []).filter(sg => {
          const n = normalize(sg.name);
          return n.includes('event') || n.includes('evenement');
        });

        const eventMemberIds = new Set<string>();
        for (const sg of eventSubGroups) {
          (sg.memberIds ?? []).forEach(id => eventMemberIds.add(id));
          if (sg.memberRoles) {
            Object.keys(sg.memberRoles).forEach(id => eventMemberIds.add(id));
          }
        }

        const isResponsableOfEvents = (userId: string) =>
          eventSubGroups.some(sg =>
            sg.responsableId === userId || sg.memberRoles?.[userId] === 'RESPONSABLE'
          );

        // ✅ CORRECTION: Exclure le responsable du comité Event
        // Afficher UNIQUEMENT les membres simples du comité Event
        const assignable = (club.members ?? []).filter(m =>
          (m.status === 'APPROVED' || m.status === 'ACTIVE' || !m.status) &&
          eventMemberIds.has(m.userId) &&
          !isResponsableOfEvents(m.userId) // ← Exclure le responsable
        );

        this.members = assignable.map(m => ({
          id: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          initials: (m.name || '?')
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
        }));
      },
      error: (err) => {
        console.error('Failed to load Events committee members', err);
        this.members = [];
      }
    });
  }

  loadEvents() {
    this.eventService.getEvents().subscribe({
      next: (events) => { this.events = events; },
      error: (err) => console.error('Failed to load events', err)
    });
  }

  loadTasks() {
    if (!this.selectedEventId) return;
    this.loading = true;
    this.taskService.getTasksByEvent(this.selectedEventId).subscribe({
      next: (data) => {
        this.tasks = data;
        this.computeStats();
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  onEventChange() { this.loadTasks(); }

  computeStats() {
    this.stats = {
      total:       this.tasks.length,
      todo:        this.tasks.filter(t => t.status === 'todo').length,
      in_progress: this.tasks.filter(t => t.status === 'in_progress').length,
      done:        this.tasks.filter(t => t.status === 'done').length,
    };
  }

  get progressPercent(): number {
    if (!this.stats.total) return 0;
    return Math.round((this.stats.done / this.stats.total) * 100);
  }

  // ── Filtered + sorted task list ───────────────────────────────────────────
  get filteredTasks(): Task[] {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
    return this.tasks
      .filter(t => {
        if (this.filterPriority !== 'all' && t.priority !== this.filterPriority) return false;
        if (this.filterStatus   !== 'all' && t.status   !== this.filterStatus)   return false;
        return true;
      })
      .sort((a, b) => {
        if (this.sortBy === 'priority') return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (this.sortBy === 'title') return a.title.localeCompare(b.title);
        // dueDate: tasks without a date go last
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }

  get overdueTasks(): Task[] {
    const now = new Date(); now.setHours(0,0,0,0);
    return this.tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now);
  }

  // ── Validation ────────────────────────────────────────────────────────────
  get titleError(): string {
    if (!this.submitted) return '';
    if (!this.newTask.title?.trim()) return 'Task title is required.';
    if ((this.newTask.title?.trim().length ?? 0) < 3) return 'Title must be at least 3 characters.';
    return '';
  }
  get assigneeError(): string {
    if (!this.submitted) return '';
    if (!this.newTask.assignedTo) return 'Please assign this task to a member.';
    if (this.newTask.assignedTo === this.currentUserId) {
      return "You can't assign a task to yourself — pick a teammate.";
    }
    return '';
  }

  /**
   * Identifier of the currently logged-in user (used to filter the assignee
   * dropdown so the responsable can't assign tasks to themselves).
   */
  get currentUserId(): string {
    const u = this.authService.getCurrentUser();
    return u?.userId ?? u?.id ?? '';
  }

  /**
   * Members offered in the "Assign To" dropdown.
   *
   * Rule: a responsable distributes work to OTHERS — never to themselves.
   * The simplest, most explicit way to enforce this is to remove the current
   * user from the picker entirely, both visually and from the data path.
   */
  get assignableMembers(): Member[] {
    const me = this.currentUserId;
    if (!me) return this.members;
    return this.members.filter(m => String(m.id) !== String(me));
  }
  get eventError(): string {
    if (!this.submitted) return '';
    if (!this.newTask.eventId) return 'Please select an event for this task.';
    return '';
  }
  get isFormValid(): boolean { 
    return !this.titleError && !this.assigneeError && !this.eventError && !this.dueDateError; 
  }

  // ── Smart defaults ─────────────────────────────────────────────────────────
  onTitleInput() {
    const title = this.newTask.title?.trim() || '';
    this.smartApplied = false;
    this.smartSuggestion = null;
    this.duplicateWarning = null;

    // Duplicate detection
    const dup = this.tasks.find(t =>
      t.id !== this.editingTask?.id &&
      t.title.toLowerCase() === title.toLowerCase()
    );
    if (dup) {
      this.duplicateWarning = `A task named "${dup.title}" already exists (${dup.status}).`;
    }

    if (title.length < 4) return;

    // Debounce the inference so it doesn't fire on every keystroke
    if (this.titleDebounceTimer) clearTimeout(this.titleDebounceTimer);
    this.titleDebounceTimer = setTimeout(() => {
      const selectedEvent = this.events.find(e => e.id === this.selectedEventId);
      const defaults = inferSmartDefaults(title, (selectedEvent as any)?.date);
      this.smartSuggestion = {
        priority:    defaults.priority,
        dueDate:     defaults.dueDate,
        description: defaults.suggestedDescription,
      };
    }, 400);
  }

  applySmartDefaults() {
    if (!this.smartSuggestion) return;
    this.newTask.priority    = this.smartSuggestion.priority as Task['priority'];
    this.newTask.dueDate     = this.smartSuggestion.dueDate;
    if (!this.newTask.description?.trim()) {
      this.newTask.description = this.smartSuggestion.description;
    }
    this.smartApplied = true;
  }

  applyTemplate(tpl: { title: string; priority: Task['priority'] }) {
    this.newTask.title    = tpl.title;
    this.newTask.priority = tpl.priority;
    this.newTask.eventId  = this.selectedEventId;
    this.onTitleInput();
  }

  // ── Form lifecycle ────────────────────────────────────────────────────────
  openForm(task?: Task) {
    // Guard: cannot assign a task without any event in the system
    if (!task && (this.events.length === 0 || !this.selectedEventId)) {
      return;
    }
    this.submitted = false;
    this.smartSuggestion = null;
    this.smartApplied = false;
    this.duplicateWarning = null;
    if (task) {
      this.editingTask = task;
      this.newTask = { ...task };
      this.selectedEventId = task.eventId;
      
      // Split existing dueDate into date and time if it exists
      if (task.dueDate) {
        const dueDateTime = new Date(task.dueDate);
        this.newTask.dueDate = dueDateTime.toISOString().split('T')[0];
        this.newTask.dueTime = dueDateTime.toTimeString().slice(0, 5); // HH:MM format
      }
    } else {
      this.editingTask = null;
      this.newTask = this.emptyTask();
      this.newTask.eventId = this.selectedEventId || this.eventId;
    }
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.editingTask = null;
    this.newTask = this.emptyTask();
    this.submitted = false;
    this.smartSuggestion = null;
    this.smartApplied = false;
    this.duplicateWarning = null;
  }

  onAssigneeChange() {
    const member = this.members.find(m => m.id === this.newTask.assignedTo);
    if (member) {
      this.newTask.assigneeName   = member.name;
      this.newTask.assigneeAvatar = member.initials;
    }
  }

  onTaskEventChange() { this.newTask.eventId = this.selectedEventId; }

  saveTask() {
    this.submitted = true;
    if (!this.isFormValid) return;
    
    // Combine date and time into a single ISO string
    let dueDateTimeISO: string | undefined = undefined;
    if (this.newTask.dueDate) {
      const dateStr = this.newTask.dueDate;
      const timeStr = this.newTask.dueTime || '23:59'; // Default to end of day if no time specified
      dueDateTimeISO = `${dateStr}T${timeStr}:00.000Z`;
    }
    
    const task: Task = { 
      ...this.newTask as Task, 
      createdBy: 'u1',
      dueDate: dueDateTimeISO // Store combined date+time
    };
    
    // Remove the temporary dueTime field before saving
    delete (task as any).dueTime;
    
    if (this.editingTask?.id) {
      this.taskService.updateTask(this.editingTask.id, task).subscribe({
        next: () => { this.loadTasks(); this.closeForm(); },
        error: (e) => console.error(e)
      });
    } else {
      this.taskService.createTask(task).subscribe({
        next: () => { this.loadTasks(); this.closeForm(); },
        error: (e) => console.error(e)
      });
    }
  }

  deleteTask(id: string) {
    const task = this.tasks.find((t) => t.id === id);
    const label = task?.title?.trim() || 'this task';
    if (!confirm(`Delete “${label}”? This cannot be undone.`)) return;
    this.taskService.deleteTask(id).subscribe({
      next: () => {
        this.selectedTaskIds.delete(id);
        this.showBulkBar = this.selectedTaskIds.size > 0;
        this.loadTasks();
      },
      error: (e) => console.error(e),
    });
  }

  toggleStatus(task: Task) {
    // Re-opening a done task → straight update, no review needed
    if (task.status === 'done') {
      this.taskService.updateStatus(task.id!, 'todo').subscribe({
        next: () => {
          task.status = 'todo';
          task.completionNote = undefined;
          task.completionOutcome = undefined;
          task.completionReason = undefined;
          task.completedAt = undefined;
          this.computeStats();
        }
      });
      return;
    }
    // Marking as done → open the structured completion review
    this.openCompleteModal(task);
  }

  // ── Smart "Complete task" review flow ─────────────────────────────────────
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
  }

  /** Heuristic: is this task overdue right now? */
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
        this.loadTasks();
        this.computeStats();
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

  appendBulkCompleteNoteChip(text: string): void {
    const cur = (this.bulkCompleteNote || '').trim();
    this.bulkCompleteNote = cur ? `${cur}\n${text}` : text;
  }

  isBulkSelectionOverdue(): boolean {
    return this.bulkCompleteIds.some((id) => {
      const t = this.tasks.find((x) => x.id === id);
      return t ? this.isTaskOverdue(t) : false;
    });
  }

  get bulkCompleteOutcomeError(): string {
    if (!this.bulkCompleteSubmitted) return '';
    return this.bulkCompleteOutcome ? '' : 'Please pick an outcome.';
  }
  get bulkCompleteNoteError(): string {
    if (!this.bulkCompleteSubmitted) return '';
    const n = (this.bulkCompleteNote || '').trim();
    if (n.length === 0) return 'Add a short note describing what was done.';
    if (n.length < 5) return 'The note is too short — be a bit more specific.';
    return '';
  }
  get bulkCompleteReasonError(): string {
    if (!this.bulkCompleteSubmitted) return '';
    const needsReason = this.bulkCompleteOutcome !== 'success' || this.isBulkSelectionOverdue();
    if (needsReason && !(this.bulkCompleteReason || '').trim()) {
      return this.bulkCompleteOutcome === 'success'
        ? 'At least one selected task is overdue — please explain.'
        : 'Please explain why the tasks were only partial / skipped.';
    }
    return '';
  }

  openBulkCompleteModal(): void {
    this.bulkCompleteOutcome = 'success';
    this.bulkCompleteNote = '';
    this.bulkCompleteReason = '';
    this.bulkCompleteSubmitted = false;
    this.bulkCompleteSaving = false;
    this.bulkCompleteError = '';
    this.showBulkCompleteModal = true;
  }

  closeBulkCompleteModal(): void {
    this.showBulkCompleteModal = false;
    this.bulkCompleteIds = [];
    this.bulkCompleteSubmitted = false;
    this.bulkCompleteError = '';
  }

  submitBulkComplete(): void {
    this.bulkCompleteSubmitted = true;
    if (
      this.bulkCompleteOutcomeError ||
      this.bulkCompleteNoteError ||
      this.bulkCompleteReasonError ||
      this.bulkCompleteIds.length === 0
    ) {
      return;
    }
    this.bulkCompleteSaving = true;
    this.bulkCompleteError = '';
    const payload = {
      outcome: this.bulkCompleteOutcome,
      note: (this.bulkCompleteNote || '').trim(),
      reason: (this.bulkCompleteReason || '').trim() || undefined,
    };
    forkJoin(this.bulkCompleteIds.map((id) => this.taskService.completeTask(id, payload))).subscribe({
      next: () => {
        this.bulkCompleteSaving = false;
        this.closeBulkCompleteModal();
        this.clearSelection();
        this.loadTasks();
      },
      error: (err) => {
        this.bulkCompleteSaving = false;
        this.bulkCompleteError = err?.error?.error || err?.message || 'Failed to complete some tasks.';
      },
    });
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  toggleSelect(taskId: string) {
    this.selectedTaskIds.has(taskId)
      ? this.selectedTaskIds.delete(taskId)
      : this.selectedTaskIds.add(taskId);
    this.showBulkBar = this.selectedTaskIds.size > 0;
  }

  selectAll() {
    this.filteredTasks.forEach(t => t.id && this.selectedTaskIds.add(t.id));
    this.showBulkBar = this.selectedTaskIds.size > 0;
  }

  clearSelection() { this.selectedTaskIds.clear(); this.showBulkBar = false; }

  applyBulkStatus() {
    const ids = [...this.selectedTaskIds].filter((id): id is string => !!id);
    if (ids.length === 0) return;
    if (this.bulkStatus === 'done') {
      this.bulkCompleteIds = ids;
      this.openBulkCompleteModal();
      return;
    }
    forkJoin(ids.map((id) => this.taskService.updateStatus(id, this.bulkStatus))).subscribe({
      next: () => {
        this.clearSelection();
        this.loadTasks();
      },
      error: (e) => console.error(e),
    });
  }

  deleteBulk() {
    const n = this.selectedTaskIds.size;
    const sample = this.filteredTasks
      .filter((t) => t.id && this.selectedTaskIds.has(t.id))
      .slice(0, 3)
      .map((t) => t.title)
      .join(', ');
    const extra = n > 3 ? ` (+${n - 3} more)` : '';
    if (!confirm(`Delete ${n} task(s)?\n${sample}${extra}\n\nThis cannot be undone.`)) return;
    const ids = [...this.selectedTaskIds];
    forkJoin(ids.map((id) => this.taskService.deleteTask(id))).subscribe({
      next: () => {
        this.clearSelection();
        this.loadTasks();
      },
      error: (e) => console.error(e),
    });
  }

  isSelected(taskId: string): boolean { return this.selectedTaskIds.has(taskId); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'high':   return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default:       return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'done':        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:            return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  }

  getDueDateLabel(task: Task): string {
    if (!task.dueDate) return '';
    
    const dueDateTime = new Date(task.dueDate);
    const now = new Date();
    const diff = Math.round((dueDateTime.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86400000);
    
    // Check if time is included
    const hasTime = task.dueDate.includes('T') && !task.dueDate.endsWith('T00:00:00.000Z');
    const timeStr = hasTime ? ` at ${new Date(task.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '';
    
    if (diff < 0)  return `Overdue by ${Math.abs(diff)}d${timeStr}`;
    if (diff === 0) return `Due today${timeStr}`;
    if (diff === 1) return `Due tomorrow${timeStr}`;
    return `Due ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${timeStr}`;
  }

  getDueDateClass(task: Task): string {
    if (!task.dueDate || task.status === 'done') return 'text-gray-400';
    const diff = Math.round((new Date(task.dueDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
    if (diff < 0)  return 'text-red-500 font-medium';
    if (diff <= 1) return 'text-orange-500 font-medium';
    return 'text-gray-400';
  }

  getEventTitle(eventId: string): string {
    const event = this.events.find(e => e.id === eventId);
    return event ? event.title : 'Unknown Event';
  }

  private emptyTask(): Partial<Task> & { dueTime?: string } {
    return {
      title: '', description: '', eventId: '',
      assignedTo: '', assigneeName: '', assigneeAvatar: '',
      priority: 'normal', status: 'todo', dueDate: '', dueTime: ''
    };
  }
}