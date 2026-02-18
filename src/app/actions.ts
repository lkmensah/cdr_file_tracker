'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as db from '@/lib/data';
import type { CorrespondenceFile, Letter, CorrespondenceType, ArchiveRecord, CensusRecord, AuditLog, Milestone, Reminder } from '@/lib/types';
import { logUserActivity } from '@/lib/audit';
import { initializeAdmin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

async function verifyAndGetUser(clientToken: string): Promise<{decodedToken: DecodedIdToken, fullName: string}> {
    const adminAuth = getAuth(initializeAdmin());
    try {
        const decodedToken = await adminAuth.verifyIdToken(clientToken);
        const userRecord = await adminAuth.getUser(decodedToken.uid);

        // Prioritize displayName from the Auth record, then the token, then email.
        const fullName = userRecord.displayName || decodedToken.name || decodedToken.email;
        if (!fullName) {
          throw new Error('User name could not be determined.');
        }
        return { decodedToken, fullName };
    } catch (error) {
        console.error("Error verifying auth token:", error);
        throw new Error('Authentication Error: Invalid user token.');
    }
}


const NewFileSchema = z.object({
    fileNumber: z.string().min(1, 'File number is required.'),
    suitNumber: z.string(),
    category: z.string().min(1, 'Category is required.'),
    group: z.string().min(1, 'Group is required.'),
    subject: z.string().min(1, 'Subject is required.'),
    dateCreated: z.string().min(1, 'Date created is required.'),
    assignedTo: z.string().optional(),
    isJudgmentDebt: z.string().optional(),
    amountGHC: z.string().optional(),
    amountUSD: z.string().optional(),
});

const UpdateFileSchema = NewFileSchema.extend({
    id: z.string().min(1, 'File ID is required.'),
    treatAsNew: z.string().optional(),
});

// Base schema for correspondence data
const BaseCorrespondenceSchema = z.object({
  date: z.string(),
  dateOnLetter: z.string().optional(),
  hearingDate: z.string().optional(),
  type: z.enum(['Incoming', 'Outgoing', 'Filing', 'Court Process', 'Memo']),
  fileNumber: z.string().optional(),
  suitNumber: z.string().optional(),
  subject: z.string().min(1, 'Subject is required.'),
  recipient: z.string().min(1, 'This field is required.'),
  signedBy: z.string().optional(),
  documentNo: z.string().optional(),
  remarks: z.string().optional(),
  processType: z.string().optional(),
  serviceAddress: z.string().optional(),
  scanUrl: z.string().optional(),
});


// Schema for adding new correspondence with refinement logic
const AddCorrespondenceSchema = BaseCorrespondenceSchema.refine(data => {
    if (!data.fileNumber && (data.type === 'Incoming' || data.type === 'Court Process') && !data.documentNo) {
        return false;
    }
    return true;
}, {
    message: 'Document number is required.',
    path: ['documentNo'],
});


// Schema for updating an unassigned letter
const UpdateUnassignedLetterSchema = BaseCorrespondenceSchema.extend({
    id: z.string().min(1, 'Letter ID is required'),
});


const MoveFileSchema = z.object({
    fileNumber: z.string().min(1, 'File number is required.'),
    date: z.string(),
    movedTo: z.string().min(1, 'This field is required.'),
    status: z.string().min(1, 'Status is required.'),
});

const AssignFileSchema = z.object({
    letterId: z.string().min(1, 'Letter ID is required.'),
    fileNumber: z.string().min(1, 'File number is required.'),
    correspondenceType: z.enum(['Incoming', 'Court Process']),
});

const UnassignFileSchema = z.object({
    letterId: z.string().min(1, 'Letter ID is required.'),
    fileNumber: z.string().min(1, 'File number is required.'),
    correspondenceType: z.enum(['Incoming', 'Court Process']),
});

const NewArchiveRecordSchema = z.object({
    boxNumber: z.string().min(1, 'Box number is required.'),
    fileNumber: z.string().min(1, 'File number is required.'),
    suitNumber: z.string().optional(),
    title: z.string().min(1, 'Title is required.'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().min(1, 'Status is required.'),
});

const UpdateArchiveRecordSchema = NewArchiveRecordSchema.extend({
    id: z.string().min(1, 'Record ID is required.'),
});

const NewCensusRecordSchema = z.object({
    date: z.string().min(1, 'Date is required.'),
    fileNumber: z.string().min(1, 'File number is required.'),
    suitNumber: z.string().optional(),
    subject: z.string().min(1, 'Subject is required.'),
    attorney: z.string().min(1, 'Attorney is required.'),
});

const UpdateCensusRecordSchema = NewCensusRecordSchema.extend({
    id: z.string().min(1, 'Record ID is required.'),
});


export async function createFile(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);
    
    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = NewFileSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: firstError || 'Failed to create file.' };
    }
    
    const fileData = validatedFields.data;

    try {
        const result = await db.createFile(fileData as Parameters<typeof db.createFile>[0]);
        if (result.error) {
            return { message: result.error };
        }
        await logUserActivity(fullName, 'CREATE_FILE', `Created new file: ${fileData.fileNumber} - "${fileData.subject}"`);
        revalidatePath('/files');
        return { message: 'Success! File created.' };
    } catch (error) {
        return { message: 'Database Error: Failed to create file.' };
    }
}

