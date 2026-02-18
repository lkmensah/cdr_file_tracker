
'use server';

import type { CorrespondenceFile, Letter, Movement, ArchiveRecord, CensusRecord, Attorney, CaseReminder, InternalDraft, InternalInstruction, FileRequest, Milestone, Attachment, Reminder } from '@/lib/types';
import {
    Timestamp,
    FieldValue,
} from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

const getCollectionRef = (collectionName: string) => {
    const firestore = getFirestore(initializeAdmin());
    return firestore.collection(collectionName);
}

const getUnassignedLettersCollectionRef = () => getCollectionRef('unassignedLetters');
const getFileCollectionRef = () => getCollectionRef('files');
const getArchiveCollectionRef = () => getCollectionRef('archives');
const getCensusCollectionRef = () => getCollectionRef('census');
const getAuditLogCollectionRef = () => getCollectionRef('auditLogs');
const getAttorneyCollectionRef = () => getCollectionRef('attorneys');
const getRemindersCollectionRef = () => getCollectionRef('reminders');

const defaultMilestones: Milestone[] = [
    { id: 'm1', title: 'Pleadings', isCompleted: false },
    { id: 'm2', title: 'Discovery / Pre-Trial', isCompleted: false },
    { id: 'm3', title: 'Trial', isCompleted: false },
    { id: 'm4', title: 'Judgment / Execution', isCompleted: false },
];

const docToType = <T>(doc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>): T => {
    const data = doc.data();
    if (!data) {
        throw new Error("Document data is undefined.");
    }
    const result: any = { id: doc.id };
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        result[key] = data[key].toDate();
      } else {
        result[key] = data[key];
      }
    }

    const processArrays = (arr: any[]) => {
        if (!arr) return [];
        return arr.map(item => {
            const newItem: any = {};
            for (const k in item) {
                if (item[k] instanceof Timestamp) newItem[k] = item[k].toDate();
                else newItem[k] = item[k];
            }
            return newItem;
        });
    };

    if (result.letters) result.letters = processArrays(result.letters);
    if (result.movements) result.movements = processArrays(result.movements);
    if (result.reminders) result.reminders = processArrays(result.reminders);
    if (result.internalDrafts) result.internalDrafts = processArrays(result.internalDrafts);
    if (result.internalInstructions) result.internalInstructions = processArrays(result.internalInstructions);
    if (result.requests) result.requests = processArrays(result.requests);
    if (result.attachments) result.attachments = processArrays(result.attachments);

    if (!result.milestones) result.milestones = defaultMilestones;

    return result as T;
};

export const addAuditLog = async (logData: any) => {
    await getAuditLogCollectionRef().add({
        ...logData,
        timestamp: FieldValue.serverTimestamp(),
    });
};

export const getFiles = async (): Promise<CorrespondenceFile[]> => {
    const snapshot = await getFileCollectionRef().orderBy('dateCreated', 'desc').get();
    return snapshot.docs.map(doc => docToType<CorrespondenceFile>(doc));
};

export const createFile = async (fileData: any): Promise<{ file?: CorrespondenceFile, error?: string }> => {
    const filesCollection = getFileCollectionRef();
    const q = filesCollection.where('fileNumber', '==', fileData.fileNumber);
    const existing = await q.get();
    if (!existing.empty) {
        return { error: `File number ${fileData.fileNumber} already exists.` };
    }

    const createdDate = new Date(fileData.dateCreated);
    const newFile: Omit<CorrespondenceFile, 'id'> = {
        ...fileData,
        dateCreated: createdDate,
        reportableDate: createdDate,
        lastActivityAt: FieldValue.serverTimestamp(),
        viewedBy: {},
        pinnedBy: {},
        letters: [],
        movements: [],
        status: 'Active',
        requests: [],
        milestones: defaultMilestones,
        attachments: [],
        isJudgmentDebt: fileData.isJudgmentDebt === 'on' || fileData.isJudgmentDebt === true,
        amountGHC: fileData.amountGHC ? parseFloat(fileData.amountGHC) : 0,
        amountUSD: fileData.amountUSD ? parseFloat(fileData.amountUSD) : 0,
    };

    const docRef = await filesCollection.add(newFile);
    return { file: { ...newFile, id: docRef.id } };
};

