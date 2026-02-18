
'use client';

import type { CorrespondenceFile } from '@/lib/types';
import React, { useState, useMemo, useEffect } from 'react';
import { FileTable } from '@/components/file-table';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewFile } from './new-file-dialog';
import { Button } from './ui/button';

const PAGE_SIZE = 25;

export function FilesPage({
  initialFiles,
}: {
  initialFiles: CorrespondenceFile[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [files, setFiles] = useState(initialFiles);
  const [fileToEdit, setFileToEdit] = useState<CorrespondenceFile | null>(null);
  const [isEditFileOpen, setIsEditFileOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredFiles = useMemo(() => {
    if (!searchTerm) {
      return files;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return files.filter(file =>
      file.fileNumber.toLowerCase().includes(lowercasedTerm) ||
      (file.suitNumber && file.suitNumber.toLowerCase().includes(lowercasedTerm)) ||
      (file.category && file.category.toLowerCase().includes(lowercasedTerm)) ||
      (file.subject && file.subject.toLowerCase().includes(lowercasedTerm)) ||
      (file.assignedTo && file.assignedTo.toLowerCase().includes(lowercasedTerm)) ||
      (file.movements && file.movements.some(m => m.movedTo.toLowerCase().includes(lowercasedTerm))) ||
      file.letters.some(l => 
        l.subject.toLowerCase().includes(lowercasedTerm) ||
        (l.documentNo && l.documentNo.toLowerCase().includes(lowercasedTerm))
      )
    );
  }, [searchTerm, files]);

  const totalPages = Math.ceil(filteredFiles.length / PAGE_SIZE);
  
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFiles.slice(start, start + PAGE_SIZE);
  }, [filteredFiles, currentPage]);

  const handleOpenEditFile = (file: CorrespondenceFile) => {
    setFileToEdit(file);
    setIsEditFileOpen(true);
  };

  const handleEditFileOpenChange = (isOpen: boolean) => {
    setIsEditFileOpen(isOpen);
    if (!isOpen) {
      setFileToEdit(null);
    }
  };

  return (
    <div className="container mx-auto space-y-6">
        <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="space-y-1">
                <CardTitle>All Files</CardTitle>
                <p className="text-sm text-muted-foreground">
                    {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'} found
                </p>
              </div>
              <div className="flex-shrink-0">
                <NewFile />
              </div>
            </div>
            <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search by file number, subject, attorney..."
                className="w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <FileTable files={paginatedFiles} onEditFile={handleOpenEditFile} />
            
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                        Showing <span className="font-medium">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
                        <span className="font-medium">
                            {Math.min(currentPage * PAGE_SIZE, filteredFiles.length)}
                        </span> of{' '}
                        <span className="font-medium">{filteredFiles.length}</span> files
                    </p>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <div className="text-sm font-medium">
                            Page {currentPage} of {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </CardContent>
        </Card>
        {isEditFileOpen && <NewFile isOpen={isEditFileOpen} onOpenChange={handleEditFileOpenChange} file={fileToEdit} />}
    </div>
  );
}
