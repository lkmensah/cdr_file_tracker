# Ministry of Justice File Tracking System (GUIDELINES)

This document provides a comprehensive overview of the application's features and the logical workflow for managing legal records and practitioner workspaces.

---

## 1. System Overview & User Roles
The application is a dual-environment system designed to bridge the physical Registry with a digital workspace.

- **Administrative Registry (Main App):** Used by Registry staff to manage physical file lifecycles, log correspondence, and maintain oversight.
- **Attorney Workspace (Portal):** A secure, identity-bound environment for practitioners to manage their caseload, collaborate, and draft documents.

---

## 2. Core Features

### A. Dashboard & Analytics
- **Departmental Stats:** Real-time counts of Total Files, In-Transit items, and pending Correspondence.
- **Workload Analytics:** Visual breakdown of "In Progress" vs. "Resolved" cases per attorney to monitor departmental capacity.
- **Distribution Charts:** Visualizes case categories (Civil, Arbitration, etc.) for the current year.
- **Urgent Queues:** Dedicated sections for **Physical File Requests** (attorneys awaiting folders) and **System-wide Deadlines**.

### B. File Management
- **Lifecycle Tracking:** Files move from "Active" to "Completed" status.
- **Collaboration:** Each file supports a **Lead Practitioner** and a **Collaborative Team (Co-Assignees)**.
- **Judgment Debt:** Specialized tracking for financial exposure, including amounts in **GHS** and **USD**.
- **Milestones:** Tracks case progression through standard legal stages (Pleadings, Trial, Execution).

### C. Correspondence (Folios)
- **Log First, Assign Later:** Incoming mail and court processes are logged as "Unassigned" items first.
- **Folio History:** Once assigned to a file, correspondence is preserved in a chronological history.
- **Digital Links:** Support for SharePoint or digital scan URLs to allow practitioners to view documents remotely.

### D. Physical Movement & Possession
- **Chain of Custody:** Every movement of a physical file is logged.
- **In-Transit Logic:** Files "Moved" to a practitioner remain "In Transit" until the recipient confirms receipt in their portal.
- **Possession Tracking:** The system always identifies the current physical holder of the folder.

---

## 3. Workflow Logic

1. **Intake:** Registry receives mail and logs it under **Incoming Mail** or **Court Processes**.
2. **Assignment:** Registry identifies the relevant case and "Assigns" the item to a **File Number**.
3. **Dispatch:** Registry logs a **Movement** to a practitioner. The file enters "In Transit" status.
4. **Possession:** The practitioner receives the physical folder and clicks **Confirm Receipt** in their portal.
5. **Activity:** Practitioners use the portal to:
   - Set **Deadlines** and **Reminders**.
   - Exchange **Internal Instructions** with the Registry or team.
   - Create **Legal Drafts** using AI-assisted tools.
   - Export drafts into official **Word (.docx)** format (Letters/Memos).
6. **Handover:** When finished, the file is moved back to Registry or to another office.
7. **Resolution:** The case is marked **Completed**, and the record is moved to the **Archives**.

---

## 4. Attorney Portal Access
Practitioners access the portal at `/portal` using an alphanumeric **Access ID**.
- **Device Binding:** To ensure security, an Access ID is bound to the first device that uses it. Subsequent access from different devices is restricted unless authorized by the Registry.
- **Workspace:** Attorneys see only their files, messages, and upcoming deadlines.

---

## 5. Registry Tools
- **Global Search:** Search by File Number, Suit Number, Subject, or Document No. across the entire system.
- **Census:** A registry used to maintain a record of file ownership for annual reporting.
- **Audit Log:** A permanent record of all user activities for accountability and system transparency.