export const updateFile = async (fileData: any): Promise<{ file?: CorrespondenceFile, error?: string }> => {
    const fileDocRef = getFileCollectionRef().doc(fileData.id);
    const snap = await fileDocRef.get();
    if (!snap.exists) return { error: "File not found" };
    
    const oldData = snap.data()!;
    const updateData: any = { 
        ...fileData, 
        lastActivityAt: FieldValue.serverTimestamp(),
        isJudgmentDebt: fileData.isJudgmentDebt === 'on' || fileData.isJudgmentDebt === true,
        amountGHC: fileData.amountGHC ? parseFloat(fileData.amountGHC) : 0,
        amountUSD: fileData.amountUSD ? parseFloat(fileData.amountUSD) : 0,
    };
    
    if (fileData.dateCreated) updateData.dateCreated = new Date(fileData.dateCreated);
    if (fileData.treatAsNew === 'on') updateData.reportableDate = new Date();
    
    // Detect Assignment/Group Changes and create automatic Movement
    const hasAssigneeChanged = fileData.assignedTo && oldData.assignedTo !== fileData.assignedTo;
    const hasGroupChanged = fileData.group && oldData.group !== fileData.group;

    if (hasAssigneeChanged || hasGroupChanged) {
        const newMovement: Movement = {
            id: `M-AUTO-${Date.now()}`,
            date: new Date(),
            movedTo: fileData.assignedTo || oldData.assignedTo || 'Unassigned',
            status: `Reassigned to ${fileData.group || oldData.group || 'New Group'}`,
        };
        updateData.movements = FieldValue.arrayUnion(newMovement);
        
        // Clear requests for the new assignee if they had any
        const currentRequests = oldData.requests || [];
        updateData.requests = currentRequests.filter((r: any) => r.requesterName !== (fileData.assignedTo || ''));
    }

    delete updateData.id;
    delete updateData.treatAsNew;

    await fileDocRef.update(updateData);
    const updatedDoc = await fileDocRef.get();
    return { file: docToType<CorrespondenceFile>(updatedDoc) };
};

export const addFileAttachment = async (fileNumber: string, attachment: Attachment) => {
    const snapshot = await getFileCollectionRef().where('fileNumber', '==', fileNumber).limit(1).get();
    if (snapshot.empty) throw new Error('File not found.');
    
    await snapshot.docs[0].ref.update({
        attachments: FieldValue.arrayUnion({
            ...attachment,
            uploadedAt: Timestamp.fromDate(new Date(attachment.uploadedAt))
        }),
        lastActivityAt: FieldValue.serverTimestamp()
    });
}

export const markFileAsViewed = async (id: string, viewerId: string): Promise<void> => {
    const fileRef = getFileCollectionRef().doc(id);
    await fileRef.update({
        [`viewedBy.${viewerId}`]: FieldValue.serverTimestamp()
    });
}

export const toggleFilePin = async (id: string, attorneyId: string): Promise<void> => {
    const fileRef = getFileCollectionRef().doc(id);
    const doc = await fileRef.get();
    if (!doc.exists) return;
    const currentPinned = doc.data()?.pinnedBy?.[attorneyId] || false;
    await fileRef.update({
        [`pinnedBy.${attorneyId}`]: !currentPinned
    });
}

