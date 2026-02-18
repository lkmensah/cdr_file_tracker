'use client';
import { Dashboard } from '@/components/dashboard';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CorrespondenceFile, Letter, UserProfile, Reminder } from '@/lib/types';
import { collection, query, orderBy, where } from 'firebase/firestore';
import React from 'react';

export default function Home() {
  const firestore = useFirestore();

  // Query for all files
  const filesQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(collection(firestore, 'files'), orderBy('dateCreated', 'desc'));
    },
    [firestore]
  );
  const { data: files, isLoading: isLoadingFiles } = useCollection<CorrespondenceFile>(filesQuery);

  // Query for general reminders (not tied to a specific file)
  const generalRemindersQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(collection(firestore, 'reminders'), where('isCompleted', '==', false));
    },
    [firestore]
  );
  const { data: generalReminders, isLoading: isLoadingReminders } = useCollection<Reminder>(generalRemindersQuery);

  // Query for all users to map phone numbers for WhatsApp
  const usersQuery = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return query(collection(firestore, 'users'));
    },
    [firestore]
  );
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  // Query for all assigned and unassigned incoming mail
  const incomingMailAssignedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'files')); // We'll filter letters on the client
  }, [firestore]);
  const { data: filesForMail, isLoading: isLoadingMailAssigned } = useCollection<CorrespondenceFile>(incomingMailAssignedQuery);

  const incomingMailUnassignedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'unassignedLetters'), where('type', '==', 'Incoming'));
  }, [firestore]);
  const { data: unassignedMail, isLoading: isLoadingMailUnassigned } = useCollection<Letter>(incomingMailUnassignedQuery);

  const allIncomingMail = React.useMemo(() => {
    const assigned = filesForMail?.flatMap(f => f.letters.filter(l => l.type === 'Incoming')) || [];
    return [...assigned, ...(unassignedMail || [])];
  }, [filesForMail, unassignedMail]);

  // Query for all assigned and unassigned court processes
  const courtProcessesAssignedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'files')); // Filter on client
  }, [firestore]);
  const { data: filesForProcesses, isLoading: isLoadingProcessesAssigned } = useCollection<CorrespondenceFile>(courtProcessesAssignedQuery);

  const courtProcessesUnassignedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'unassignedLetters'), where('type', '==', 'Court Process'));
  }, [firestore]);
  const { data: unassignedProcesses, isLoading: isLoadingProcessesUnassigned } = useCollection<Letter>(courtProcessesUnassignedQuery);

  const allCourtProcesses = React.useMemo(() => {
    const assigned = filesForProcesses?.flatMap(f => f.letters.filter(l => l.type === 'Court Process')) || [];
    return [...assigned, ...(unassignedProcesses || [])];
  }, [filesForProcesses, unassignedProcesses]);
  
  const isLoadingData =
    isLoadingFiles ||
    isLoadingReminders ||
    isLoadingUsers ||
    isLoadingMailAssigned ||
    isLoadingMailUnassigned ||
    isLoadingProcessesAssigned ||
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
