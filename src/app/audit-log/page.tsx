
'use client';

import { AuditLogPage } from '@/components/audit-log-page';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { AuditLog } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import React from 'react';

export default function AuditLog() {
  const firestore = useFirestore();

  const auditLogsQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'auditLogs'), orderBy('timestamp', 'desc'));
    },
    [firestore]
  );

  const { data: logs, isLoading } = useCollection<AuditLog>(auditLogsQuery);

  if (isLoading && !logs) {
    return <div className="flex-1 p-4 sm:p-6 md:p-8">Loading...</div>;
  }

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8">
      <AuditLogPage initialLogs={logs || []} />
    </main>
  );
}