export const deleteFile = async (id: string): Promise<{ success: boolean, error?: string }> => {
    try {
        await getFileCollectionRef().doc(id).delete();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const toggleFileStatus = async (id: string, newStatus: 'Active' | 'Completed'): Promise<{ success: boolean, error?: string }> => {
    try {
        const fileRef = getFileCollectionRef().doc(id);
        const updateData: any = { status: newStatus, lastActivityAt: FieldValue.serverTimestamp() };
        if (newStatus === 'Completed') {
            updateData.completedAt = new Date();
        } else {
            updateData.completedAt = null;
        }
        await fileRef.update(updateData);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export const addCorrespondence = async (data: any): Promise<{ file?: CorrespondenceFile, letter?: Letter, error?: string }> => {
    const letterId = `L-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newLetter: any = {
        date: new Date(data.date),
        type: data.type,
        subject: data.subject,
        recipient: data.recipient,
        documentNo: data.documentNo || '',
        remarks: data.remarks || '',
        ...(data.suitNumber && { suitNumber: data.suitNumber }),
        ...(data.fileNumber && { fileNumber: data.fileNumber }),
        ...(data.dateOnLetter && { dateOnLetter: new Date(data.dateOnLetter) }),
        ...(data.hearingDate && { hearingDate: new Date(data.hearingDate) }),
        ...(data.signedBy && { signedBy: data.signedBy }),
        ...(data.processType && { processType: data.processType }),
        ...(data.serviceAddress && { serviceAddress: data.serviceAddress }),
        ...(data.scanUrl && { scanUrl: data.scanUrl }),
    };

    if (data.fileNumber) {
        const snapshot = await getFileCollectionRef().where('fileNumber', '==', data.fileNumber).get();
        if (snapshot.empty) return { error: `File number ${data.fileNumber} not found.` };

        const fileDoc = snapshot.docs[0];
        await fileDoc.ref.update({ 
            letters: FieldValue.arrayUnion({ id: letterId, ...newLetter }),
            lastActivityAt: FieldValue.serverTimestamp()
        });
        const updatedFileDoc = await fileDoc.ref.get();
        const updatedFile = docToType<CorrespondenceFile>(updatedFileDoc);
        return { file: updatedFile, letter: updatedFile.letters.find(l => l.id === letterId) };
    } else {
        const docRef = getUnassignedLettersCollectionRef().doc(letterId);
        await docRef.set(newLetter);
        return { letter: { id: docRef.id, ...newLetter } };
    }
};

export const moveFile = async (data: any): Promise<{ file?: CorrespondenceFile, error?: string }> => {
    const q = getFileCollectionRef().where('fileNumber', '==', data.fileNumber);
    const fileSnapshot = await q.get();
    if (fileSnapshot.empty) return { error: `File number ${data.fileNumber} not found.` };
    
    const fileDoc = fileSnapshot.docs[0];
    const file = docToType<CorrespondenceFile>(fileDoc);
    const newMovement: Movement = {
        id: `M-${Date.now()}`,
        date: new Date(data.date),
        movedTo: data.movedTo,
        status: data.status,
    };
    
    const updatedRequests = (file.requests || []).filter(r => r.requesterName.toLowerCase().trim() !== data.movedTo.toLowerCase().trim());

    await fileDoc.ref.update({ 
        movements: FieldValue.arrayUnion(newMovement),
        requests: updatedRequests,
        lastActivityAt: FieldValue.serverTimestamp()
    });
    const updatedDoc = await fileDoc.ref.get();
    return { file: docToType<CorrespondenceFile>(updatedDoc) };
}

export const addInternalDraft = async (fileNumber: string, data: any) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) throw new Error('File not found.');
    
    const now = new Date();
    const draft: InternalDraft = {
        id: `D-${Date.now()}`,
        title: data.title,
        type: data.type,
        content: data.content,
        date: now,
    };
    
    await snapshot.docs[0].ref.update({ 
        internalDrafts: FieldValue.arrayUnion(draft),
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const updateInternalDraft = async (fileNumber: string, draftId: string, data: any) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) throw new Error('File not found.');
    
    const fileDoc = snapshot.docs[0];
    const fileData = fileDoc.data()!;
    const drafts = (fileData.internalDrafts || []).map((d: any) => {
        if (d.id === draftId) {
            return { 
                ...d, 
                title: data.title || d.title, 
                content: data.content || d.content 
            };
        }
        return d;
    });
    
    await fileDoc.ref.update({ 
        internalDrafts: drafts,
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const deleteInternalDraft = async (fileNumber: string, draftId: string) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) throw new Error('File not found.');
    
    const fileDoc = snapshot.docs[0];
    const fileData = fileDoc.data()!;
    const drafts = (fileData.internalDrafts || []).filter((d: any) => d.id !== draftId);
    
    await fileDoc.ref.update({ 
        internalDrafts: drafts,
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const addInternalInstruction = async (fileNumber: string, data: any) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) throw new Error('File not found.');
    
    const now = new Date();
    const instruction: InternalInstruction = {
        id: `I-${Date.now()}`,
        text: data.text,
        from: data.from,
        to: data.to,
        date: now,
    };
    
    await snapshot.docs[0].ref.update({ 
        internalInstructions: FieldValue.arrayUnion(instruction),
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const addCaseReminder = async (fileNumber: string, data: any) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) throw new Error('File not found.');
    
    const reminder: CaseReminder = {
        id: `R-${Date.now()}`,
        text: data.text,
        date: new Date(data.date),
        isCompleted: false,
    };
    
    await snapshot.docs[0].ref.update({ 
        reminders: FieldValue.arrayUnion(reminder),
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const toggleReminder = async (fileNumber: string, reminderId: string) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) return;
    
    const file = docToType<CorrespondenceFile>(snapshot.docs[0]);
    const updatedReminders = (file.reminders || []).map(r => 
        r.id === reminderId ? { ...r, isCompleted: !r.isCompleted } : r
    );
    
    await snapshot.docs[0].ref.update({ 
        reminders: updatedReminders,
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const addGeneralReminder = async (attorneyId: string, attorneyName: string, data: any) => {
    await getRemindersCollectionRef().add({
        text: data.text,
        date: new Date(data.date),
        isCompleted: false,
        attorneyId,
        attorneyName,
        createdAt: FieldValue.serverTimestamp()
    });
    return { success: true };
}

export const toggleGeneralReminder = async (reminderId: string) => {
    const ref = getRemindersCollectionRef().doc(reminderId);
    const doc = await ref.get();
    if (!doc.exists) return;
    await ref.update({ isCompleted: !doc.data()?.isCompleted });
};

export const requestFile = async (fileNumber: string, attorneyId: string, attorneyName: string) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) throw new Error('File not found.');
    
    const now = new Date();
    const request: FileRequest = {
        id: `REQ-${Date.now()}`,
        requesterId: attorneyId,
        requesterName: attorneyName,
        requestedAt: now,
    };
    
    await snapshot.docs[0].ref.update({ 
        requests: FieldValue.arrayUnion(request),
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const cancelFileRequest = async (fileNumber: string, requestId: string) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) return;
    
    const file = docToType<CorrespondenceFile>(snapshot.docs[0]);
    const updatedRequests = (file.requests || []).filter(r => r.id !== requestId);
    
    await snapshot.docs[0].ref.update({ 
        requests: updatedRequests,
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const updateFileMilestones = async (fileNumber: string, milestones: Milestone[]) => {
    const q = getFileCollectionRef().where('fileNumber', '==', fileNumber);
    const snapshot = await q.get();
    if (snapshot.empty) throw new Error('File not found.');
    
    await snapshot.docs[0].ref.update({ 
        milestones,
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true };
};

export const createAttorney = async (data: any) => {
    const accessId = `AT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const docRef = await getAttorneyCollectionRef().add({
        ...data,
        accessId,
    });
    return { id: docRef.id, accessId };
};

export const getAttorneyById = async (id: string): Promise<Attorney | null> => {
    const doc = await getAttorneyCollectionRef().doc(id).get();
    if (!doc.exists) return null;
    return docToType<Attorney>(doc);
};

export const updateAttorney = async (id: string, data: any) => {
    await getAttorneyCollectionRef().doc(id).update(data);
};

/**
 * Propagates an attorney name change across all system entities.
 * This ensures consistency in file assignments, movements, and portal filters.
 */
export const propagateAttorneyNameChange = async (oldName: string, newName: string) => {
    const firestore = getFirestore(initializeAdmin());
    const filesSnapshot = await getFileCollectionRef().get();
    const censusSnapshot = await getCensusCollectionRef().where('attorney', '==', oldName).get();
    const batch = firestore.batch();
    
    const normalizedOld = oldName.toLowerCase().trim();

    // 1. Update Census Records
    censusSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { attorney: newName });
    });

    // 2. Update Case Files (Complex arrays require iteration)
    filesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        let changed = false;
        const updates: any = {};

        // Lead Assignment
        if (data.assignedTo?.toLowerCase().trim() === normalizedOld) {
            updates.assignedTo = newName;
            changed = true;
        }

        // Physical Movements
        if (data.movements) {
            const newMovements = data.movements.map((m: any) => {
                let mChanged = false;
                if (m.movedTo?.toLowerCase().trim() === normalizedOld) { m.movedTo = newName; mChanged = true; }
                if (m.receivedBy?.toLowerCase().trim() === normalizedOld) { m.receivedBy = newName; mChanged = true; }
                if (mChanged) changed = true;
                return m;
            });
            if (changed) updates.movements = newMovements;
        }

        // Internal Instructions
        if (data.internalInstructions) {
            const newInstructions = data.internalInstructions.map((i: any) => {
                let iChanged = false;
                if (i.from?.toLowerCase().trim() === normalizedOld || i.from?.toLowerCase().includes(`(${normalizedOld})`)) { 
                    i.from = i.from.replace(oldName, newName); 
                    iChanged = true; 
                }
                if (i.to?.toLowerCase().trim() === normalizedOld) { i.to = newName; iChanged = true; }
                if (iChanged) changed = true;
                return i;
            });
            if (changed) updates.internalInstructions = newInstructions;
        }

        // Pending Requests
        if (data.requests) {
            const newRequests = data.requests.map((r: any) => {
                if (r.requesterName?.toLowerCase().trim() === normalizedOld) {
                    changed = true;
                    return { ...r, requesterName: newName };
                }
                return r;
            });
            if (changed) updates.requests = newRequests;
        }

        if (changed) {
            batch.update(doc.ref, { ...updates, lastActivityAt: FieldValue.serverTimestamp() });
        }
    });

    await batch.commit();
};