export async function updateFile(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = UpdateFileSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: firstError || 'Failed to update file.' };
    }
    
    const fileData = validatedFields.data;

    try {
        const result = await db.updateFile(fileData as Parameters<typeof db.updateFile>[0]);
        if (result.error) {
            return { message: result.error };
        }
        
        // Log detailed reassignment changes
        const metaDetails = [];
        if (fileData.assignedTo) metaDetails.push(`Lead: ${fileData.assignedTo}`);
        if (fileData.group) metaDetails.push(`Group: ${fileData.group}`);
        
        const logMsg = `Updated file ${fileData.fileNumber}${metaDetails.length > 0 ? ` (${metaDetails.join(', ')})` : ''}`;
        await logUserActivity(fullName, 'UPDATE_FILE', logMsg);
        
        revalidatePath('/files');
        return { message: 'Success! File updated.' };
    } catch (error) {
        return { message: 'Database Error: Failed to update file.' };
    }
}

export async function markFileAsViewed(clientToken: string, id: string, viewerId: string): Promise<void> {
    await verifyAndGetUser(clientToken);
    await db.markFileAsViewed(id, viewerId);
}

export async function toggleFilePin(clientToken: string, id: string, attorneyId: string): Promise<void> {
    await verifyAndGetUser(clientToken);
    await db.toggleFilePin(id, attorneyId);
}

export async function toggleFileStatus(
    clientToken: string,
    id: string,
    fileNumber: string,
    newStatus: 'Active' | 'Completed'
): Promise<{ message: string }> {
    const { fullName } = await verifyAndGetUser(clientToken);
    try {
        const result = await db.toggleFileStatus(id, newStatus);
        if (!result.success) return { message: result.error || 'Failed to update status.' };
        
        const actionLabel = newStatus === 'Completed' ? 'Completed Case' : 'Reopened Case';
        await logUserActivity(fullName, 'UPDATE_FILE_STATUS', `${actionLabel}: ${fileNumber}`);
        revalidatePath('/files');
        revalidatePath('/');
        return { message: `Success! File ${fileNumber} is now marked as ${newStatus}.` };
    } catch (e) {
        return { message: 'Database error.' };
    }
}

export async function deleteFile(clientToken: string, id: string): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);
    try {
        const result = await db.deleteFile(id);
        if (!result.success) return { message: result.error || 'Failed to delete file.' };
        await logUserActivity(fullName, 'DELETE_FILE', `Deleted file record with ID: ${id}`);
        revalidatePath('/files');
        return { message: 'Success! File deleted.' };
    } catch (e) {
        return { message: 'Database error.' };
    }
}


