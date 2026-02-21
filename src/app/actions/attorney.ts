
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as db from '@/lib/data';
import { logUserActivity } from '@/lib/audit';
import { initializeAdmin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

async function verifyUser(clientToken: string) {
    const adminAuth = getAuth(initializeAdmin());
    const decoded = await adminAuth.verifyIdToken(clientToken);
    const user = await adminAuth.getUser(decoded.uid);
    return user.displayName || user.email || 'Admin';
}

const AttorneySchema = z.object({
    fullName: z.string().min(1, 'Name is required.'),
    email: z.string().email('Invalid email.').optional().or(z.literal('')),
    phoneNumber: z.string().min(1, 'Phone number is required.'),
    rank: z.string().optional(),
    group: z.string().optional(),
    isGroupHead: z.boolean().optional(),
    isActingGroupHead: z.boolean().optional(),
    isSG: z.boolean().optional(),
    isActingSG: z.boolean().optional(),
});

export async function createAttorney(clientToken: string, formData: FormData) {
    const userName = await verifyUser(clientToken);
    const data = Object.fromEntries(formData.entries());
    
    // Checkbox handling
    const rawData = {
        ...data,
        isGroupHead: formData.get('isGroupHead') === 'on' || formData.get('isGroupHead') === 'true',
        isActingGroupHead: formData.get('isActingGroupHead') === 'on' || formData.get('isActingGroupHead') === 'true',
        isSG: formData.get('isSG') === 'on' || formData.get('isSG') === 'true',
        isActingSG: formData.get('isActingSG') === 'on' || formData.get('isActingSG') === 'true'
    };

    const validated = AttorneySchema.safeParse(rawData);

    if (!validated.success) return { message: validated.error.errors[0].message };

    try {
        const name = validated.data.fullName.trim();
        const phone = validated.data.phoneNumber.trim();

        // Data Integrity: Check for existing attorney with same Name and Contact (Regardless of Group)
        const firestore = getFirestore(initializeAdmin());
        const dupeCheck = await firestore.collection('attorneys')
            .where('fullName', '==', name)
            .where('phoneNumber', '==', phone)
            .get();

        if (!dupeCheck.empty) {
            return { message: 'Registration Error: A practitioner with this name and phone number is already in the system.' };
        }

        await db.createAttorney(validated.data);
        const roles = [];
        if (validated.data.isSG) roles.push('Solicitor General');
        if (validated.data.isActingSG) roles.push('Acting Solicitor General');
        if (validated.data.isGroupHead) roles.push('Group Head');
        if (validated.data.isActingGroupHead) roles.push('Acting Group Head');
        
        await logUserActivity(userName, 'CREATE_ATTORNEY', `Added attorney: ${validated.data.fullName} ${roles.length > 0 ? `(${roles.join(', ')})` : ''}`);
        revalidatePath('/attorneys');
        return { message: 'Success! Attorney added.' };
    } catch (error) {
        return { message: 'Failed to add attorney.' };
    }
}

export async function updateAttorney(clientToken: string, formData: FormData) {
    const userName = await verifyUser(clientToken);
    const id = formData.get('id') as string;
    const data = Object.fromEntries(formData.entries());
    
    const rawData = {
        ...data,
        isGroupHead: formData.get('isGroupHead') === 'on' || formData.get('isGroupHead') === 'true',
        isActingGroupHead: formData.get('isActingGroupHead') === 'on' || formData.get('isActingGroupHead') === 'true',
        isSG: formData.get('isSG') === 'on' || formData.get('isSG') === 'true',
        isActingSG: formData.get('isActingSG') === 'on' || formData.get('isActingSG') === 'true'
    };

    const validated = AttorneySchema.safeParse(rawData);

    if (!validated.success) return { message: validated.error.errors[0].message };

    try {
        const currentAttorney = await db.getAttorneyById(id);
        if (!currentAttorney) return { message: 'Attorney not found.' };

        // Data Integrity: Ensure update doesn't create a duplicate name/phone combination
        const name = validated.data.fullName.trim();
        const phone = validated.data.phoneNumber.trim();

        const firestore = getFirestore(initializeAdmin());
        const dupeCheck = await firestore.collection('attorneys')
            .where('fullName', '==', name)
            .where('phoneNumber', '==', phone)
            .get();

        const duplicate = dupeCheck.docs.find(doc => doc.id !== id);
        if (duplicate) {
            return { message: 'Update Error: Another practitioner with this name and phone number is already registered.' };
        }

        // Normalize names and groups for comparison
        const oldName = currentAttorney.fullName.trim();
        const newName = validated.data.fullName.trim();
        const oldGroup = (currentAttorney.group || 'no group yet').trim().toLowerCase();
        const newGroup = (validated.data.group || 'no group yet').trim().toLowerCase();
        
        const nameChanged = oldName.toLowerCase() !== newName.toLowerCase();
        const groupChanged = oldGroup !== newGroup;

        // Perform primary update in Registry
        await db.updateAttorney(id, validated.data);

        // 1. Handle Name Change System-wide (Atomic)
        if (nameChanged) {
            await db.propagateAttorneyNameChange(oldName, newName);
            await logUserActivity(userName, 'UPDATE_ATTORNEY_NAME', `Renamed attorney from ${oldName} to ${newName}. All records updated.`);
        }

        // 2. Handle Group Migration System-wide (Retroactive)
        if (groupChanged || nameChanged) {
            const targetGroup = validated.data.group || 'no group yet';
            await db.propagateAttorneyGroupChange(newName, targetGroup);
            await logUserActivity(userName, 'ATTORNEY_GROUP_MIGRATION', `Migrated ${newName} to ${targetGroup}. All associated files moved for executive oversight.`);
        } else {
            const roles = [];
            if (validated.data.isActingSG) roles.push('Acting SG');
            if (validated.data.isActingGroupHead) roles.push('Acting GH');
            await logUserActivity(userName, 'UPDATE_ATTORNEY', `Updated attorney details: ${newName} ${roles.length > 0 ? `(${roles.join(', ')})` : ''}`);
        }

        revalidatePath('/attorneys');
        revalidatePath('/census');
        revalidatePath('/files');
        revalidatePath('/portal/dashboard');
        return { message: 'Success! Attorney profile and files updated.' };
    } catch (error) {
        console.error("Propagation error:", error);
        return { message: 'Failed to update attorney.' };
    }
}

export async function resetDeviceBinding(clientToken: string, id: string) {
    const userName = await verifyUser(clientToken);
    try {
        const attorney = await db.getAttorneyById(id);
        if (!attorney) return { message: 'Attorney not found.' };
        
        await db.resetDeviceBinding(id);
        await logUserActivity(userName, 'RESET_DEVICE_BINDING', `Reset security lock for: ${attorney.fullName} (Access ID: ${attorney.accessId})`);
        revalidatePath('/attorneys');
        return { message: 'Success! Device binding reset. The attorney can now log in on a new device.' };
    } catch (error) {
        return { message: 'Failed to reset device binding.' };
    }
}

export async function toggleAttorneyBlock(clientToken: string, id: string, isBlocked: boolean) {
    const userName = await verifyUser(clientToken);
    try {
        const attorney = await db.getAttorneyById(id);
        if (!attorney) return { message: 'Attorney not found.' };
        
        const firestore = getFirestore(initializeAdmin());
        await firestore.collection('attorneys').doc(id).update({ isBlocked });
        
        const actionLabel = isBlocked ? 'BLOCKED' : 'UNBLOCKED';
        await logUserActivity(userName, 'TOGGLE_ATTORNEY_BLOCK', `${actionLabel} portal access for: ${attorney.fullName}`);
        
        revalidatePath('/attorneys');
        return { message: `Success! Attorney has been ${isBlocked ? 'blocked' : 'unblocked'}.` };
    } catch (error) {
        return { message: 'Failed to update access status.' };
    }
}

export async function updateAttorneyPresence(id: string) {
    try {
        // This is a lower-security action, we don't verify admin token here 
        // as it's called by practitioners periodically.
        const firestore = getFirestore(initializeAdmin());
        await firestore.collection('attorneys').doc(id).update({ 
            lastActiveAt: new Date() 
        });
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}