export const updateUnassignedLetter = async (id: string, data: any) => {
    const docRef = getUnassignedLettersCollectionRef().doc(id);
    await docRef.update(data);
    const updated = await docRef.get();
    return { letter: docToType<Letter>(updated) };
};

export const deleteUnassignedLetter = async (id: string) => {
    await getUnassignedLettersCollectionRef().doc(id).delete();
    return { success: true };
};

export const assignToFile = async (data: any) => {
    const letterRef = getUnassignedLettersCollectionRef().doc(data.letterId);
    const letterSnap = await letterRef.get();
    if (!letterSnap.exists) throw new Error("Letter not found.");
    
    const letterData = letterSnap.data()!;
    const fileSnap = await getFileCollectionRef().where('fileNumber', '==', data.fileNumber).get();
    if (fileSnap.empty) throw new Error("File not found.");
    
    const fileDoc = fileSnap.docs[0];
    await fileDoc.ref.update({
        letters: FieldValue.arrayUnion({ id: data.letterId, ...letterData, fileNumber: data.fileNumber }),
        lastActivityAt: FieldValue.serverTimestamp()
    });
    await letterRef.delete();
    return { success: true, letter: { id: data.letterId, ...letterData } };
};

export const unassignFromFile = async (data: any) => {
    const fileSnap = await getFileCollectionRef().where('fileNumber', '==', data.fileNumber).get();
    if (fileSnap.empty) throw new Error("File not found.");
    
    const fileDoc = fileSnap.docs[0];
    const fileData = fileDoc.data()!;
    const letterToRemove = fileData.letters?.find((l: any) => l.id === data.letterId);
    if (!letterToRemove) throw new Error("Letter not found in file.");
    
    const { fileNumber, ...cleanLetterData } = letterToRemove;
    await getUnassignedLettersCollectionRef().doc(data.letterId).set(cleanLetterData);
    await fileDoc.ref.update({
        letters: FieldValue.arrayRemove(letterToRemove),
        lastActivityAt: FieldValue.serverTimestamp()
    });
    return { success: true, letter: cleanLetterData };
};