export async function addCorrespondence(
  clientToken: string,
  formData: FormData
): Promise<{message: string, letter?: Letter}> {
  const { fullName } = await verifyAndGetUser(clientToken);

  const rawFormData = Object.fromEntries(formData.entries());
  const validatedFields = AddCorrespondenceSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
    return { message: firstError || 'Failed to add correspondence.' };
  }
  
  const correspondenceData = validatedFields.data;

  try {
    const result = await db.addCorrespondence(correspondenceData as Parameters<typeof db.addCorrespondence>[0]);
    if (result.error) {
        return { message: result.error };
    }
    
    const logDetail = correspondenceData.fileNumber
        ? `Added new ${correspondenceData.type.toLowerCase()} item ("${correspondenceData.subject}") to file ${correspondenceData.fileNumber}`
        : `Logged new unassigned ${correspondenceData.type.toLowerCase()} item: "${correspondenceData.subject}"`;
    await logUserActivity(fullName, `ADD_${correspondenceData.type.toUpperCase()}`, logDetail);
    
    revalidatePath('/files');
    if (correspondenceData.type === 'Incoming') revalidatePath('/incoming-mail');
    if (correspondenceData.type === 'Court Process') revalidatePath('/court-processes');

    return { message: 'Success! Correspondence added.', letter: result.letter };
  } catch (error) {
    return { message: 'Database Error: Failed to add correspondence.' };
  }
}

export async function updateUnassignedLetter(
    clientToken: string,
    formData: FormData
): Promise<{message: string, letter?: Letter}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = UpdateUnassignedLetterSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: firstError || 'Failed to update letter.' };
    }

    const letterData = validatedFields.data;

    try {
        const result = await db.updateUnassignedLetter(letterData.id, letterData);
        if (result.error) {
            return { message: result.error };
        }
        await logUserActivity(fullName, 'UPDATE_UNASSIGNED_LETTER', `Updated unassigned ${letterData.type.toLowerCase()} item: "${letterData.subject}"`);
        if (letterData.type === 'Incoming') revalidatePath('/incoming-mail');
        if (letterData.type === 'Court Process') revalidatePath('/court-processes');
        return { message: 'Success! Item updated.', letter: result.letter };
    } catch (error) {
        return { message: 'Database Error: Failed to update item.' };
    }
}

export async function deleteUnassignedLetter(clientToken: string, id: string): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);
    try {
        const result = await db.deleteUnassignedLetter(id);
        if (!result.success) return { message: result.error || 'Failed to delete item.' };
        await logUserActivity(fullName, 'DELETE_UNASSIGNED_LETTER', `Deleted unassigned correspondence: ${id}`);
        revalidatePath('/incoming-mail');
        revalidatePath('/court-processes');
        return { message: 'Success! Item deleted.' };
    } catch (e) {
        return { message: 'Database error.' };
    }
}

export async function updateLetterInFile(clientToken: string, fileNumber: string, letterId: string, formData: FormData) {
    const { fullName } = await verifyAndGetUser(clientToken);
    const data = Object.fromEntries(formData.entries());
    const result = await db.updateLetterInFile(fileNumber, letterId, data);
    if (result.success) {
        await logUserActivity(fullName, 'UPDATE_LETTER_IN_FILE', `Updated letter ${letterId} in file ${fileNumber}`);
        revalidatePath('/files');
        return { message: 'Success! Letter updated.' };
    }
    return { message: result.error || 'Failed to update letter.' };
}

export async function deleteLetterFromFile(clientToken: string, fileNumber: string, letterId: string) {
    const { fullName } = await verifyAndGetUser(clientToken);
    const result = await db.deleteLetterFromFile(fileNumber, letterId);
    if (result.success) {
        await logUserActivity(fullName, 'DELETE_LETTER_FROM_FILE', `Deleted letter ${letterId} from file ${fileNumber}`);
        revalidatePath('/files');
        return { message: 'Success! Letter deleted.' };
    }
    return { message: result.error || 'Failed to delete letter.' };
}

export async function moveFile(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = MoveFileSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: firstError || 'Failed to move file.' };
    }
    
    const moveData = validatedFields.data;
    
    try {
        const result = await db.moveFile(moveData as Parameters<typeof db.moveFile>[0]);
        if (result.error) {
            return { message: result.error };
        }
        await logUserActivity(fullName, 'MOVE_FILE', `Moved file ${moveData.fileNumber} to ${moveData.movedTo}. New status: "${moveData.status}"`);
        revalidatePath('/files');
        return { message: 'Success! File moved.' };
    } catch (error) {
        return { message: 'Database Error: Failed to move file.' };
    }
}

