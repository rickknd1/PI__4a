// src/app/shared/interfaces/task.interface.ts
export type TaskCompletionOutcome = 'success' | 'partial' | 'skipped';

export interface TaskCompletionPayload {
  outcome: TaskCompletionOutcome;
  note?: string;
  reason?: string;
}

export interface Task {
  id?: string;
  eventId: string;
  title: string;
  description?: string;
  assignedTo: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  priority: 'urgent' | 'high' | 'normal';
  status: 'todo' | 'in_progress' | 'done';
  dueDate?: string;
  dueTime?: string; // Temporary field for UI date/time picker (not stored in backend)
  createdBy?: string;
  createdAt?: string;

  // Completion review metadata (set via /complete endpoint)
  completionNote?: string;
  completionOutcome?: TaskCompletionOutcome;
  completionReason?: string;
  completedAt?: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
}