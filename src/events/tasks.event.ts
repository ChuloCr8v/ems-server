// Task Creation Event
export interface TaskCreatePayload {
  employeeId: string;
  recipientIds: string[];
  assigneeIds: string[];
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  priority?: string;
  dueDate?: Date;
}

export interface TaskStatusChangePayload {
  employeeId: string;
  assigneeIds: string[];
  taskId: string;
  taskTitle: string;
  oldStatus: string;
  newStatus: string;
  creatorId: string;
  reason?: string;
}

export interface TaskAssigneeChangePayload {
  employeeId: string;
  taskId: string;
  taskTitle: string;
  addedAssigneeIds: string[];
  removedAssigneeIds: string[];
  currentAssigneeIds: string[];
  creatorId: string;
}

export interface TaskPriorityChangePayload {
  employeeId: string;
  taskId: string;
  taskTitle: string;
  oldPriority: string;
  newPriority: string;
  assigneeIds: string[];
  creatorId: string;
}

export interface TaskDueDateChangePayload {
  employeeId: string;
  taskId: string;
  taskTitle: string;
  oldDueDate?: Date;
  newDueDate?: Date;
  assigneeIds: string[];
  creatorId: string;
}

export class TaskStatusChangeEvent implements TaskStatusChangePayload {
  constructor(
    public employeeId: string,
    public taskId: string,
    public taskTitle: string,
    public oldStatus: string,
    public newStatus: string,
    public assigneeIds: string[],
    public creatorId: string,
    public reason?: string,
  ) {}
}

export class TaskAssigneeChangeEvent implements TaskAssigneeChangePayload {
  constructor(
    public employeeId: string,
    public taskId: string,
    public taskTitle: string,
    public addedAssigneeIds: string[],
    public removedAssigneeIds: string[],
    public currentAssigneeIds: string[],
    public creatorId: string,
  ) {}
}

export class TaskPriorityChangeEvent implements TaskPriorityChangePayload {
  constructor(
    public employeeId: string,
    public taskId: string,
    public taskTitle: string,
    public oldPriority: string,
    public newPriority: string,
    public assigneeIds: string[],
    public creatorId: string,
  ) {}
}

export class TaskDueDateChangeEvent implements TaskDueDateChangePayload {
  constructor(
    public employeeId: string,
    public taskId: string,
    public taskTitle: string,
    public oldDueDate: Date | undefined,
    public newDueDate: Date | undefined,
    public assigneeIds: string[],
    public creatorId: string,
  ) {}
}

export class TaskCreatedEvent implements TaskCreatePayload {
  constructor(
    public employeeId: string,
    public recipientIds: string[],
    public assigneeIds: string[],
    public taskId: string,
    public taskTitle: string,
    public taskDescription?: string,
    public priority?: string,
    public dueDate?: Date,
  ) {}
}

// Task Assignment Event
export interface TaskAssignedPayload {
  employeeId: string; // Who assigned the task
  assigneeIds: string[];
  taskId: string;
  taskTitle: string;
  // taskDescription?: string;
  priority?: string;
  dueDate?: Date;
}

export class TaskAssignedEvent implements TaskAssignedPayload {
  constructor(
    public employeeId: string,
    public assigneeIds: string[],
    public taskId: string,
    public taskTitle: string,
    // public taskDescription?: string,
    public priority?: string,
    public dueDate?: Date,
  ) {}
}

// Task Update Event
export interface TaskUpdatedPayload {
  employeeId: string; // Who updated the task
  recipientIds: string[]; // Assignees and creator
  taskId: string;
  taskTitle: string;
  updateDetails: string;
}

export class TaskUpdatedEvent implements TaskUpdatedPayload {
  constructor(
    public employeeId: string,
    public recipientIds: string[],
    public taskId: string,
    public taskTitle: string,
    public updateDetails: string,
  ) {}
}

// Task Approval Event
export interface TaskApprovedPayload {
  approverId: string;
  creatorId: string;
  assigneeIds: string[];
  taskId: string;
  taskTitle: string;
}

export class TaskApprovedEvent implements TaskApprovedPayload {
  constructor(
    public approverId: string,
    public creatorId: string,
    public assigneeIds: string[],
    public taskId: string,
    public taskTitle: string,
  ) {}
}

// Task Rejection Event
export interface TaskRejectedPayload {
  rejectorId: string;
  creatorId: string;
  taskId: string;
  taskTitle: string;
  rejectionReason: string;
}

export class TaskRejectedEvent implements TaskRejectedPayload {
  constructor(
    public rejectorId: string,
    public creatorId: string,
    public taskId: string,
    public taskTitle: string,
    public rejectionReason: string,
  ) {}
}

// Task Reassignment/Transfer Event
export interface TaskReassignedPayload {
  transferredById: string;
  newOwnerId: string;
  previousOwnerId: string;
  taskId: string;
  taskTitle: string;
  note?: string;
  newDueDate?: Date;
}

export class TaskReassignedEvent implements TaskReassignedPayload {
  constructor(
    public transferredById: string,
    public newOwnerId: string,
    public previousOwnerId: string,
    public taskId: string,
    public taskTitle: string,
    public note?: string,
    public newDueDate?: Date,
  ) {}
}
