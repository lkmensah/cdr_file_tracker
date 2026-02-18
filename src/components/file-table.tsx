'use client';

import * as React from 'react';
import type { CorrespondenceFile, Letter, Movement, Attorney } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreHorizontal, FileText, ChevronDown, ChevronRight, FilePlus2, Send, Pencil, CheckCircle2, Truck, Clock, Trash2, FolderCheck, FolderOpen, Files, Sparkles, HandIcon } from 'lucide-react';
import { FileDetailDialog } from './file-detail-dialog';
import { NewCorrespondenceDialog } from './new-correspondence-dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MoveFileDialog } from './move-file-dialog';
import { BatchPickupDialog } from './batch-pickup-dialog';
import { format, isAfter, subHours } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { confirmFileReceipt, deleteFile, toggleFileStatus, markFileAsViewed } from '@/app/actions';
import { useAuthAction } from '@/hooks/use-auth-action';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from './auth-provider';
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
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
}

export function FileTable({ files, onEditFile }: { files: CorrespondenceFile[], onEditFile: (file: CorrespondenceFile) => void; }) {
  const firestore = useFirestore();
  const { isAdmin, profile } = useProfile();
  const { toast } = useToast();
  
  const [selectedFileIds, setSelectedFileIds] = React.useState<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null);
  const [fileForNewCorrespondence, setFileForNewCorrespondence] = React.useState<CorrespondenceFile | null>(null);
  const [filesToMove, setFilesToMove] = React.useState<CorrespondenceFile[]>([]);
  const [fileToDelete, setFileToDelete] = React.useState<CorrespondenceFile | null>(null);
  const [isNewCorrespondenceOpen, setIsNewCorrespondenceOpen] = React.useState(false);
  const [isMoveFileOpen, setIsMoveFileOpen] = React.useState(false);
  const [isPickupOpen, setIsPickupOpen] = React.useState(false);
  const [expandedFiles, setExpandedFiles] = React.useState<Set<string>>(new Set());

  const activeFiles = React.useMemo(() => files.filter(f => f.status !== 'Completed'), [files]);

  const attorneysQuery = useMemoFirebase(() => firestore ? collection(firestore, 'attorneys') : null, [firestore]);
  const { data: attorneys } = useCollection<Attorney>(attorneysQuery);

  const { exec: authConfirmReceipt, isLoading: isConfirming } = useAuthAction(confirmFileReceipt, {
    onSuccess: (result) => {
        if (result && result.message?.includes('Success')) {
            toast({ title: "Receipt Confirmed" });
        }
    }
  });

  const { exec: authToggleStatus, isLoading: isTogglingStatus } = useAuthAction(toggleFileStatus, {
    onSuccess: (result) => {
        toast({ title: result.message });
    }
  });

  const { exec: authDelete, isLoading: isDeleting } = useAuthAction(deleteFile, {
    onSuccess: () => {
        toast({ title: 'File record deleted.' });
        setFileToDelete(null);
    }
  });

  const { exec: authMarkViewed } = useAuthAction(markFileAsViewed);

  const selectedFileRef = useMemoFirebase(() => {
    if (!firestore || !selectedFileId) return null;
    return doc(firestore, 'files', selectedFileId);
  }, [firestore, selectedFileId]);

  const { data: selectedFileForDetail } = useDoc<CorrespondenceFile>(selectedFileRef);

  const toggleExpand = (fileId: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const toggleSelectFile = (fileId: string) => {
    setSelectedFileIds(prev => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
    });
  }

  const handleOpenNewCorrespondence = (file: CorrespondenceFile) => {
    setFileForNewCorrespondence(file);
    setIsNewCorrespondenceOpen(true);
  }
  
  const handleOpenMoveFile = (file: CorrespondenceFile) => {
    setFilesToMove([file]);
    setIsMoveFileOpen(true);
  }

  const handleBatchMove = () => {
    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    setFilesToMove(selectedFiles);
    setIsMoveFileOpen(true);
  }

  const handleBatchPickup = () => {
    setIsPickupOpen(true);
  }

  const handleToggleStatus = async (file: CorrespondenceFile) => {
    const nextStatus = file.status === 'Completed' ? 'Active' : 'Completed';
    await authToggleStatus(file.id, file.fileNumber, nextStatus);
  };

  const handleViewDetails = async (file: CorrespondenceFile) => {
    setSelectedFileId(file.id);
    if (profile?.id) {
        authMarkViewed(file.id, profile.id).catch(() => {});
    }
  }

  const handleConfirmReceipt = async (file: CorrespondenceFile, movementId: string) => {
    const formData = new FormData();
    formData.append('fileNumber', file.fileNumber);
    formData.append('movementId', movementId);
    const result = await authConfirmReceipt(formData);

    if (result && result.message?.includes('Success')) {
        const movements = Array.isArray(file.movements) ? file.movements : [];
        const movement = movements.find(m => m.id === movementId);
        if (movement) {
            const destination = movement.movedTo;
            const targetAttorney = attorneys?.find(a => a.fullName.toLowerCase() === destination.toLowerCase());
            if (targetAttorney?.phoneNumber) {
                const message = encodeURIComponent(
                    `Hello ${targetAttorney.fullName},\n\nThe following file(s) have been delivered to your desk and confirmed received in the system:\n\n• ${file.fileNumber} - ${file.subject}\n\nPlease verify physical receipt.\n\nThank you.`
                );
                window.open(`https://wa.me/${targetAttorney.phoneNumber.replace(/\D/g, '')}?text=${message}`, '_blank');
            }
        }
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No Files Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          There are no files matching your search.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {selectedFileIds.size > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between bg-primary/10 border border-primary/20 p-3 rounded-lg animate-in fade-in slide-in-from-top-2 gap-3">
                <div className="flex items-center gap-2">
                    <Files className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selectedFileIds.size} files selected</span>
                </div>
                <div className="flex flex-wrap justify-center sm:justify-end gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="outline" onClick={() => setSelectedFileIds(new Set())} className="bg-background">
                        Clear
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBatchPickup} className="border-primary/20 text-primary bg-background">
                        <HandIcon className="mr-2 h-4 w-4" />
                        Pickup
                    </Button>
                    <Button size="sm" variant="default" onClick={handleBatchMove}>
                        <Send className="mr-2 h-4 w-4" />
                        Move
                    </Button>
                </div>
            </div>
        )}

        <div className="w-full overflow-x-auto rounded-md border">
            <Table className="min-w-[900px] lg:min-w-full">
            <TableHeader>
                <TableRow>
                <TableHead className="w-[40px] px-2">
                </TableHead>
                <TableHead className="w-[40px] px-2"></TableHead>
                <TableHead className="w-[120px]">File Number</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden sm:table-cell w-[150px]">Assigned To</TableHead>
                <TableHead className="hidden md:table-cell w-[180px]">Status/Location</TableHead>
                <TableHead className="hidden lg:table-cell w-[150px]">Date Created</TableHead>
                <TableHead className="w-[50px] text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {files.map(file => {
                const isExpanded = expandedFiles.has(file.id);
                const isSelected = selectedFileIds.has(file.id);
                const movements = Array.isArray(file.movements) ? file.movements : [];
                const letters = Array.isArray(file.letters) ? file.letters : [];
                
                const latestMovement = [...movements].sort((a, b) => {
                    const dateA = toDate(a.date)?.getTime() || 0;
                    const dateB = toDate(b.date)?.getTime() || 0;
                    if (dateB !== dateA) return dateB - dateA;
                    return b.id.localeCompare(a.id);
                })[0];

                const dateCreated = toDate(file.dateCreated);
                const isRegistry = latestMovement?.movedTo?.toLowerCase() === 'registry';
                const isCompleted = file.status === 'Completed';

                const activityTime = toDate(file.lastActivityAt);
                const lastViewedAt = toDate(file.viewedBy?.[profile?.id || '']);
                const isRecentlyUpdated = activityTime && 
                    isAfter(activityTime, subHours(new Date(), 24)) &&
                    (!lastViewedAt || isAfter(activityTime, lastViewedAt));

                return (
                <React.Fragment key={file.id}>
                    <TableRow className={cn(isCompleted && "bg-muted/30 opacity-80", isSelected && "bg-primary/5")}>
                    <TableCell className="px-2">
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectFile(file.id)}
                            disabled={isCompleted}
                        />
                    </TableCell>
                    <TableCell className="px-2">
                        <Button variant="ghost" size="icon" onClick={() => toggleExpand(file.id)} className="h-8 w-8" disabled={letters.length === 0}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="sr-only">Toggle letters</span>
                        </Button>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap overflow-hidden">
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{file.fileNumber}</span>
                                {isRecentlyUpdated && !isCompleted && (
                                    <div className="relative flex h-2 w-2 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                                    </div>
                                )}
                            </div>
                            {isCompleted && (
                                <Badge variant="secondary" className="w-fit text-[9px] h-4 bg-green-100 text-green-800 border-green-200 shrink-0">
                                    COMPLETED
                                </Badge>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] sm:max-w-[300px] md:max-w-[400px]">
                        <p className="truncate font-medium" title={file.subject}>{file.subject}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                        <p className="truncate" title={file.assignedTo || 'N/A'}>{file.assignedTo || 'N/A'}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-1.5 py-1 min-w-0">
                            <span className="font-semibold text-sm leading-tight truncate max-w-[150px]" title={latestMovement?.movedTo ?? 'Registry'}>
                                {latestMovement?.movedTo ?? 'Registry'}
                            </span>
                            {latestMovement && (
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                                        <Clock className="h-3 w-3 shrink-0" />
                                        <span className="truncate">Moved: {format(toDate(latestMovement.date)!, 'MMM d, p')}</span>
                                    </div>
                                    {latestMovement.receivedAt ? (
                                        <div className="flex flex-col gap-0.5">
                                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 px-1.5 py-0 text-[10px] w-fit gap-1 font-medium shrink-0">
                                                <CheckCircle2 className="h-2.5 w-2.5" /> Received
                                            </Badge>
                                            <span className="text-[10px] text-green-700 font-medium whitespace-nowrap ml-1">
                                                On: {format(toDate(latestMovement.receivedAt)!, 'MMM d, p')}
                                            </span>
                                        </div>
                                    ) : (
                                        !isRegistry && (
                                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 px-1.5 py-0 text-[10px] w-fit gap-1 font-medium italic shrink-0">
                                                <Truck className="h-2.5 w-2.5" /> In Transit
                                            </Badge>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm whitespace-nowrap">
                        {dateCreated ? format(dateCreated, 'PPP') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem 
                                onClick={() => handleOpenNewCorrespondence(file)}
                                disabled={isCompleted}
                            >
                            <FilePlus2 className="mr-2 h-4 w-4" />
                            Add Correspondence
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => handleOpenMoveFile(file)}
                                disabled={isCompleted}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Move File
                            </DropdownMenuItem>
                            {latestMovement && !latestMovement.receivedAt && !isRegistry && (
                                <DropdownMenuItem 
                                    onClick={() => handleConfirmReceipt(file, latestMovement.id)} 
                                    disabled={isConfirming || isCompleted}
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                                    Confirm Receipt
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                                onClick={() => onEditFile(file)}
                                disabled={isCompleted}
                            >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit File
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleStatus(file)} disabled={isTogglingStatus}>
                                {isCompleted ? (
                                    <>
                                        <FolderOpen className="mr-2 h-4 w-4 text-blue-500" />
                                        Reopen Case
                                    </>
                                ) : (
                                    <>
                                        <FolderCheck className="mr-2 h-4 w-4 text-green-600" />
                                        Mark as Completed
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewDetails(file)}>
                            View Details
                            </DropdownMenuItem>
                            {isAdmin && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        className="text-destructive focus:text-destructive" 
                                        onClick={() => setFileToDelete(file)}
                                        disabled={isCompleted}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete File
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                    {isExpanded && (
                    <TableRow>
                        <TableCell colSpan={8} className="p-0">
                        <div className="bg-muted/50 p-4">
                            <h4 className="font-semibold mb-2 px-4">Letters in this file ({letters.length})</h4>
                            <div className="w-full overflow-x-auto">
                                <Table className="min-w-[600px]">
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead className="hidden sm:table-cell">Document No.</TableHead>
                                    <TableHead>Type</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...letters].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0)).map(letter => {
                                        const letterDate = toDate(letter.date);
                                        return (
                                            <TableRow key={letter.id} className="bg-background">
                                                <TableCell className="whitespace-nowrap">{letterDate ? format(letterDate, 'PPP') : 'N/A'}</TableCell>
                                                <TableCell className="max-w-[300px] md:max-w-[500px]">
                                                    <p className="truncate" title={letter.subject}>{letter.subject}</p>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell whitespace-nowrap">{letter.documentNo}</TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        letter.type === 'Incoming' ? 'light-blue' :
                                                        letter.type === 'Filing' ? 'warning' :
                                                        letter.type === 'Court Process' ? 'info' :
                                                        letter.type === 'Outgoing' ? 'default' :
                                                        letter.type === 'Memo' ? 'destructive' :
                                                        'outline'
                                                    }>{letter.type}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                                </Table>
                            </div>
                        </div>
                        </TableCell>
                    </TableRow>
                    )}
                </React.Fragment>
                )})}
            </TableBody>
            </Table>
        </div>
      </div>

      <FileDetailDialog
        file={selectedFileForDetail}
        isOpen={!!selectedFileId && !!selectedFileForDetail}
        onOpenChange={(isOpen) => !isOpen && setSelectedFileId(null)}
        onDataChange={() => { /* Real-time updates handled by Firebase */ }}
      />
       <NewCorrespondenceDialog
        isOpen={isNewCorrespondenceOpen}
        onOpenChange={(open) => {
            setIsNewCorrespondenceOpen(open);
            if (!open) setFileForNewCorrespondence(null);
        }}
        existingFile={fileForNewCorrespondence}
      />
      <MoveFileDialog
        isOpen={isMoveFileOpen}
        onOpenChange={(open) => {
            setIsMoveFileOpen(open);
            if (!open) {
                setFilesToMove([]);
                setSelectedFileIds(new Set());
            }
        }}
        files={filesToMove}
      />
      <BatchPickupDialog
        isOpen={isPickupOpen}
        onOpenChange={(open) => {
            setIsPickupOpen(open);
            if (!open) setSelectedFileIds(new Set());
        }}
        fileNumbers={Array.from(selectedFileIds).map(id => files.find(f => f.id === id)?.fileNumber).filter(Boolean) as string[]}
      />
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent className="w-[95vw] sm:max-w-lg">
            <AlertDialogHeader>
                <AlertDialogTitle>Permanentely delete file?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will delete file <strong>{fileToDelete?.fileNumber}</strong> and all its associated correspondence and movement history.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
                <AlertDialogCancel disabled={isDeleting} className="sm:mt-0">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => fileToDelete && authDelete(fileToDelete.id)} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? 'Deleting...' : 'Delete Everything'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}