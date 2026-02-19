'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as db from '@/lib/data';
import { logUserActivity } from '@/lib/audit';
import { initializeAdmin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';

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
    isSG: z.boolean().optional(),
});

export async function createAttorney(clientToken: string, formData: FormData) {
    const userName = await verifyUser(clientToken);
    const data = Object.fromEntries(formData.entries());
    
    // Checkbox handling
    const rawData = {
        ...data,
        isGroupHead: formData.get('isGroupHead') === 'on' || formData.get('isGroupHead') === 'true',
        isSG: formData.get('isSG') === 'on' || formData.get('isSG') === 'true'
    };

    const validated = AttorneySchema.safeParse(rawData);

    if (!validated.success) return { message: validated.error.errors[0].message };

    try {
        await db.createAttorney(validated.data);
        const roles = [];
        if (validated.data.isSG) roles.push('Solicitor General');
        if (validated.data.isGroupHead) roles.push('Group Head');
        
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
        isSG: formData.get('isSG') === 'on' || formData.get('isSG') === 'true'
    };

    const validated = AttorneySchema.safeParse(rawData);

    if (!validated.success) return { message: validated.error.errors[0].message };

    try {
        const currentAttorney = await db.getAttorneyById(id);
        if (!currentAttorney) return { message: 'Attorney not found.' };

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
        // If name changed, we search using the NEW name since propagation just finished.
        if (groupChanged || nameChanged) {
            const targetGroup = validated.data.group || 'no group yet';
            await db.propagateAttorneyGroupChange(newName, targetGroup);
            await logUserActivity(userName, 'ATTORNEY_GROUP_MIGRATION', `Migrated ${newName} to ${targetGroup}. All associated files moved for executive oversight.`);
        } else {
            await logUserActivity(userName, 'UPDATE_ATTORNEY', `Updated attorney details: ${newName}`);
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
