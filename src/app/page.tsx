
'use client';
import { Dashboard } from '@/components/dashboard';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CorrespondenceFile, Letter, UserProfile, Reminder } from '@/lib/types';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import React from 'react';

export default function Home() {
  const firestore = useFirestore();

  // Optimized Dashboard: Only fetch the most recent files for visual context
  // Detailed stats are now handled via Aggregation Server Actions
  const filesQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(collection(firestore, 'files'), orderBy('dateCreated', 'desc'), limit(200));
    },
    [firestore]
  );
  const { data: files, isLoading: isLoadingFiles } = useCollection<CorrespondenceFile>(filesQuery);

  const generalRemindersQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(collection(firestore, 'reminders'), where('isCompleted', '==', false), limit(50));
    },
    [firestore]
  );
  const { data: generalReminders, isLoading: isLoadingReminders } = useCollection<Reminder>(generalRemindersQuery);

  const usersQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(collection(firestore, 'users'), limit(100));
    },
    [firestore]
  );
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const incomingMailUnassignedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'unassignedLetters'), where('type', '==', 'Incoming'), limit(100));
  }, [firestore]);
  const { data: unassignedMail, isLoading: isLoadingMailUnassigned } = useCollection<Letter>(incomingMailUnassignedQuery);

  const courtProcessesUnassignedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'unassignedLetters'), where('type', '==', 'Court Process'), limit(100));
  }, [firestore]);
  const { data: unassignedProcesses, isLoading: isLoadingProcessesUnassigned } = useCollection<Letter>(courtProcessesUnassignedQuery);

  const allIncomingMail = React.useMemo(() => {
    const assigned = files?.flatMap(f => f.letters.filter(l => l.type === 'Incoming')) || [];
    return [...assigned, ...(unassignedMail || [])];
  }, [files, unassignedMail]);

  const allCourtProcesses = React.useMemo(() => {
    const assigned = files?.flatMap(f => f.letters.filter(l => l.type === 'Court Process')) || [];
    return [...assigned, ...(unassignedProcesses || [])];
  }, [files, unassignedProcesses]);
  
  const isLoadingData =
    isLoadingFiles ||
    isLoadingReminders ||
    isLoadingUsers ||
    isLoadingMailUnassigned ||
    isLoadingProcessesUnassigned;

  if (isLoadingData && !files) {
    return <main className="flex-1 p-4 sm:p-6 md:p-8 flex items-center justify-center"><div>Loading dashboard...</div></main>;
  }

  return (
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <Dashboard
          initialFiles={files || []}
          initialIncomingMail={allIncomingMail}
          initialCourtProcesses={allCourtProcesses}
          generalReminders={generalReminders || []}
        />
      </main>
  );
}
