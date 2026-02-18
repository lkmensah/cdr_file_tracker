
export type CorrespondenceType = 'Incoming' | 'Outgoing' | 'Filing' | 'Court Process' | 'Memo';

export type UserRole = 'admin' | 'staff';

export type Letter = {
  id: string;
  date: Date;
  dateOnLetter?: Date;
  hearingDate?: Date;
  subject: string;
  suitNumber?: string;
  recipient: string;
  signedBy?: string;
  documentNo: string;
  remarks: string;
  type: CorrespondenceType;
  processType?: string;
  serviceAddress?: string;
  fileNumber?: string;
  scanUrl?: string;
};

export type Movement = {
    id: string;
    date: Date;
    movedTo: string;
    status: string;
    receivedAt?: Date;
    receivedBy?: string;
};

export type CaseReminder = {
    id: string;
    text: string;
    date: Date;
    isCompleted: boolean;
};

export type InternalDraft = {
    id: string;
    title: string;
    type: string;
    content: string;
    date: Date;
};

export type InternalInstruction = {
    id: string;
    text: string;
    from: string;
    to: string;
    date: Date;
};

export type FileRequest = {
    id: string;
    requesterName: string;
    requesterId: string;
    requestedAt: Date;
};

export type Milestone = {
    id: string;
    title: string;
    isCompleted: boolean;
};

export type Attachment = {
    id: string;
    name: string;
    path: string;
    type: string;
    size: number;
    uploadedBy: string;
    uploadedAt: Date;
};

export type Reminder = {
    id: string;
    text: string;
    date: Date;
    isCompleted: boolean;
    attorneyId: string;
    attorneyName: string;
};

export type CorrespondenceFile = {
  id:string;
  fileNumber: string;
  suitNumber: string;
  category: string;
  group?: string; // Department ownership
  subject: string;
  dateCreated: Date;
  reportableDate: Date;
  lastActivityAt?: Date;
  viewedBy?: Record<string, any>;
  pinnedBy?: Record<string, boolean>;
  assignedTo?: string; // Primary Lead
  coAssignees?: string[]; // Team Members
  letters: Letter[];
  movements: Movement[];
  status?: 'Active' | 'Completed';
  completedAt?: Date;
  reminders?: CaseReminder[];
  internalDrafts?: InternalDraft[];
  internalInstructions?: InternalInstruction[];
  requests?: FileRequest[];
  milestones?: Milestone[];
  attachments?: Attachment[];
  isJudgmentDebt?: boolean;
  amountInvolved?: number; // Legacy field for migration safety
  amountGHC?: number;
  amountUSD?: number;
};

export type ArchiveRecord = {
    id: string;
    boxNumber: string;
    fileNumber: string;
    suitNumber: string;
    title: string;
    startDate?: Date;
    endDate?: Date;
    status: string;
};

export type CensusRecord = {
    id: string;
    date: Date;
    fileNumber: string;
    suitNumber: string;
    subject: string;
    attorney: string;
};

export type AuditLog = {
  id: string;
  timestamp: Date;
  userName: string;
  action: string;
  details: string;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: UserRole;
  passwordChangeRequired: boolean;
  rank?: string;
  group?: string;
};

export type Attorney = {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber: string;
  accessId: string;
  rank?: string;
  group?: string;
  isGroupHead?: boolean;
  isSG?: boolean;
  boundUid?: string;
};