export async function batchMoveFiles(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const fileNumbers = formData.get('fileNumbers')?.toString().split(',') || [];
    const dateStr = formData.get('date')?.toString();
    const movedTo = formData.get('movedTo')?.toString();
    const status = formData.get('status')?.toString();
    const group = formData.get('group')?.toString();
    const assignedTo = formData.get('assignedTo')?.toString();

    if (fileNumbers.length === 0 || !dateStr || !movedTo || !status) {
        return { message: 'Missing required fields for batch move.' };
    }

    try {
        const result = await db.batchMoveFiles({
            fileNumbers,
            date: new Date(dateStr),
            movedTo,
            status,
            group,
            assignedTo
        });

        if (!result.success) {
            return { message: result.error || 'Failed to perform batch move.' };
        }

        const details = [`Batch moved ${fileNumbers.length} files to ${movedTo}`];
        if (assignedTo) details.push(`Set lead: ${assignedTo}`);
        if (group) details.push(`Assigned group: ${group}`);

        await logUserActivity(
            fullName, 
            'BATCH_MOVE_FILES', 
            `${details.join('. ')}. Files: ${fileNumbers.join(', ')}`
        );
        
        revalidatePath('/files');
        return { message: `Success! ${fileNumbers.length} files have been updated and moved.` };
    } catch (error) {
        return { message: 'Database Error: Failed to perform batch move.' };
    }
}

export async function batchPickupFiles(
    clientToken: string,
    formData: FormData
): Promise<{ message: string, summary?: any }> {
    const { fullName } = await verifyAndGetUser(clientToken);
    const fileNumbers = formData.get('fileNumbers')?.toString().split(',') || [];

    if (fileNumbers.length === 0) {
        return { message: 'No files selected for pickup.' };
    }

    try {
        const result = await db.batchPickupFiles(fileNumbers, fullName);
        if (!result.success) return { message: 'Failed to perform batch pickup.' };

        await logUserActivity(fullName, 'BATCH_PICKUP', `Physically picked up ${fileNumbers.length} files from practitioners. Returned to Registry.`);
        revalidatePath('/files');
        revalidatePath('/');
        return { message: 'Success! Files marked as returned to Registry.', summary: result.summary };
    } catch (error) {
        console.error(error);
        return { message: 'Database Error during batch pickup.' };
    }
}

export async function updateMovementInFile(clientToken: string, fileNumber: string, movementId: string, formData: FormData) {
    const { fullName } = await verifyAndGetUser(clientToken);
    const data = Object.fromEntries(formData.entries());
    const result = await db.updateMovementInFile(fileNumber, movementId, data);
    if (result.success) {
        await logUserActivity(fullName, 'UPDATE_MOVEMENT', `Updated movement log ${movementId} for file ${fileNumber}`);
        revalidatePath('/files');
        return { message: 'Success! Movement updated.' };
    }
    return { message: result.error || 'Failed to update movement.' };
}

export async function deleteMovementFromFile(clientToken: string, fileNumber: string, movementId: string) {
    const { fullName } = await verifyAndGetUser(clientToken);
    const result = await db.deleteMovementFromFile(fileNumber, movementId);
    if (result.success) {
        await logUserActivity(fullName, 'DELETE_MOVEMENT', `Deleted movement record ${movementId} from file ${fileNumber}`);
        revalidatePath('/files');
        return { message: 'Success! Movement deleted.' };
    }
    return { message: result.error || 'Failed to delete movement.' };
}

export async function confirmFileReceipt(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);
    
    const fileNumber = formData.get('fileNumber') as string;
    const movementId = formData.get('movementId') as string;

    if (!fileNumber || !movementId) {
        return { message: 'Missing file number or movement ID.' };
    }

    try {
        const result = await db.confirmFileReceipt(fileNumber, movementId, fullName);
        if (result.error) {
            return { message: result.error };
        }
        await logUserActivity(fullName, 'CONFIRM_RECEIPT', `Confirmed receipt of file ${fileNumber} at destination.`);
        revalidatePath('/files');
        return { message: 'Success! Receipt confirmed.' };
    } catch (error) {
        return { message: 'Database Error: Failed to confirm receipt.' };
    }
}

