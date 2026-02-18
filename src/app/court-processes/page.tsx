
'use client';

import { GeneralCorrespondence } from '@/components/general-correspondence';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CorrespondenceFile, Letter } from '@/lib/types';
import { collection, query, where, orderBy } from 'firebase/firestore';
import React from 'react';

export default function CourtProcessesPage() {
    const firestore = useFirestore();

    const lettersQuery = useMemoFirebase(
        () => {
            if (!firestore) return null;
            return query(
                collection(firestore, 'unassignedLetters'),
                where('type', '==', 'Court Process'),
                orderBy('date', 'desc')
            );
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

    const { data: letters, isLoading: isLoadingProcesses } = useCollection<Letter>(lettersQuery);
    const { data: files, isLoading: isLoadingFiles } = useCollection<CorrespondenceFile>(filesQuery);

    const isLoading = (isLoadingProcesses || isLoadingFiles) && (!letters || !files);

    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="container mx-auto">
            {isLoading ? (
                <div>Loading...</div>
            ) : (
                <GeneralCorrespondence
                    title="General Court Processes"
                    description="Log all court processes here before assigning them to a specific file. Items here are not yet filed."
                    correspondenceType="Court Process"
                    initialItems={letters || []}
                    files={files || []}
                />
            )}
        </div>
        </main>
    );
}
