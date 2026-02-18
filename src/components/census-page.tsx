
'use client';

import type { CensusRecord, CorrespondenceFile } from '@/lib/types';
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CensusTable } from './census-table';
import { NewCensusDialog } from './new-census-dialog';

export function CensusPage({
  initialRecords,
  files,
}: {
  initialRecords: CensusRecord[];
  files: CorrespondenceFile[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [recordToEdit, setRecordToEdit] = useState<CensusRecord | null>(null);
  const [isNewRecordDialogOpen, setIsNewRecordDialogOpen] = useState(false);


  const filteredRecords = useMemo(() => {
    if (!searchTerm) {
      return initialRecords;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return initialRecords.filter(record =>
      record.fileNumber.toLowerCase().includes(lowercasedTerm) ||
      (record.suitNumber && record.suitNumber.toLowerCase().includes(lowercasedTerm)) ||
      record.subject.toLowerCase().includes(lowercasedTerm) ||
      record.attorney.toLowerCase().includes(lowercasedTerm)
    );
  }, [searchTerm, initialRecords]);

  const handleOpenEditDialog = (record: CensusRecord) => {
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
                        <CardTitle>File Census</CardTitle>
                        <CardDescription>A record of all files and their assigned attorneys.</CardDescription>
                    </div>
                    <div className="flex-shrink-0">
                        <NewCensusDialog 
                            isOpen={isNewRecordDialogOpen && !recordToEdit}
                            onOpenChange={handleNewRecordOpenChange}
                            files={files}
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
                <CensusTable records={filteredRecords} onEditRecord={handleOpenEditDialog} />
            </CardContent>
        </Card>
        {isNewRecordDialogOpen && recordToEdit && (
            <NewCensusDialog
                isOpen={isNewRecordDialogOpen}
                onOpenChange={handleNewRecordOpenChange}
                record={recordToEdit}
                files={files}
            />
        )}
    </div>
  );
}
