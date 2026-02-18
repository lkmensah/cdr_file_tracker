'use client';

import type { ArchiveRecord } from '@/lib/types';
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArchivesTable } from './archives-table';
import { NewArchiveDialog } from './new-archive-dialog';

export function ArchivesPage({
  initialRecords,
}: {
  initialRecords: ArchiveRecord[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [recordToEdit, setRecordToEdit] = useState<ArchiveRecord | null>(null);
  const [isNewRecordDialogOpen, setIsNewRecordDialogOpen] = useState(false);

  const filteredRecords = useMemo(() => {
    if (!searchTerm) {
      return initialRecords;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return initialRecords.filter(record =>
      record.boxNumber.toLowerCase().includes(lowercasedTerm) ||
      record.fileNumber.toLowerCase().includes(lowercasedTerm) ||
      (record.suitNumber && record.suitNumber.toLowerCase().includes(lowercasedTerm)) ||
      record.title.toLowerCase().includes(lowercasedTerm) ||
      record.status.toLowerCase().includes(lowercasedTerm)
    );
  }, [searchTerm, initialRecords]);

  const handleOpenEditDialog = (record: ArchiveRecord) => {
    setRecordToEdit(record);
    setIsNewRecordDialogOpen(true);
  };

  const handleNewRecordOpenChange = (isOpen: boolean) => {
    setIsNewRecordDialogOpen(isOpen);
    if (!isOpen) {
      setRecordToEdit(null);
    }
  };

  return (
    <div className="container mx-auto">
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className='space-y-1'>
                        <CardTitle>Archived Files</CardTitle>
                        <CardDescription>A record of all archived files and their status.</CardDescription>
                    </div>
                    <div className="flex-shrink-0">
                        <NewArchiveDialog 
                            isOpen={isNewRecordDialogOpen && !recordToEdit}
                            onOpenChange={handleNewRecordOpenChange}
                        />
                    </div>
                </div>
                <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="w-full pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <ArchivesTable records={filteredRecords} onEditRecord={handleOpenEditDialog} />
            </CardContent>
        </Card>
        {isNewRecordDialogOpen && recordToEdit && (
            <NewArchiveDialog
                isOpen={isNewRecordDialogOpen}
                onOpenChange={handleNewRecordOpenChange}
                record={recordToEdit}
            />
        )}
    </div>
  );
}
