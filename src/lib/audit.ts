
'use server';

import { addAuditLog as addLog } from '@/lib/data';

// This function now runs on the server.
export async function logUserActivity(
  userName: string,
  action: string,
  details: string
): Promise<void> {
  try {
      await addLog({
          userName,
          action,
          details,
      });
  } catch (e) {
      console.error("Failed to write audit log to Firestore", e);
      // Depending on requirements, you might want to re-throw or handle differently
  }
}