export const updateLetterInFile = async (fileNumber: string, letterId: string, data: any) => {
    const fileSnap = await getFileCollectionRef().where('fileNumber', '==', fileNumber).get();
    if (fileSnap.empty) throw new Error("File not found.");
    const fileDoc = fileSnap.docs[0];
    const letters = (fileDoc.data()!.letters || []).map((l: any) => {
        if (l.id === letterId) return { ...l, ...data };
        return l;
    });
    await fileDoc.ref.update({ letters, lastActivityAt: FieldValue.serverTimestamp() });
    return { success: true };
};

export const deleteLetterFromFile = async (fileNumber: string, letterId: string) => {
    const fileSnap = await getFileCollectionRef().where('fileNumber', '==', fileNumber).get();
    if (fileSnap.empty) throw new Error("File not found.");
    const fileDoc = fileSnap.docs[0];
    const letters = (fileDoc.data()!.letters || []).filter((l: any) => l.id !== letterId);
    await fileDoc.ref.update({ letters, lastActivityAt: FieldValue.serverTimestamp() });
    return { success: true };
};

export const batchMoveFiles = async (data: any) => {
    const batch = getFirestore(initializeAdmin()).batch();
    const newMovement: Movement = {
        id: `M-${Date.now()}`,
        date: new Date(data.date),
        movedTo: data.movedTo,
        status: data.status,
    };

    for (const fileNum of data.fileNumbers) {
        const snap = await getFileCollectionRef().where('fileNumber', '==', fileNum).get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            const updatedRequests = (doc.data()!.requests || []).filter((r: any) => r.requesterName.toLowerCase().trim() !== data.movedTo.toLowerCase().trim());
            
            const updatePayload: any = {
                movements: FieldValue.arrayUnion(newMovement),
                requests: updatedRequests,
                lastActivityAt: FieldValue.serverTimestamp()
            };

            // NEW: Support for bulk assignment/linking to group heads
            if (data.group) updatePayload.group = data.group;
            if (data.assignedTo) updatePayload.assignedTo = data.assignedTo;

            batch.update(doc.ref, updatePayload);
        }
    }
    await batch.commit();
    return { success: true };
};