export async function assignToFile(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = AssignFileSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: firstError || 'Failed to assign file.' };
    }
    
    const assignData = validatedFields.data;

    try {
        const result = await db.assignToFile(assignData);
        if (result.error || !result.letter) {
            return { message: result.error || 'Failed to retrieve letter details for logging.' };
        }
        await logUserActivity(fullName, 'ASSIGN_TO_FILE', `Assigned item "${result.letter.subject}" (Doc No: ${result.letter.documentNo}) to file ${assignData.fileNumber}`);
        revalidatePath('/files');
        revalidatePath('/incoming-mail');
        revalidatePath('/court-processes');
        return { message: 'Success! Assigned to file.' };
    } catch (error) {
        return { message: 'Database Error: Failed to assign file.' };
    }
}

export async function unassignFromFile(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = UnassignFileSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: firstError || 'Failed to un-assign file.' };
    }
    
    const unassignData = validatedFields.data;

    try {
        const result = await db.unassignFromFile(unassignData);
        if (result.error || !result.letter) {
            return { message: result.error || 'Failed to retrieve letter details for logging.' };
        }
        await logUserActivity(fullName, 'UNASSIGN_FROM_FILE', `Un-assigned item "${result.letter.subject}" (Doc No: ${result.letter.documentNo}) from file ${unassignData.fileNumber}`);
        revalidatePath('/files');
        revalidatePath('/incoming-mail');
        revalidatePath('/court-processes');
        return { message: 'Success! Un-assigned from file.' };
    } catch (error) {
        return { message: 'Database Error: Failed to un-assign from file.' };
    }
}

export async function createArchiveRecord(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = NewArchiveRecordSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: 'Failed to create archive record.' };
    }
    
    const recordData = validatedFields.data;

    try {
        const result = await db.createArchiveRecord(recordData as Parameters<typeof db.createArchiveRecord>[0]);
        if (result.error) {
            return { message: result.error };
        }
        await logUserActivity(fullName, 'CREATE_ARCHIVE_RECORD', `Created archive record for file ${recordData.fileNumber} in box ${recordData.boxNumber}`);
        revalidatePath('/archives');
        return { message: 'Success! Archive record created.' };
    } catch (error) {
        return { message: 'Database Error: Failed to create archive record.' };
    }
}

export async function updateArchiveRecord(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);
    
    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = UpdateArchiveRecordSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: 'Failed to update archive record.' };
    }
    
    const recordData = validatedFields.data;

    try {
        const result = await db.updateArchiveRecord(recordData.id, recordData);
        if (result.error) {
            return { message: result.error };
        }
        await logUserActivity(fullName, 'UPDATE_ARCHIVE_RECORD', `Updated archive record for file ${recordData.fileNumber}`);
        revalidatePath('/archives');
        return { message: 'Success! Archive record updated.' };
    } catch (error) {
        return { message: 'Database Error: Failed to update archive record.' };
    }
}

export async function deleteArchiveRecord(clientToken: string, id: string): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);
    try {
        const result = await db.deleteArchiveRecord(id);
        if (!result.success) return { message: result.error || 'Failed to delete archive record.' };
        await logUserActivity(fullName, 'DELETE_ARCHIVE', `Deleted archive record ID: ${id}`);
        revalidatePath('/archives');
        return { message: 'Success! Record deleted.' };
    } catch (e) {
        return { message: 'Database error.' };
    }
}

export async function createCensusRecord(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = NewCensusRecordSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: 'Failed to create census record.' };
    }
    
    const recordData = validatedFields.data;

    try {
        const result = await db.createCensusRecord(recordData as Parameters<typeof db.createCensusRecord>[0]);
        if (result.error) {
            return { message: result.error };
        }
        await logUserActivity(fullName, 'CREATE_CENSUS_RECORD', `Created census record for file ${recordData.fileNumber}, assigned to ${recordData.attorney}`);
        revalidatePath('/census');
        return { message: 'Success! Census record created.' };
    } catch (error) {
        return { message: 'Database Error: Failed to create census record.' };
    }
}

