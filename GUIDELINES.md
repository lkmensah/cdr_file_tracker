# Ministry of Justice File Tracking System: Operational Manual

This guide provides a detailed, step-by-step workflow for all roles within the system. The application is divided into the **Administrative Registry** (Main App) and the **Attorney Portal** (Practitioner Workspace).

---

## 1. Registry Staff (Administrative Registry)
*Goal: Ensure accurate physical file tracking, reliable intake of correspondence, and oversight of practitioner access.*

### Step A: Incoming Mail & Court Processes (Intake)
1. **Log First**: When mail or a process arrives, go to **"Incoming Mail"** or **"Court Processes"**.
2. **Details**: Enter the subject, source (Sender/Court), and mandatory **Document No.**
3. **Scan (Optional)**: If a digital scan exists, paste the SharePoint URL into the "Digital Scan Link" field.
4. **Assignment**: 
   - Use the **"Assign to File"** option in the actions menu.
   - Search for the relevant **File Number**. 
   - Once assigned, the item disappears from the "Unassigned" list and becomes a **Folio** in that case file.

### Step B: Managing File Lifecycles
1. **New Files**: If a case is new, go to **"Files" -> "New File"**. 
2. **Classification**: Select the correct **Category**. For Civil cases, toggle **"Judgment Debt"** if there is a monetary claim.
3. **Movement (Dispatch)**: 
   - Locate the file in the "Files" table.
   - Click **"Move File"**.
   - Select the **Practitioner** (Attorney) or Office (e.g., "Registry").
   - The file enters **"In Transit"** status until the practitioner acknowledges receipt.

### Step C: Administrative Oversight
1. **Attorneys Registry**: Maintain the list of all practitioners. Ensure their **Group** and **Rank** are accurate.
2. **Device Resets**: If an attorney cannot access their portal (new computer/browser), go to **"Attorneys" -> "Actions" -> "Reset Device Access"**.
3. **Audit Log**: Use this section to review every action taken by staff for transparency.

---

## 2. Practitioners (Attorney Portal)
*Goal: Manage assigned caseload, coordinate with the team, and draft legal documents.*

### Step A: Secure Access
1. **Login**: Enter your alphanumeric **Access ID** at `/portal`.
2. **Binding**: The system will automatically "lock" your ID to the hardware you are currently using. You cannot use a different laptop or phone without a Registry reset.

### Step B: Daily Workflow
1. **My Active Files**: View files where you are the **Lead Practitioner**.
2. **Shared Files**: View files that are physically at your desk or where you are a **Co-Assignee**.
3. **Real-time Alerts**: Keep your dashboard tab open. A **"Beep"** sound will play whenever a new Folio, Internal Instruction, or File Movement is recorded for your cases.
4. **Confirming Receipt**: When a physical folder arrives at your desk, find it in your portal and click **"Confirm Receipt"**. This notifies the Registry that you now have physical possession.

### Step C: Collaboration & Drafting
1. **Drafts**: Use the "Drafts" tab to create Defenses, Opinions, or Letters.
2. **AI Tools**: Click **"AI Tools" -> "Legal Polish"** to refine your language or **"Summarize"** to condense content.
3. **Export**: Once finished, click **"Export as Letter"** or **"Export as Memo"**. The system will generate a professional **Word (.docx)** document with official Ministry headers and formatting.
4. **Messaging**: Use the "Messaging" tab to send **Internal Instructions** to your team or the Registry.

---

## 3. Group Heads (Departmental Oversight)
*Goal: Monitor group performance and ensure no cases are stagnant.*

1. **Group Hub**: Access the **"Monitoring"** view on your dashboard.
2. **Workload Analysis**: Review the **"Files per Practitioner"** chart to see who is overloaded.
3. **Stagnant Exception Report**: Identify files that have had **zero activity for 14 days**. These will appear in red.
4. **Directives**: If a case is stagnant, open the file and issue an **Instruction** to the Lead Practitioner. It will be permanently logged as a directive from the Group Head.

---

## 4. Solicitor General (Master Oversight)
*Goal: Strategic monitoring of the entire Ministry's legal burden and financial exposure.*

1. **Solicitor General's View**: Your dashboard shows the **Master File List** across all departments.
2. **Master Oversight Hub**:
   - **Cross-Group Analysis**: Compare active vs. resolved cases across all divisions (Civil, Arbitration, etc.).
   - **Departmental Burden Rank**: Identify which departments are at highest capacity.
3. **Judgment Debt Monitoring**:
   - Access the **"Reports"** section in the main app.
   - Filter by **"Judgment Debt Cases Only"**.
   - Review the total financial exposure in **GHS** and **USD**.
4. **Master Status Report**: Click **"Download Master Status Report"** to get a comprehensive PDF of every active file in the Ministry, organized by department and possession level.

---

## Security Appendix: Device Binding
To ensure that Access IDs are not shared or used on unauthorized personal devices:
- **Registry**: Generates Access ID.
- **Practitioner**: Logs in. The first device used becomes the **only** authorized device.
- **System**: Blocks any login from a different browser or hardware UID.
- **Admin Reset**: Required only when hardware is replaced or deep browser caches are cleared.