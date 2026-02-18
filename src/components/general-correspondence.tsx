
'use client';

import type { Letter, CorrespondenceType, CorrespondenceFile } from '@/lib/types';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { GeneralCorrespondenceForm } from './general-correspondence-form';
import { format } from 'date-fns';
import { AssignFileDialog } from './assign-file-dialog';
import { Input } from './ui/input';
import { Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useAuthAction } from '@/hooks/use-auth-action';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { useProfile } from './auth-provider';
import { deleteUnassignedLetter } from '@/app/actions';
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


interface GeneralCorrespondenceProps {
    title: string;
    description: string;
    correspondenceType: CorrespondenceType;
    initialItems: Letter[];
    files: CorrespondenceFile[];
}

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (!isNaN(new Date(value).getTime())) return new Date(value);
    return null;
}

export function GeneralCorrespondence({ title, description, correspondenceType, initialItems, files: initialFiles }: GeneralCorrespondenceProps) {
  const [unassignedItems, setUnassignedItems] = React.useState(initialItems);
  const [selectedLetter, setSelectedLetter] = React.useState<Letter | null>(null);
  const [letterToEdit, setLetterToEdit] = React.useState<Letter | null>(null);
  const [letterToDelete, setLetterToDelete] = React.useState<Letter | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const firestore = useFirestore();
  const { isAdmin } = useProfile();
  const { toast } = useToast();

  const filesQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'files'), orderBy('dateCreated', 'desc'));
    },
    [firestore]
  );
  const { data: files } = useCollection<CorrespondenceFile>(filesQuery);

  React.useEffect(() => {
    setUnassignedItems(initialItems);
  }, [initialItems]);
  
  const handleOpenAssignDialog = (letter: Letter) => {
    setSelectedLetter(letter);
    setIsAssignDialogOpen(true);
  }

  const handleAssignDialogClose = (open: boolean) => {
    setIsAssignDialogOpen(open);
    if (!open) {
        setSelectedLetter(null);
    }
  }

  const handleEdit = (letter: Letter) => {
    setLetterToEdit(letter);
  }

  const handleFormClose = () => {
      setLetterToEdit(null);
  }

  const { exec: authDelete, isLoading: isDeleting } = useAuthAction(deleteUnassignedLetter, {
    onSuccess: () => {
        toast({ title: 'Item deleted permanentely.' });
        setLetterToDelete(null);
    }
  });

  const onAssignSuccess = (letterId: string) => {
    // Real-time listener handles removal
  }

  const filteredUnassignedItems = React.useMemo(() => {
    if (!searchTerm) {
      return unassignedItems;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return unassignedItems.filter(item => 
        item.subject.toLowerCase().includes(lowercasedTerm) ||
        (item.documentNo && item.documentNo.toLowerCase().includes(lowercasedTerm)) ||
        item.recipient.toLowerCase().includes(lowercasedTerm)
    );
  }, [searchTerm, unassignedItems]);


  return (
    <>
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <Card className="shadow-sm border-primary/10">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg">{letterToEdit ? `Edit ${correspondenceType}`: `Log New ${correspondenceType}`}</CardTitle>
                <CardDescription className="text-xs">{letterToEdit ? `Update metadata for this item.` : `Enter details to log an unassigned item.`}</CardDescription>
            </CardHeader>
            <CardContent>
                <GeneralCorrespondenceForm 
                    correspondenceType={correspondenceType as 'Incoming' | 'Court Process'}
                    letterToEdit={letterToEdit}
                    onFormClose={handleFormClose}
                />
            </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2 space-y-8">
        <Card className="shadow-sm overflow-hidden">
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className="space-y-1">
                        <CardTitle>{title}</CardTitle>
                        <CardDescription className="text-xs">{description}</CardDescription>
                    </div>
                </div>
                 <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search unassigned by subject, sender, or document no..."
                        className="w-full pl-10 h-11 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="[&_*]:min-w-0">
                 <div className="w-full overflow-x-auto rounded-md border shadow-inner">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="w-[140px] text-[10px] uppercase font-bold">Received</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Subject Description</TableHead>
                                <TableHead className="hidden sm:table-cell w-[140px] text-[10px] uppercase font-bold">Doc No.</TableHead>
                                <TableHead className="hidden md:table-cell w-[160px] text-[10px] uppercase font-bold">Sender/Source</TableHead>
                                <TableHead className="text-right w-[80px] text-[10px] uppercase font-bold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUnassignedItems.length > 0 ? filteredUnassignedItems.map(letter => {
                                const letterDate = toDate(letter.date);
                                return (
                                <TableRow key={letter.id} className="group">
                                    <TableCell className="whitespace-nowrap text-xs font-medium">{letterDate ? format(letterDate, 'MMM d, yyyy') : 'N/A'}</TableCell>
                                    <TableCell className="max-w-[200px] md:max-w-[300px]">
                                        <p className="truncate text-sm font-medium" title={letter.subject}>{letter.subject}</p>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded truncate block max-w-[120px]">{letter.documentNo}</span>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell max-w-[150px]">
                                        <p className="truncate text-xs text-muted-foreground" title={letter.recipient}>{letter.recipient}</p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(letter)} className="gap-2">
                                                    <Pencil className="h-4 w-4" />
                                                    Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleOpenAssignDialog(letter)} className="gap-2 font-bold text-primary">
                                                    Assign to File
                                                </DropdownMenuItem>
                                                {isAdmin && (
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive gap-2" onClick={() => setLetterToDelete(letter)}>
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete Record
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )}) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                                        No unassigned items match your search criteria.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
      </div>
    </div>
     <AssignFileDialog
        isOpen={isAssignDialogOpen}
        onOpenChange={handleAssignDialogClose}
        letter={selectedLetter}
        files={files || []}
        onAssignSuccess={onAssignSuccess}
      />
      <AlertDialog open={!!letterToDelete} onOpenChange={(open) => !open && setLetterToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Permanentely delete record?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove this correspondence from the system. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => letterToDelete && authDelete(letterToDelete.id)} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? 'Deleting...' : 'Delete Permanentely'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
