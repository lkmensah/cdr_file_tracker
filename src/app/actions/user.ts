
'use server';

import { initializeAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { revalidatePath } from 'next/cache';

export async function createUserProfile(formData: FormData): Promise<void> {
  const adminApp = initializeAdmin();
  const firestore = getFirestore(adminApp);
  const adminAuth = getAuth(adminApp);
  
  const userId = formData.get('userId') as string;
  const email = formData.get('email') as string;
  const fullName = formData.get('fullName') as string;
  const phoneNumber = formData.get('phoneNumber') as string;
  const role = (formData.get('role') as string) || 'staff';

  if (!userId || !email || !fullName) {
    throw new Error('Missing required fields for user profile creation.');
  }

  const userDocRef = firestore.collection('users').doc(userId);

  try {
    // Set Custom Claims for cryptographic security
    await adminAuth.setCustomUserClaims(userId, { role });

    // Update Firebase Auth user
    await adminAuth.updateUser(userId, {
        displayName: fullName,
        email: email,
    });

    // Create user profile in Firestore
    await userDocRef.set({
      id: userId,
      email: email,
      fullName: fullName,
      phoneNumber: phoneNumber || null,
      role: role,
      passwordChangeRequired: true,
    }, { merge: true });
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new Error('Failed to create user profile.');
  }
}

export async function updateUserProfile(formData: FormData): Promise<{ success: boolean, message: string }> {
    const adminApp = initializeAdmin();
    const firestore = getFirestore(adminApp);
    const adminAuth = getAuth(adminApp);
    
    const userId = formData.get('userId') as string;
    const fullName = formData.get('fullName') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const rank = formData.get('rank') as string;
    const group = formData.get('group') as string;

    if (!userId) {
        return { success: false, message: 'User ID is required.' };
    }

    try {
        const userDocRef = firestore.collection('users').doc(userId);
        const doc = await userDocRef.get();
        const role = doc.data()?.role || 'staff';

        // Ensure custom claims are synced
        await adminAuth.setCustomUserClaims(userId, { role });
        
        await userDocRef.update({
            fullName: fullName,
            phoneNumber: phoneNumber || null,
            rank: rank || null,
            group: group || null,
        });
        
        revalidatePath('/');
        return { success: true, message: 'Profile updated successfully.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to update profile.' };
    }
}

export async function updatePassword(formData: FormData): Promise<{ success: boolean, message: string }> {
    const adminApp = initializeAdmin();
    const firestore = getFirestore(adminApp);
    const adminAuth = getAuth(adminApp);

    const userId = formData.get('userId') as string;
    const newPassword = formData.get('newPassword') as string;

    if (!userId || !newPassword) {
        return { success: false, message: 'User ID and new password are required.' };
    }

    try {
        await adminAuth.updateUser(userId, { password: newPassword });
        await firestore.collection('users').doc(userId).update({
            passwordChangeRequired: false,
        });
        return { success: true, message: 'Password updated successfully.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to update password.' };
    }
}
