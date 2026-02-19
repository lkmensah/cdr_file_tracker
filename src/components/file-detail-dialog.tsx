'use client';

import * as React from 'react';
import type { CorrespondenceFile, Letter, CorrespondenceType, Movement, Attorney, InternalInstruction, Attachment } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { unassignFromFile, confirmFileReceipt, deleteLetterFromFile, deleteMovementFromFile, updateLetterInFile, updateMovementInFile, addInternalInstruction, markFileAsViewed, deleteFileAttachment } from '@/app/actions';
import { useUser, useFirestore, useCollection, useMemoFirebase, useFirebase } from '@/firebase';
import { useAuthAction } from '@/hooks/use-auth-action';
import { CheckCircle2, Truck, UserCheck, Pencil, Trash2, Calendar as CalendarIcon, Loader2, MessageSquare, Send, Flag, Paperclip, Eye, FileIcon, AlertCircle, Banknote, Users } from 'lucide-react';
import { useProfile } from './auth-provider';
import { GeneralCorrespondenceForm } from './general-correspondence-form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Combobox } from './ui/combobox';
import { collection, query, orderBy } from 'firebase/firestore';
import { Progress } from './ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

interface FileDetailDialogProps {
  file: CorrespondenceFile | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDataChange: () => void;
}

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
};

const DetailItem = ({ label, value }: { label: string; value?: string | Date | number | null }) => {
  const dateValue = toDate(value);
  const displayValue = dateValue ? format(dateValue, 'PPP') : (typeof value === 'string' || typeof value === 'number' ? value : 'N/A');
  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground">{label}</h4>
      <p className="text-base whitespace-pre-wrap">{displayValue || 'N/A'}</p>
    </div>
  );
};

const getDynamicRecipientLabel = (type: CorrespondenceType) => {
    switch (type) {
      case 'Outgoing': return 'Addressee';
      case 'Filing':
      case 'Court Process': return 'Court';
      case 'Memo': return 'To';
      default: return 'Sender';
    }
};

const getDynamicDateLabel = (type: CorrespondenceType) => {
    switch (type) {
        case 'Outgoing': return 'Date Dispatched';
        case 'Filing': return 'Date Filed';
        case 'Court Process': return 'Date Received';
        case 'Memo': return 'Date';
        default: return 'Date Received';
    }
};

