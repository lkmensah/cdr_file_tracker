
'use client';

import * as React from 'react';
import type { CensusRecord } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ClipboardList, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useProfile } from './auth-provider';
import { deleteCensusRecord } from '@/app/actions';
import { useAuthAction } from '@/hooks/use-auth-action';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (!isNaN(new Date(value).getTime())) return new Date(value);
    return null;
};

export function CensusTable({ records, onEditRecord }: { records: CensusRecord[], onEditRecord: (record: CensusRecord) => void; }) {
  const { isAdmin } = useProfile();
  const { toast } = useToast();
  const [recordToDelete, setRecordToDelete] = React.useState<CensusRecord | null>(null);

  const { exec: authDelete, isLoading: isDeleting } = useAuthAction(deleteCensusRecord, {
    onSuccess: () => {
        toast({ title: 'Census record deleted.' });
        setRecordToDelete(null);
    }
  });

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No Census Records Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          There are no records matching your search.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>File Number</TableHead>
              <TableHead className="hidden sm:table-cell">Suit Number</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Attorney</TableHead>
              <TableHead className="w-[50px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map(record => {
              const recordDate = toDate(record.date);
              return (
              <TableRow key={record.id}>
                <TableCell>{recordDate ? format(recordDate, 'PPP') : 'N/A'}</TableCell>
                <TableCell className="font-medium">{record.fileNumber}</TableCell>
                <TableCell className="hidden sm:table-cell">{record.suitNumber}</TableCell>
                <TableCell className="max-w-[200px] truncate">{record.subject}</TableCell>
                <TableCell>{record.attorney}</TableCell>
                 <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditRecord(record)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {isAdmin && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRecordToDelete(record)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Record
                            </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanentely delete this census registry entry.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => recordToDelete && authDelete(recordToDelete.id)} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
