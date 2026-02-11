
export enum Priority {
  P1 = 1,
  P2 = 2,
  P3 = 3,
  P4 = 4
}

export interface Task {
  id: string;
  content: string;
  description: string;
  dueDate?: string;
  priority: Priority;
  projectId: string;
  isCompleted: boolean;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export type ViewType = 'inbox' | 'today' | 'upcoming' | string; // string for project IDs

export interface AiTaskSuggestion {
  content: string;
  description: string;
  dueDate?: string;
  priority: Priority;
  projectId?: string;
}