const LetterDetails = ({ letter, index, total, fileNumber, onDataChange }: { letter: Letter, index: number, total: number, fileNumber: string, onDataChange: () => void }) => {
    const { user } = useUser();
    const { isAdmin } = useProfile();
    const [isUnassignAlertOpen, setIsUnassignAlertOpen] = React.useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [isLinkingScan, setIsLinkingScan] = React.useState(false);
    const [scanUrlInput, setScanUrlInput] = React.useState(letter.scanUrl || '');
    const { toast } = useToast();

    const { exec: authUnassign, isLoading: isUnassigning } = useAuthAction(unassignFromFile, { 
        onSuccess: () => {
            toast({ title: 'Un-assigned from File' });
            onDataChange();
            setIsUnassignAlertOpen(false);
        }
    });

    const { exec: authDelete, isLoading: isDeleting } = useAuthAction(deleteLetterFromFile, {
        onSuccess: () => {
            toast({ title: 'Letter Deleted' });
            onDataChange();
            setIsDeleteAlertOpen(false);
        }
    });

    const { exec: authUpdateScan, isLoading: isSavingScan } = useAuthAction(
        async (token, fileNum: string, letterId: string, url: string) => {
            const fd = new FormData();
            fd.append('scanUrl', url);
            return updateLetterInFile(token, fileNum, letterId, fd);
        }, 
        { onSuccess: () => { toast({ title: 'Scan link updated' }); onDataChange(); setIsLinkingScan(false); } }
    );

    const handleUnassign = async () => {
        if (!letter.fileNumber || !user?.email) return;
        const formData = new FormData();
        formData.append('letterId', letter.id);
        formData.append('fileNumber', letter.fileNumber!);
        formData.append('correspondenceType', letter.type as 'Incoming' | 'Court Process');
        formData.append('userEmail', user.email);
        await authUnassign(formData);
    };

    const handleDelete = async () => { await authDelete(fileNumber, letter.id); };

    if (isEditMode) {
        return (
            <div className="bg-muted/30 p-4 rounded-lg border border-primary/20">
                <div className="flex justify-between items-center mb-4"><h4 className="font-semibold">Edit Letter Details</h4><Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)}>Cancel</Button></div>
                <GeneralCorrespondenceForm correspondenceType={letter.type as 'Incoming' | 'Court Process'} letterToEdit={letter} onFormClose={() => { setIsEditMode(false); onDataChange(); }} fileNumber={fileNumber} />
            </div>
        );
    }

    return (
    <>
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3"><div className='space-y-1'><h4 className="text-sm font-semibold">Folio #{total - index}</h4><Badge variant={ letter.type === 'Incoming' ? 'light-blue' : letter.type === 'Filing' ? 'warning' : letter.type === 'Court Process' ? 'info' : letter.type === 'Outgoing' ? 'default' : letter.type === 'Memo' ? 'destructive' : 'outline' }>{letter.type}</Badge></div></div>
                <div className="flex items-center gap-1.5">{letter.scanUrl && (<Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[10px] text-primary font-bold hover:bg-primary/10" onClick={() => window.open(letter.scanUrl, '_blank')}><Eye className="h-3.5 w-3.5" />View Scan</Button>)}<Button variant="outline" size="sm" className={cn("h-8 gap-2", letter.scanUrl && "border-green-200 text-green-700 bg-green-50")} onClick={() => setIsLinkingScan(!isLinkingScan)}><Paperclip className="h-3.5 w-3.5" />{letter.scanUrl ? 'Update' : 'Link Scan'}</Button><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setIsEditMode(true)}><Pencil className="h-4 w-4" /></Button>{isAdmin && (<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setIsDeleteAlertOpen(true)}><Trash2 className="h-4 w-4" /></Button>)}{(letter.type === 'Incoming' || letter.type === 'Court Process') && (<Button variant="outline" size="sm" className="h-8 ml-1" onClick={() => setIsUnassignAlertOpen(true)}>Un-assign</Button>)}</div>
            </div>
            {isLinkingScan && (<div className="bg-primary/5 p-3 rounded-md border border-primary/10 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1"><div className="flex items-center gap-2"><AlertCircle className="h-3 w-3 text-primary" /><span className="text-[10px] font-bold uppercase tracking-widest text-primary">Paste SharePoint / Digital Scan URL</span></div><div className="flex gap-2"><Input placeholder="https://..." value={scanUrlInput} onChange={(e) => setScanUrlInput(e.target.value)} className="h-8 text-xs bg-background" /><Button size="sm" className="h-8 shrink-0" onClick={() => authUpdateScan(fileNumber, letter.id, scanUrlInput)} disabled={isSavingScan}>{isSavingScan ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}</Button></div></div>)}
            <div className="grid gap-4 sm:grid-cols-2 mt-4"><DetailItem label={getDynamicDateLabel(letter.type)} value={letter.date} />{letter.type === 'Court Process' && letter.hearingDate && (<DetailItem label="Hearing Date" value={letter.hearingDate} />)}{(letter.type === 'Incoming' || letter.type === 'Outgoing') && letter.dateOnLetter && (<DetailItem label="Date on Letter" value={letter.dateOnLetter} />)}<DetailItem label="Document No." value={letter.documentNo} /></div><DetailItem label="Subject" value={letter.subject} /><div className="grid gap-4 sm:grid-cols-2"><DetailItem label={getDynamicRecipientLabel(letter.type)} value={letter.recipient} />{(letter.type === 'Memo' || letter.type === 'Outgoing') && letter.signedBy && (<DetailItem label={letter.type === 'Memo' ? "From" : "Signed By"} value={letter.signedBy} />)}{(letter.type === 'Filing' || letter.type === 'Court Process') && letter.processType && (<DetailItem label="Type of Process" value={letter.processType} />)}{letter.type === 'Filing' && letter.serviceAddress && (<DetailItem label="Service Address" value={letter.serviceAddress} />)}</div><DetailItem label="Remarks" value={letter.remarks} />
        </div>
         <AlertDialog open={isUnassignAlertOpen} onOpenChange={setIsUnassignAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will un-assign the letter from this file and move it back to the general {letter.type === 'Incoming' ? 'Incoming Mail' : 'Court Processes'} list.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isUnassigning}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUnassign} disabled={isUnassigning}>{isUnassigning ? 'Un-assigning...' : 'Continue'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Permanently?</AlertDialogTitle><AlertDialogDescription>This will delete this folio record from the system. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} variant="destructive" disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
    )
}

