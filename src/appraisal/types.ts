import { AppraisalStatus } from '@prisma/client';

export interface AppraisalWhereInput {
  quarter?: string;
  year?: number;
  status?: AppraisalStatus;
  departmentId?: { in: string[] };
  appraiserId?: string;
  appraisedId?: string;
  OR?: any[];
} 

export interface AppraisalInclude {
  appraised?: any;
  appraiser?: any;
  department?: boolean;
  kpi?: any;
  goalsAndAchievement?: boolean;
  feedback?: any;
  summary?: any;
}

// export enum AppraisalStatus {
//   PENDING = 'PENDING',
//   DRAFT = 'DRAFT',
//   COMPLETED = 'COMPLETED',
//   IN_PROGRESS = 'IN_PROGRESS'
// }

export enum UserRole {
  ADMIN = 'ADMIN',
  HR = 'HR',
  DEPT_MANAGER = 'DEPT_MANAGER',
  USER = 'USER'
}


