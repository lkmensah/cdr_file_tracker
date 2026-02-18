
'use client';

import { ArchivesPage } from '@/components/archives-page';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { ArchiveRecord } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import React from 'react';

export default function Archives() {
  const firestore = useFirestore();

  const archivesQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'archives'), orderBy('endDate', 'desc'));
    },
    [firestore]
  );
  
  const { data: archives, isLoading } = useCollection<ArchiveRecord>(archivesQuery);

  if (isLoading && !archives) {
    return <div className="flex-1 p-4 sm:p-6 md:p-8">Loading...</div>;
  }

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8">
      <ArchivesPage initialRecords={archives || []} />
    </main>
  );
}
