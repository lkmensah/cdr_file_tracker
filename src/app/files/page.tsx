
'use client';

import { FilesPage } from '@/components/files-page';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CorrespondenceFile } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import React from 'react';

export default function Files() {
  const firestore = useFirestore();
  
  const filesQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(collection(firestore, 'files'), orderBy('dateCreated', 'desc'));
    },
    [firestore]
  );
  
  const { data: files, isLoading } = useCollection<CorrespondenceFile>(filesQuery);

  if (isLoading && !files) {
      return <main className="flex-1 p-4 sm:p-6 md:p-8"><div>Loading files...</div></main>;
  }

  return (
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <FilesPage initialFiles={files || []} />
      </main>
  );
}