export const batchPickupFiles = async (fileNumbers: string[], receivedBy: string) => {
    const firestore = getFirestore(initializeAdmin());
    const batch = firestore.batch();
    const now = new Date();
    
    // Summary mapping for WhatsApp notifications
    const pickupResults: Record<string, { fullName: string, phoneNumber: string, files: { fileNumber: string, subject: string }[] }> = {};

    const attorneySnap = await getAttorneyCollectionRef().get();
    const attorneys = attorneySnap.docs.map(doc => docToType<Attorney>(doc));

    for (const fileNum of fileNumbers) {
        const snap = await getFileCollectionRef().where('fileNumber', '==', fileNum).limit(1).get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            const fileData = doc.data();
            const movements = fileData.movements || [];
            
            // 1. Identify previous possessor for notification
            const sortedMovements = [...movements].sort((a,b) => {
                const dA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
                const dB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
                return dB.getTime() - dA.getTime();
            });
            const latest = sortedMovements[0];
            const previousPossessor = latest?.movedTo || 'Registry';

            if (previousPossessor.toLowerCase() !== 'registry') {
                const att = attorneys.find(a => a.fullName.toLowerCase().trim() === previousPossessor.toLowerCase().trim());
                if (att) {
                    if (!pickupResults[att.id]) {
                        pickupResults[att.id] = { fullName: att.fullName, phoneNumber: att.phoneNumber, files: [] };
                    }
                    pickupResults[att.id].files.push({ fileNumber: fileData.fileNumber, subject: fileData.subject });
                }
            }

            // 2. Add New Movement (Return to Registry & Auto-Acknowledge)
            const newMovement: Movement = {
                id: `M-PICKUP-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
                date: now,
                movedTo: 'Registry',
                status: 'Physically returned to Registry',
                receivedAt: now,
                receivedBy: receivedBy
            };

            batch.update(doc.ref, {
                movements: FieldValue.arrayUnion(newMovement),
                lastActivityAt: FieldValue.serverTimestamp(),
                requests: [] // Clear all pending file requests
            });
        }
    }
    await batch.commit();
    return { success: true, summary: Object.values(pickupResults) };
};

export const updateMovementInFile = async (fileNumber: string, movementId: string, data: any) => {
    const snap = await getFileCollectionRef().where('fileNumber', '==', fileNumber).get();
    if (snap.empty) throw new Error("File not found.");
    const doc = snap.docs[0];
    const movements = (doc.data()!.movements || []).map((m: any) => {
        if (m.id === movementId) return { ...m, ...data, date: new Date(data.date) };
        return m;
    });
    await doc.ref.update({ movements, lastActivityAt: FieldValue.serverTimestamp() });
    return { success: true };
};

export const deleteMovementFromFile = async (fileNumber: string, movementId: string) => {
    const snap = await getFileCollectionRef().where('fileNumber', '==', fileNumber).get();
    if (snap.empty) throw new Error("File not found.");
    const doc = snap.docs[0];
    const movements = (doc.data()!.movements || []).filter((m: any) => m.id !== movementId);
    await doc.ref.update({ movements, lastActivityAt: FieldValue.serverTimestamp() });
    return { success: true };
};

export const confirmFileReceipt = async (fileNumber: string, movementId: string, receivedBy: string) => {
    const snap = await getFileCollectionRef().where('fileNumber', '==', fileNumber).get();
    if (snap.empty) throw new Error("File not found.");
    const doc = snap.docs[0];
    const movements = (doc.data()!.movements || []).map((m: any) => {
        if (m.id === movementId) return { ...m, receivedAt: new Date(), receivedBy };
        return m;
    });
    await doc.ref.update({ movements, lastActivityAt: FieldValue.serverTimestamp() });
    return { success: true };
};

export const createArchiveRecord = async (data: any) => {
    const docRef = await getArchiveCollectionRef().add(data);
    return { id: docRef.id };
};

export const updateArchiveRecord = async (id: string, data: any) => {
    await getArchiveCollectionRef().doc(id).update(data);
};

export const deleteArchiveRecord = async (id: string) => {
    await getArchiveCollectionRef().doc(id).delete();
    return { success: true };
};

export const createCensusRecord = async (data: any) => {
    const docRef = await getCensusCollectionRef().add(data);
    return { id: docRef.id };
};

export const updateCensusRecord = async (id: string, data: any) => {
    await getCensusCollectionRef().doc(id).update(data);
};

export const deleteCensusRecord = async (id: string) => {
    await getCensusCollectionRef().doc(id).delete();
    return { success: true };
};