export async function updateCensusRecord(
    clientToken: string,
    formData: FormData
): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);

    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = UpdateCensusRecordSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return { message: 'Failed to update census record.' };
    }
    
    const recordData = validatedFields.data;

    try {
        const result = await db.updateCensusRecord(recordData.id, recordData);
        if (result.error) {
            return { message: result.error };
        }
        await logUserActivity(fullName, 'UPDATE_CENSUS_RECORD', `Updated census record for file ${recordData.fileNumber}`);
        revalidatePath('/census');
        return { message: 'Success! Census record updated.' };
    } catch (error) {
        return { message: 'Database Error: Failed to update census record.' };
    }
}

export async function deleteCensusRecord(clientToken: string, id: string): Promise<{message: string}> {
    const { fullName } = await verifyAndGetUser(clientToken);
    try {
        const result = await db.deleteCensusRecord(id);
        if (!result.success) return { message: result.error || 'Failed to delete census record.' };
        await logUserActivity(fullName, 'DELETE_CENSUS', `Deleted census record ID: ${id}`);
        revalidatePath('/census');
        return { message: 'Success! Record deleted.' };
    } catch (e) {
        return { message: 'Database error.' };
    }
}

// ATTORNEY PORTAL ACTIONS

export async function addInternalDraft(clientToken: string, fileNumber: string, draftData: any) {
    await verifyAndGetUser(clientToken);
    try {
        await db.addInternalDraft(fileNumber, draftData);
        return { success: true, message: 'Draft saved successfully.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateInternalDraft(clientToken: string, fileNumber: string, draftId: string, draftData: any) {
    await verifyAndGetUser(clientToken);
    try {
        await db.updateInternalDraft(fileNumber, draftId, draftData);
        return { success: true, message: 'Draft updated successfully.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteInternalDraft(clientToken: string, fileNumber: string, draftId: string) {
    await verifyAndGetUser(clientToken);
    try {
        await db.deleteInternalDraft(fileNumber, draftId);
        return { success: true, message: 'Draft deleted.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function addInternalInstruction(clientToken: string, fileNumber: string, instructionData: any) {
    await verifyAndGetUser(clientToken);
    try {
        await db.addInternalInstruction(fileNumber, instructionData);
        return { success: true, message: 'Communication sent.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function addCaseReminder(clientToken: string, fileNumber: string, reminderData: any) {
    await verifyAndGetUser(clientToken);
    try {
        await db.addCaseReminder(fileNumber, reminderData);
        return { success: true, message: 'Reminder set.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function toggleReminder(clientToken: string, fileNumber: string, reminderId: string) {
    await verifyAndGetUser(clientToken);
    try {
        await db.toggleReminder(fileNumber, reminderId);
        return { success: true };
    } catch (error: any) {
        return { success: false };
    }
}

export async function addGeneralReminder(clientToken: string, data: { text: string, date: string, attorneyId: string, attorneyName: string }) {
    await verifyAndGetUser(clientToken);
    try {
        await db.addGeneralReminder(data.attorneyId, data.attorneyName, data);
        return { success: true, message: 'General reminder set.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function toggleGeneralReminder(clientToken: string, reminderId: string) {
    await verifyAndGetUser(clientToken);
    try {
        await db.toggleGeneralReminder(reminderId);
        return { success: true };
    } catch (error: any) {
        return { success: false };
    }
}

export async function requestFile(clientToken: string, fileNumber: string, attorneyId: string, attorneyName: string) {
    await verifyAndGetUser(clientToken);
    try {
        await db.requestFile(fileNumber, attorneyId, attorneyName);
        return { success: true, message: 'File requested from Registry.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function cancelFileRequest(clientToken: string, fileNumber: string, requestId: string) {
    await verifyAndGetUser(clientToken);
    try {
        await db.cancelFileRequest(fileNumber, requestId);
        return { success: true, message: 'Request canceled.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateMilestones(clientToken: string, fileNumber: string, milestones: Milestone[]) {
    await verifyAndGetUser(clientToken);
    try {
        await db.updateFileMilestones(fileNumber, milestones);
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
