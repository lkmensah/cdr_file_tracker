
'use client';

import { GlobalSearchPage } from '@/components/global-search-page';
import type { AllData } from '@/components/global-search-page';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CorrespondenceFile, Letter, ArchiveRecord, CensusRecord } from '@/lib/types';
import { collection, query, orderBy, where } from 'firebase/firestore';
import React from 'react';

export default function SearchPage() {
    const firestore = useFirestore();

    const filesQuery = useMemoFirebase(() => !firestore ? null : query(collection(firestore, 'files')), [firestore]);
    const incomingMailQuery = useMemoFirebase(() => !firestore ? null : query(collection(firestore, 'unassignedLetters'), where('type', '==', 'Incoming')), [firestore]);
    const courtProcessesQuery = useMemoFirebase(() => !firestore ? null : query(collection(firestore, 'unassignedLetters'), where('type', '==', 'Court Process')), [firestore]);
    const archivesQuery = useMemoFirebase(() => !firestore ? null : query(collection(firestore, 'archives')), [firestore]);
    const censusQuery = useMemoFirebase(() => !firestore ? null : query(collection(firestore, 'census')), [firestore]);
    
    const { data: files, isLoading: loadingFiles } = useCollection<CorrespondenceFile>(filesQuery);
    const { data: incomingMail, isLoading: loadingMail } = useCollection<Letter>(incomingMailQuery);
    const { data: courtProcesses, isLoading: loadingProcesses } = useCollection<Letter>(courtProcessesQuery);
    const { data: archives, isLoading: loadingArchives } = useCollection<ArchiveRecord>(archivesQuery);
    const { data: censusRecords, isLoading: loadingCensus } = useCollection<CensusRecord>(censusQuery);

    const allData: AllData = React.useMemo(() => ({
        files: files || [],
        incomingMail: incomingMail || [],
        courtProcesses: courtProcesses || [],
        archives: archives || [],
        censusRecords: censusRecords || [],
    }), [files, incomingMail, courtProcesses, archives, censusRecords]);
    
    const isLoading = loadingFiles || loadingMail || loadingProcesses || loadingArchives || loadingCensus;

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8">
      {isLoading && !files ? <div>Loading search data...</div> : <GlobalSearchPage allData={allData} />}
    </main>
  );
}
