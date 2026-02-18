
'use client';

import type { Attorney } from '@/lib/types';
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AttorneysTable } from './attorneys-table';
import { NewAttorneyDialog } from './new-attorney-dialog';

export function AttorneysPage({
  initialAttorneys,
}: {
  initialAttorneys: Attorney[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [attorneyToEdit, setAttorneyToEdit] = useState<Attorney | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredAttorneys = useMemo(() => {
    if (!searchTerm) return initialAttorneys;
    const term = searchTerm.toLowerCase();
    return initialAttorneys.filter(a =>
      a.fullName.toLowerCase().includes(term) ||
      (a.rank && a.rank.toLowerCase().includes(term)) ||
      (a.group && a.group.toLowerCase().includes(term)) ||
      a.email.toLowerCase().includes(term)
    );
  }, [searchTerm, initialAttorneys]);

  const handleEdit = (attorney: Attorney) => {
    setAttorneyToEdit(attorney);
    setIsDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setAttorneyToEdit(null);
  };

  return (
    <div className="container mx-auto">
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className='space-y-1'>
                        <CardTitle>Attorneys</CardTitle>
                        <CardDescription>A master registry of all legal practitioners.</CardDescription>
                    </div>
                    <div className="flex-shrink-0">
                        <NewAttorneyDialog 
                            isOpen={isDialogOpen && !attorneyToEdit}
                            onOpenChange={handleOpenChange}
                        />
                    </div>
                </div>
                <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, rank, group..."
                        className="w-full pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <AttorneysTable attorneys={filteredAttorneys} onEdit={handleEdit} />
            </CardContent>
        </Card>
        {isDialogOpen && attorneyToEdit && (
            <NewAttorneyDialog
                isOpen={isDialogOpen}
                onOpenChange={handleOpenChange}
                attorney={attorneyToEdit}
            />
        )}
    </div>
  );
}