const MovementDetails = ({ movement, index, total, fileNumber, fileSubject, isLatest, onDataChange }: { movement: Movement, index: number, total: number, fileNumber: string, fileSubject: string, isLatest: boolean, onDataChange: () => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { isAdmin } = useProfile();
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const attorneysQuery = useMemoFirebase(() => firestore ? collection(firestore, 'attorneys') : null, [firestore]);
    const { data: attorneys } = useCollection<Attorney>(attorneysQuery);
    const { exec: authConfirm, isLoading: isConfirming } = useAuthAction(confirmFileReceipt, { onSuccess: (r) => { if (r && r.message?.includes('Success')) { toast({ title: 'Receipt Confirmed' }); onDataChange(); const dest = movement.movedTo; const target = attorneys?.find(a => a.fullName.toLowerCase() === dest.toLowerCase()); if (target?.phoneNumber) { const msg = encodeURIComponent(`Hello ${target.fullName},\n\nThe following file(s) have been delivered to your desk and confirmed received in the system:\n\n• ${fileNumber} - ${fileSubject}\n\nPlease verify physical receipt.\n\nThank you.`); window.open(`https://wa.me/${target.phoneNumber.replace(/\D/g, '')}?text=${msg}`, '_blank'); } } } });
    const { exec: authDelete, isLoading: isDeleting } = useAuthAction(deleteMovementFromFile, { onSuccess: () => { toast({ title: 'Movement record deleted' }); onDataChange(); setIsDeleteAlertOpen(false); } });
    const handleConfirm = async () => { const fd = new FormData(); fd.append('fileNumber', fileNumber); fd.append('movementId', movement.id); await authConfirm(fd); };
    const handleDelete = async () => { await authDelete(fileNumber, movement.id); };
    const isRegistry = movement.movedTo?.toLowerCase() === 'registry';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-start"><h4 className="text-md font-semibold">Movement #{total - index}</h4><div className="flex items-center gap-2"><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setIsEditMode(true)}><Pencil className="h-4 w-4" /></Button>{isAdmin && (<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setIsDeleteAlertOpen(true)}><Trash2 className="h-4 w-4" /></Button>)}</div>{movement.receivedAt ? (<Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 py-1"><CheckCircle2 className="h-3.5 w-3.5" /> Received</Badge>) : (!isRegistry ? (<Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-1.5 py-1"><Truck className="h-3.5 w-3.5" /> In Transit</Badge>) : null)}{isLatest && !movement.receivedAt && !isRegistry && (<Button size="sm" variant="outline" onClick={handleConfirm} disabled={isConfirming}>{isConfirming ? 'Confirming...' : 'Confirm Receipt'}</Button>)}</div></div>
            <div className="grid gap-4 sm:grid-cols-2"><DetailItem label="Date Moved" value={movement.date} /><DetailItem label="Moved To" value={movement.movedTo} /></div><DetailItem label="Status" value={movement.status} />{movement.receivedAt && (<div className="rounded-md bg-muted/50 p-3 flex items-start gap-3"><UserCheck className="h-4 w-4 text-muted-foreground mt-0.5" /><div className="space-y-1"><p className="text-sm font-medium">Receipt Acknowledged</p><p className="text-xs text-muted-foreground">By {movement.receivedBy} on {format(toDate(movement.receivedAt)!, 'PPP')}</p></div></div>)}
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete movement log?</AlertDialogTitle><AlertDialogDescription>This will remove this record from the history. If this was the latest location, the file's status will revert to the previous entry.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} variant="destructive" disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
    );
};

export function FileDetailDialog({ file: initialFile, isOpen, onOpenChange, onDataChange }: FileDetailDialogProps) {
  const { profile, isAdmin } = useProfile();
  const { user } = useFirebase();
  const { toast } = useToast();
  const [inquiryText, setInquiryText] = React.useState('');
  const [isSendingInquiry, setIsInquirySubmitting] = React.useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = React.useState<Attachment | null>(null);
  const { exec: authAddInstruction } = useAuthAction(addInternalInstruction);
  const { exec: authDeleteAttachment, isLoading: isDeletingAttachment } = useAuthAction(deleteFileAttachment);

  if (!initialFile) return null;

  const movements = Array.isArray(initialFile.movements) ? [...initialFile.movements].sort((a,b) => { const timeA = toDate(a.date)?.getTime() || 0; const timeB = toDate(b.date)?.getTime() || 0; if (timeB !== timeA) return timeB - timeA; return b.id.localeCompare(a.id); }) : [];
  const latestMovement = movements[0];
  const currentPossessorName = latestMovement?.movedTo || 'Registry';
  const sortedLetters = Array.isArray(initialFile.letters) ? [...initialFile.letters].sort((a,b) => new Date(toDate(b.date) || 0).getTime() - new Date(toDate(a.date) || 0).getTime()) : [];
  const sortedInstructions = Array.isArray(initialFile.internalInstructions) ? [...initialFile.internalInstructions].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0)) : [];
  const sortedAttachments = Array.isArray(initialFile.attachments) ? [...initialFile.attachments].sort((a,b) => (toDate(b.uploadedAt)?.getTime() || 0) - (toDate(a.uploadedAt)?.getTime() || 0)) : [];
  const completedMilestones = (initialFile.milestones || []).filter(m => m.isCompleted).length;
  const progress = (initialFile.milestones || []).length > 0 ? (completedMilestones / initialFile.milestones!.length) * 100 : 0;

  const handleSendInquiry = async () => {
    if (!inquiryText.trim() || !profile) return;
    setIsInquirySubmitting(true);
    try { await authAddInstruction(initialFile.fileNumber, { text: inquiryText, from: `Registry (${profile.fullName})`, to: currentPossessorName }); toast({ title: 'Message Sent' }); setInquiryText(''); onDataChange(); } catch (e) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsInquirySubmitting(false); }
  };

  const handleViewDocument = async (attachment: Attachment) => {
    if (!user) return;
    try { const idToken = await user.getIdToken(); const response = await fetch(`/api/attachments/download?path=${encodeURIComponent(attachment.path)}`, { headers: { 'Authorization': `Bearer ${idToken}` } }); const result = await response.json(); if (result.url) { window.open(result.url, '_blank'); } else { toast({ variant: 'destructive', title: 'View Failed' }); } } catch (error) { toast({ variant: 'destructive', title: 'Error' }); }
  };

  const handleDeleteAttachment = async () => {
    if (!attachmentToDelete || !initialFile) return;
    try { await authDeleteAttachment(initialFile.fileNumber, attachmentToDelete.id); toast({ title: 'Attachment Deleted' }); setAttachmentToDelete(null); onDataChange(); } catch (e) { toast({ variant: 'destructive', title: 'Error' }); }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>File Details</DialogTitle><DialogDescription>Complete information for file number {initialFile.fileNumber}.</DialogDescription></DialogHeader>
        <div className="space-y-6 py-4">
            {initialFile.isJudgmentDebt && (<div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="bg-red-100 p-2 rounded-full"><Banknote className="h-5 w-5 text-red-600" /></div><div className="space-y-1"><p className="text-[10px] font-bold text-red-800 uppercase tracking-widest">Judgment Debt Liability</p><div className="flex flex-col gap-1">{(initialFile.amountGHC || initialFile.amountInvolved) ? (<p className="text-xl font-black text-red-700 tabular-nums leading-none">GH₵ {initialFile.amountGHC?.toLocaleString()}</p>) : null}{initialFile.amountUSD ? (<p className="text-lg font-black text-blue-700 tabular-nums leading-none">$ {initialFile.amountUSD?.toLocaleString()}</p>) : null}</div></div></div><Badge className="bg-red-600 text-white border-none uppercase text-[9px] px-2 py-0.5 animate-pulse">Financial Risk</Badge></div>)}
            <div className="space-y-2"><div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-primary"><span className="flex items-center gap-1.5"><Flag className="h-3 w-3" /> Case Progress</span><span>{Math.round(progress)}%</span></div><Progress value={progress} className="h-2" /><div className="flex justify-between gap-1 mt-1">{(initialFile.milestones || []).map(m => (<div key={m.id} className="flex flex-col items-center gap-1 flex-1"><div className={cn("h-1.5 w-full rounded-full transition-colors", m.isCompleted ? "bg-primary" : "bg-muted")} /><span className={cn("text-[7px] font-bold uppercase text-center leading-tight truncate w-full", m.isCompleted ? "text-primary" : "text-muted-foreground")}>{m.title}</span></div>))}</div></div>
            <Separator />
            <div className="space-y-4">
                <DetailItem label="Subject" value={initialFile.subject} />
                <div className="grid gap-6 sm:grid-cols-3"><DetailItem label="File Number" value={initialFile.fileNumber} /><DetailItem label="Suit Number" value={initialFile.suitNumber} /><DetailItem label="Category" value={initialFile.category} /><DetailItem label="Date Created" value={initialFile.dateCreated} /><DetailItem label="Assigned To" value={initialFile.assignedTo} /><DetailItem label="Group" value={initialFile.group} /></div>
                {initialFile.coAssignees && initialFile.coAssignees.length > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg border border-primary/10">
                        <h4 className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-2 mb-2"><Users className="h-3 w-3" /> Collaborative Team</h4>
                        <div className="flex flex-wrap gap-2">{initialFile.coAssignees.map(name => <Badge key={name} variant="outline" className="bg-background text-xs py-0.5">{name}</Badge>)}</div>
                    </div>
                )}
            </div>
            <Separator />
            <Tabs defaultValue="communications"><TabsList className="grid grid-cols-3 mb-4"><TabsTrigger value="communications">Communications</TabsTrigger><TabsTrigger value="attachments">Attachments ({sortedAttachments.length})</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
                <TabsContent value="communications" className="space-y-4"><h3 className="text-lg font-semibold flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Case Communication</h3><div className="bg-muted/30 p-4 rounded-lg space-y-4 border border-primary/10"><div className="space-y-2"><h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Send Message to Current Possessor ({currentPossessorName})</h4><Textarea placeholder="Ask about file location, current status, or request its return..." value={inquiryText} onChange={(e) => setInquiryText(e.target.value)} className="bg-background min-h-[80px]" /><Button className="w-full h-9 gap-2" onClick={handleSendInquiry} disabled={isSendingInquiry || !inquiryText.trim()}>{isSendingInquiry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send Message</Button></div><div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">{sortedInstructions.length > 0 ? sortedInstructions.map(msg => (<div key={msg.id} className="bg-background p-3 rounded-md border text-sm relative group"><div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1.5 flex-wrap"><span className="text-[10px] font-bold text-primary uppercase">{msg.from}</span><span className="text-muted-foreground text-[10px]">→</span><span className="text-[10px] font-bold text-muted-foreground uppercase">{msg.to}</span></div><span className="text-[9px] text-muted-foreground font-mono">{toDate(msg.date) ? format(toDate(msg.date)!, 'MMM d, p') : 'N/A'}</span></div><p className="leading-relaxed text-muted-foreground italic">"{msg.text}"</p></div>)) : (<p className="text-center text-[10px] text-muted-foreground py-4 border border-dashed rounded-md">No communication history for this file.</p>)}</div></div></TabsContent>
                <TabsContent value="attachments" className="space-y-4"><h3 className="text-lg font-semibold flex items-center gap-2"><Paperclip className="h-5 w-5 text-primary" />Practitioner Works & Files</h3><div className="grid gap-3">{sortedAttachments.length > 0 ? sortedAttachments.map(att => (<Card key={att.id}><CardContent className="p-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="p-2 bg-muted rounded"><FileIcon className="h-5 w-5 text-muted-foreground" /></div><div><p className="text-sm font-semibold leading-none">{att.name}</p><p className="text-[10px] text-muted-foreground uppercase mt-1.5">Uploaded by {att.uploadedBy} • {format(toDate(att.uploadedAt)!, 'p, MMM d')}</p></div></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => handleViewDocument(att)} title="View Document"><Eye className="h-4 w-4" /></Button>{(isAdmin || profile?.fullName === att.uploadedBy) && (<Button variant="ghost" size="icon" onClick={() => setAttachmentToDelete(att)} className="text-destructive hover:bg-destructive/10" title="Delete Document"><Trash2 className="h-4 w-4" /></Button>)}</div></CardContent></Card>)) : (<p className="text-sm text-muted-foreground text-center py-10 border border-dashed rounded-md">No attachments uploaded for this case yet.</p>)}</div></TabsContent>
                <TabsContent value="history" className="space-y-6 pt-4"><div className="space-y-6"><h3 className="text-lg font-semibold flex items-center gap-2"><HistoryIcon className="h-5 w-5 text-primary" />Movement History</h3>{movements.length > 0 ? movements.map((m, i) => (<React.Fragment key={m.id}><MovementDetails movement={m} index={i} total={movements.length} fileNumber={initialFile.fileNumber} fileSubject={initialFile.subject} isLatest={i === 0} onDataChange={onDataChange} />{i < movements.length - 1 && <Separator />}</React.Fragment>)) : (<p className="text-sm text-muted-foreground">No movement history for this file yet.</p>)}</div><Separator /><div className="space-y-6"><h3 className="text-lg font-semibold flex items-center gap-2"><FileTextIcon className="h-5 w-5 text-primary" />Folios</h3>{sortedLetters.length > 0 ? sortedLetters.map((l, i) => (<React.Fragment key={l.id}><LetterDetails letter={l} index={i} total={sortedLetters.length} fileNumber={initialFile.fileNumber} onDataChange={onDataChange} />{i < sortedLetters.length - 1 && <Separator />}</React.Fragment>)) : (<p className="text-sm text-muted-foreground">No correspondence in this file yet.</p>)}</div></TabsContent>
            </Tabs>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!attachmentToDelete} onOpenChange={(open) => !open && setAttachmentToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Attachment?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to remove <strong>{attachmentToDelete?.name}</strong>? This action will permanently remove the document record from this file.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeletingAttachment}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAttachment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeletingAttachment}>{isDeletingAttachment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}Delete Attachment</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}

function HistoryIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg> }
function FileTextIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> }
