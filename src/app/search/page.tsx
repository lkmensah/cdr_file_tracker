
'use client';

import { GlobalSearchPage } from '@/components/global-search-page';
import React from 'react';

/**
 * PRODUCTION OPTIMIZATION: Global Search now uses server-side querying.
 * We no longer fetch all data on mount to prevent 'Rate Exceeded' errors.
 */
export default function SearchPage() {
  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8">
      <GlobalSearchPage />
    </main>
  );
}
