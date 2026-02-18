
'use client';

import { CensusPage } from '@/components/census-page';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CensusRecord, CorrespondenceFile } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import React from 'react';

export default function Census() {
  const firestore = useFirestore();

  const censusQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'census'), orderBy('date', 'desc'));
    },
    [firestore]
  );
  
  const filesQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'files'), orderBy('dateCreated', 'desc'));
    },
    [firestore]
  );

  const { data: records, isLoading: isLoadingRecords } = useCollection<CensusRecord>(censusQuery);
  const { data: files, isLoading: isLoadingFiles } = useCollection<CorrespondenceFile>(filesQuery);

  const isLoading = (isLoadingRecords || isLoadingFiles) && (!records || !files);
  
  if (isLoading) {
    return <div className="flex-1 p-4 sm:p-6 md:p-8">Loading...</div>;
  }

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8">
      <CensusPage initialRecords={records || []} files={files || []} />
    </main>
  );
}
