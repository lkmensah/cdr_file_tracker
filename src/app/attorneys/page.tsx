
'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Attorney } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import React from 'react';
import { AttorneysPage } from '@/components/attorneys-page';

export default function Attorneys() {
  const firestore = useFirestore();

  const attorneysQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'attorneys'), orderBy('fullName', 'asc'));
    },
    [firestore]
  );

  const { data: attorneys, isLoading } = useCollection<Attorney>(attorneysQuery);

  if (isLoading && !attorneys) {
    return <main className="flex-1 p-4 flex items-center justify-center"><div>Loading attorneys...</div></main>;
  }

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8">
      <AttorneysPage initialAttorneys={attorneys || []} />
    </main>
  );
}
