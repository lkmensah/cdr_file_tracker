
'use client';

import * as React from 'react';
import { usePortal } from '@/components/portal-provider';
import { useDoc, useFirestore, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { CorrespondenceFile, InternalDraft, InternalInstruction, Milestone, Attachment, Attorney } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format, isAfter } from 'date-fns';
import { 
    ChevronLeft, 
    Plus, 
    Calendar as CalendarIcon, 
    FileText, 
    CheckCircle2, 
    History, 
    Send, 
    Loader2, 
    MessageSquare, 
    HandIcon, 
    Pin, 
    CheckCircle, 
    Flag,
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    Sparkles,
    Type,
    Wand2,
    Paperclip,
    Eye,
    Upload,
    FileIcon,
    AlertCircle,
    Crown,
    Lock,
    Pencil,
    Trash2,
    FileDown,
    Banknote,
    Users
} from 'lucide-react';
import { addInternalDraft, updateInternalDraft, deleteInternalDraft, addCaseReminder, toggleReminder, addInternalInstruction, markFileAsViewed, requestFile, toggleFilePin, toggleFileStatus, updateMilestones, deleteFileAttachment } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useAuthAction } from '@/hooks/use-auth-action';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { refineDraft } from '@/ai/flows/refine-draft';
import { downloadLegalDoc } from '@/lib/download-docx';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export default function PortalFileDetail() {
    const { id } = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user } = useFirebase();
    const { attorney, isSG } = usePortal();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isAILoading, setIsAILoading] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('folios');

    const fileRef = React.useMemo(() => firestore ? doc(firestore, 'files', id as string) : null, [firestore, id]);
    const { data: file, isLoading } = useDoc<CorrespondenceFile>(fileRef);

    const attorneysQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'attorneys'), orderBy('fullName', 'asc'));
    }, [firestore]);
    const { data: allAttorneys } = useCollection<Attorney>(attorneysQuery);

    const { exec: authMarkViewed } = useAuthAction(markFileAsViewed);
    const { exec: authTogglePin } = useAuthAction(toggleFilePin);
    const { exec: authAddDraft } = useAuthAction(addInternalDraft);
    const { exec: authUpdateDraft } = useAuthAction(updateInternalDraft);
    const { exec: authDeleteDraft } = useAuthAction(deleteInternalDraft);
    const { exec: authAddReminder } = useAuthAction(addCaseReminder);
    const { exec: authToggleReminder } = useAuthAction(toggleReminder);
    const { exec: authAddInstruction } = useAuthAction(addInternalInstruction);
    const { exec: authRequestFile } = useAuthAction(requestFile);
    const { exec: authToggleStatus } = useAuthAction(toggleFileStatus);
    const { exec: authUpdateMilestones } = useAuthAction(updateMilestones);
    const { exec: authDeleteAttachment } = useAuthAction(deleteFileAttachment);

    const [draftTitle, setDraftTitle] = React.useState('');
    const [draftContent, setDraftContent] = React.useState('');
    const [editingDraftId, setEditingDraftId] = React.useState<string | null>(null);
    const [draftToDelete, setDraftToDelete] = React.useState<InternalDraft | null>(null);
    const [attachmentToDelete, setAttachmentToDelete] = React.useState<Attachment | null>(null);
    const [reminderText, setReminderText] = React.useState('');
    const [instructionText, setInstructionText] = React.useState('');
    const [recipientType, setRecipientType] = React.useState<'lead' | 'registry' | 'attorney'>('lead');
    const [specificRecipientId, setSpecificRecipientId] = React.useState('');

    const editor = useEditor({
        extensions: [StarterKit, Underline],
        content: '',
        immediatelyRender: false,
        editorProps: { attributes: { class: 'min-h-[400px] text-sm leading-relaxed p-4 focus:outline-none bg-background rounded-b-md [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4' } },
        onUpdate: ({ editor }) => setDraftContent(editor.getHTML()),
    });

    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
    const [selectedTime, setSelectedTime] = React.useState('09:00');
    const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

    const movements = React.useMemo(() => [...(file?.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0)), [file?.movements]);
    const latestMovement = movements[0];
    const currentPossessorName = latestMovement?.movedTo || 'Registry';
    
    const myName = attorney?.fullName.toLowerCase().trim();
    const isPossessor = currentPossessorName.toLowerCase().trim() === myName;
    const isLead = file?.assignedTo?.toLowerCase().trim() === myName;
    const isTeamMember = file?.coAssignees?.some(name => name.toLowerCase().trim() === myName);
    
    const fileGroup = file?.group?.toLowerCase().trim();
    const myGroup = attorney?.group?.toLowerCase().trim();
    const isInMyGroup = (attorney?.isGroupHead && !!myGroup && fileGroup === myGroup) || isSG;

    const wasPreviouslyInvolved = file?.movements?.some(m => m.movedTo?.toLowerCase().trim() === myName);
    const isHistoricalOnly = !isSG && !isLead && !isTeamMember && !isPossessor && !isInMyGroup && wasPreviouslyInvolved;

    const hasPendingRequest = (file?.requests || []).some(r => r.requesterId === attorney?.id);
    const isPinned = file?.pinnedBy?.[attorney?.id || ''] === true;
    const isCompleted = file?.status === 'Completed';

    const canInteract = (isLead || isTeamMember || isPossessor || isInMyGroup) && !isCompleted && !isHistoricalOnly;

    React.useEffect(() => {
        if (file && attorney) {
            const activityTime = toDate(file.lastActivityAt);
            const lastViewedAt = toDate(file.viewedBy?.[attorney.id]);
            if (activityTime && (!lastViewedAt || isAfter(activityTime, lastViewedAt))) {
                authMarkViewed(file.id, attorney.id).catch(() => {});
            }
        }
    }, [file?.id, file?.lastActivityAt, attorney?.id, authMarkViewed]);

    if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading case details...</div>;
    if (!file) return <div className="p-8 text-center">File not found.</div>;

    const handleAIRefine = async (instruction: string) => {
        const content = editor?.getHTML() || '';
        if (!content) return;
        setIsAILoading(true);
        try {
            const result = await refineDraft({ content, instruction });
            if (result.refinedContent) {
                editor?.commands.setContent(result.refinedContent);
                setDraftContent(result.refinedContent);
                toast({ title: 'AI Refinement Complete' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'AI Error' });
        } finally {
            setIsAILoading(false);
        }
    };

    const handleEditDraft = (draft: InternalDraft) => {
        setEditingDraftId(draft.id);
        setDraftTitle(draft.title);
        editor?.commands.setContent(draft.content);
        setActiveTab('new-draft');
    };

    const handleDiscardDraft = () => {
        setDraftTitle('');
        setDraftContent('');
        editor?.commands.setContent('');
        setEditingDraftId(null);
    };

    const handleSaveDraft = async () => {
        const html = editor?.getHTML() || '';
        if (!draftTitle || !html || !file) return;
        setIsSubmitting(true);
        let result = editingDraftId 
            ? await authUpdateDraft(file.fileNumber, editingDraftId, { title: draftTitle, content: html })
            : await authAddDraft(file.fileNumber, { title: draftTitle, type: 'Draft', content: html });
        if (result.success) {
            toast({ title: editingDraftId ? 'Draft Updated' : 'Draft Saved' });
            handleDiscardDraft();
            setActiveTab('drafts');
        }
        setIsSubmitting(false);
    };

    const handleDeleteDraft = async (draftId: string) => {
        if (!file) return;
        setIsSubmitting(true);
        const result = await authDeleteDraft(file.fileNumber, draftId);
        if (result.success) { toast({ title: 'Draft Deleted' }); setDraftToDelete(null); }
        setIsSubmitting(false);
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!file) return;
        setIsSubmitting(true);
        const result = await authDeleteAttachment(file.fileNumber, attachmentId);
        if (result.success) { toast({ title: 'Attachment Deleted' }); setAttachmentToDelete(null); }
        setIsSubmitting(false);
    }

    const handleExportDraft = async (draft: InternalDraft, type: 'letter' | 'memo') => {
        if (!file) return;
        setIsExporting(true);
        try { await downloadLegalDoc(draft, file, type); toast({ title: 'Word Document Generated' }); } catch (e: any) { toast({ variant: 'destructive', title: 'Export Failed' }); } finally { setIsExporting(false); }
    };

    const handleTogglePin = async () => {
        if (!file || !attorney) return;
        await authTogglePin(file.id, attorney.id);
        toast({ title: file.pinnedBy?.[attorney.id] ? 'File Unpinned' : 'File Pinned to Top' });
    }

    const handleAddReminder = async () => {
        if (!reminderText || !selectedDate || !file) return;
        setIsSubmitting(true);
        const combinedDate = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(':').map(Number);
        combinedDate.setHours(hours, minutes);
        const result = await authAddReminder(file.fileNumber, { text: reminderText, date: combinedDate.toISOString() });
        if (result.success) { toast({ title: 'Reminder Set' }); setReminderText(''); setSelectedDate(undefined); setSelectedTime('09:00'); }
        setIsSubmitting(false);
    };

    const handleSendInstruction = async () => {
        if (!instructionText || !file || !attorney) return;
        setIsSubmitting(true);
        let target = '';
        if (recipientType === 'registry') target = 'Registry';
        else if (recipientType === 'attorney') {
            const att = allAttorneys?.find(a => a.id === specificRecipientId);
            target = att ? att.fullName : 'Practitioner';
        } else {
            target = file.assignedTo || 'Lead Counsel';
            if (isLead && file.group) target = `${file.group} Group Head`;
        }
        const result = await authAddInstruction(file.fileNumber, { text: instructionText, from: isSG ? `Solicitor General (${attorney.fullName})` : attorney.fullName, to: target });
        if (result.success) { toast({ title: 'Message Sent' }); setInstructionText(''); }
        setIsSubmitting(false);
    }

    const handleRequestFile = async () => {
        if (!file || !attorney) return;
        setIsSubmitting(true);
        const result = await authRequestFile(file.fileNumber, attorney.id, attorney.fullName);
        if (result.success) { toast({ title: 'Request Sent' }); } else { toast({ variant: 'destructive', title: 'Error', description: result.message }); }
        setIsSubmitting(false);
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile || !file || !attorney || !user) return;
        if (selectedFile.size > MAX_FILE_SIZE) { toast({ variant: 'destructive', title: 'File Too Large' }); return; }
        setIsUploading(true);
        try {
            const idToken = await user.getIdToken();
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('fileNumber', file.fileNumber);
            formData.append('accessId', attorney.accessId);
            const response = await fetch('/api/attachments/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${idToken}` }, body: formData });
            const result = await response.json();
            if (result.success) toast({ title: 'Upload Successful' });
            else toast({ variant: 'destructive', title: 'Upload Denied' });
        } catch (error) { toast({ variant: 'destructive', title: 'Security Error' }); } finally { setIsUploading(false); if (e.target) e.target.value = ''; }
    };

    const handleViewDocument = async (attachment: Attachment) => {
        if (!attorney || !user) return;
        try {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/attachments/download?path=${encodeURIComponent(attachment.path)}&accessId=${encodeURIComponent(attorney.accessId)}`, { headers: { 'Authorization': `Bearer ${idToken}` } });
            const result = await response.json();
            if (result.url) window.open(result.url, '_blank');
            else toast({ variant: 'destructive', title: 'View Failed' });
        } catch (error) { toast({ variant: 'destructive', title: 'Security Error' }); }
    };

    const completedMilestones = (file?.milestones || []).filter(m => m.isCompleted).length;
    const progress = (file?.milestones || []).length > 0 ? (completedMilestones / file!.milestones!.length) * 100 : 0;

    return (
        <div className="min-h-screen bg-muted/20 pb-20 font-body">
            <header className="bg-background border-b px-4 h-16 flex items-center sticky top-0 z-10 shadow-sm gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft className="h-5 w-5" /></Button>
                <div className="min-w-0">
                    <h2 className="text-sm font-bold truncate">{file.subject}</h2>
                    <div className="flex items-center gap-2"><p className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider">{file.fileNumber}</p>{isCompleted && (<Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 text-[9px] h-4 uppercase">Completed</Badge>)}{isHistoricalOnly && (<Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20 text-[9px] h-4 uppercase gap-1"><Lock className="h-2.5 w-2.5" /> Read Only History</Badge>)}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {!isCompleted && !isSG && !isHistoricalOnly && (<Button variant="ghost" size="sm" className={cn("h-8 gap-2", isPinned ? "text-yellow-600 bg-yellow-50" : "text-muted-foreground")} onClick={handleTogglePin}><Pin className={cn("h-4 w-4", isPinned && "fill-current")} /><span className="hidden sm:inline">{isPinned ? 'Pinned' : 'Pin Case'}</span></Button>)}
                    {isLead && !isCompleted && (<AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="sm" className="h-8 border-green-200 text-green-700 hover:bg-green-50"><CheckCircle className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Complete Case</span></Button></AlertDialogTrigger><AlertDialogContent className="w-[95vw] sm:max-w-lg"><AlertDialogHeader><AlertDialogTitle>Mark Case as Completed?</AlertDialogTitle><AlertDialogDescription>This will finalize the file status and notify the Registry.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="flex flex-col sm:flex-row gap-2"><AlertDialogCancel className="sm:mt-0">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => authToggleStatus(file.id, file.fileNumber, 'Completed')} className="bg-green-600 hover:bg-green-700">Confirm Completion</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
                    {isSG && <Badge className="bg-yellow-500 text-white border-yellow-600 text-[9px] uppercase tracking-widest gap-1"><Crown className="h-3 w-3" /> SG Oversight</Badge>}
                </div>
            </header>

            <main className="container mx-auto p-3 md:p-4 lg:p-6 xl:p-8 space-y-6">
                {isHistoricalOnly && (<div className="flex items-center gap-3 p-4 bg-muted/50 border border-muted-foreground/20 rounded-lg text-muted-foreground shadow-sm animate-in fade-in slide-in-from-top-2"><Lock className="h-5 w-5 shrink-0" /><div><p className="text-xs font-bold uppercase tracking-widest leading-none">View-Only Access Enabled</p><p className="text-[10px] mt-1">You were previously assigned to this file. Historical access allows review, but actions are restricted to current team.</p></div></div>)}
                {file.isJudgmentDebt && (<Card className="bg-red-50 border-red-200 shadow-sm animate-in fade-in slide-in-from-top-2 overflow-hidden"><CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="bg-red-100 p-3 rounded-full border border-red-200"><Banknote className="h-6 w-6 text-red-600" /></div><div className="space-y-1"><p className="text-[10px] font-black text-red-800 uppercase tracking-[0.2em]">Judgment Debt Liability</p><div className="flex flex-col gap-1">{(file.amountGHC) ? (<p className="text-2xl sm:text-3xl font-black text-red-700 tabular-nums tracking-tighter">GH₵ {file.amountGHC?.toLocaleString()}</p>) : null}{file.amountUSD ? (<p className="text-xl sm:text-2xl font-black text-blue-700 tabular-nums tracking-tighter leading-none">$ {file.amountUSD?.toLocaleString()}</p>) : null}</div></div></div><div className="text-center sm:text-right"><Badge variant="destructive" className="bg-red-600 hover:bg-red-700 text-[10px] uppercase font-bold tracking-widest px-3 py-1 animate-pulse">High Priority</Badge></div></CardContent></Card>)}

                <Card className="border-primary/10 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-2"><FileText className="h-3 w-3" /> Full File Subject</CardTitle></CardHeader><CardContent><h1 className="text-base font-bold leading-relaxed text-foreground whitespace-pre-wrap">{file.subject}</h1></CardContent></Card>

                <Card className="border-primary/10 overflow-hidden"><div className="bg-primary/5 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex-1 space-y-1.5 w-full"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-primary/70"><span>Case Progress</span><span>{Math.round(progress)}% Complete</span></div><Progress value={progress} className="h-2.5 bg-background border w-full" /></div><div className="flex gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0">{(file.milestones || []).map((m, i) => (<div key={m.id} className="flex flex-col items-center gap-1"><div className={cn("h-3 w-3 rounded-full border shadow-sm", m.isCompleted ? "bg-primary border-primary" : "bg-background border-muted-foreground/30")} title={m.title} /><span className="text-[8px] font-bold uppercase text-muted-foreground">Step {i+1}</span></div>))}</div></div></Card>

                <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                    <div className="lg:col-span-1 space-y-6">
                        <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground uppercase">Case Summary</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label className="text-[10px] text-muted-foreground uppercase">Lead Assignee</Label><p className="text-sm font-bold text-primary truncate">{file.assignedTo || 'Unassigned'}</p></div><div><Label className="text-[10px] text-muted-foreground uppercase">Current Possession</Label><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 px-2 py-0 h-5 text-[10px] truncate max-w-full">{currentPossessorName}</Badge></div><Separator /><div className="grid grid-cols-2 gap-4"><div><Label className="text-[10px] text-muted-foreground uppercase">Suit Number</Label><p className="text-sm font-medium truncate">{file.suitNumber || 'N/A'}</p></div><div><Label className="text-[10px] text-muted-foreground uppercase">Category</Label><p className="text-sm font-medium capitalize truncate">{file.category}</p></div></div><Separator /><Button className="w-full h-10 gap-2" variant={hasPendingRequest ? "secondary" : "default"} onClick={handleRequestFile} disabled={isSubmitting || hasPendingRequest || (isPossessor && !isSG) || isCompleted || isHistoricalOnly}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandIcon className="h-4 w-4" />}{isCompleted ? "Case Completed" : hasPendingRequest ? "Request Pending" : isPossessor ? "File at your desk" : isHistoricalOnly ? "Read Only Access" : "Request Physical File"}</Button></CardContent></Card>
                        
                        {file.coAssignees && file.coAssignees.length > 0 && (
                            <Card className="border-primary/10 shadow-sm">
                                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Users className="h-3 w-3" /> Assigned Team</CardTitle></CardHeader>
                                <CardContent><div className="flex flex-wrap gap-2">{file.coAssignees.map(name => <Badge key={name} variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px]">{name}</Badge>)}</div></CardContent>
                            </Card>
                        )}

                        {!isSG && (<Card className="border-primary/20"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /> Milestones</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-3">{(file.milestones || []).map((milestone) => (<div key={milestone.id} className={cn("flex items-center space-x-3 p-3 rounded-lg border transition-colors", milestone.isCompleted ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent")}><Checkbox id={milestone.id} checked={milestone.isCompleted} onCheckedChange={() => authUpdateMilestones(file.fileNumber, (file.milestones || []).map(m => m.id === milestone.id ? { ...m, isCompleted: !m.isCompleted } : m))} disabled={isCompleted || isHistoricalOnly} /><label htmlFor={milestone.id} className={cn("text-xs font-medium leading-none cursor-pointer", milestone.isCompleted ? "text-primary" : "text-muted-foreground")}>{milestone.title}</label></div>))}</div></CardContent></Card>)}
                        {!isSG && (<Card><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-primary" /> Reminders</CardTitle></CardHeader><CardContent className="space-y-4">{!isCompleted && !isHistoricalOnly && (<div className="space-y-2"><Input placeholder="Task description..." value={reminderText} onChange={(e) => setReminderText(e.target.value)} className="h-8 text-xs" /><div className="flex flex-col sm:flex-row gap-2"><Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}><PopoverTrigger asChild><Button variant="outline" className={cn("h-8 text-[10px] flex-1 justify-start font-normal px-2", !selectedDate && "text-muted-foreground")}><CalendarIcon className="mr-1.5 h-3 w-3" />{selectedDate ? format(selectedDate, "MMM d") : "Pick Date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={selectedDate} onSelect={(date) => { setSelectedDate(date); setIsCalendarOpen(false); }} initialFocus /></PopoverContent></Popover><div className="flex gap-2 w-full sm:w-auto"><Input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="h-8 text-[10px] flex-1 sm:w-20 px-1" /><Button size="sm" className="h-8 w-8 p-0 shrink-0" onClick={handleAddReminder} disabled={isSubmitting || !selectedDate || !reminderText}><Plus className="h-3 w-3" /></Button></div></div></div>)}<Separator /><div className="space-y-2">{ (file.reminders || []).filter(r => !r.isCompleted).length > 0 ? (file.reminders || []).filter(r => !r.isCompleted).map(r => (<div key={r.id} className="flex items-start gap-2 bg-muted/50 p-2 rounded-md">{!isCompleted && !isHistoricalOnly && (<Button variant="ghost" size="icon" className="h-4 w-4 mt-0.5 shrink-0" onClick={() => authToggleReminder(file.fileNumber, r.id)}><div className="h-3 w-3 rounded border border-muted-foreground" /></Button>)}<div className="flex-1 min-w-0"><p className="text-[11px] leading-tight font-medium truncate">{r.text}</p><p className="text-[9px] text-primary font-bold mt-0.5">{toDate(r.date) ? format(toDate(r.date)!, 'MMM d, p') : 'N/A'}</p></div></div>)) : (<p className="text-[10px] text-muted-foreground text-center italic py-2">No active reminders.</p>) }</div></CardContent></Card>)}
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <div className="overflow-x-auto pb-2"><TabsList className="flex w-fit sm:grid sm:w-full grid-cols-5 min-w-[500px]"><TabsTrigger value="folios" className="text-[10px] sm:text-xs"><History className="h-3 w-3 mr-1.5" /> Folios</TabsTrigger><TabsTrigger value="attachments" className="text-[10px] sm:text-xs"><Paperclip className="h-3 w-3 mr-1.5" /> Files</TabsTrigger><TabsTrigger value="communications" className="text-[10px] sm:text-xs"><MessageSquare className="h-3 w-3 mr-1.5" /> Messaging</TabsTrigger><TabsTrigger value="drafts" className="text-[10px] sm:text-xs"><FileText className="h-3 w-3 mr-1.5" /> Drafts</TabsTrigger><TabsTrigger value="new-draft" className="text-[10px] sm:text-xs" disabled={!canInteract}>{editingDraftId ? <Pencil className="h-3 w-3 mr-1.5" /> : <Plus className="h-3 w-3 mr-1.5" />}{editingDraftId ? 'Edit Draft' : 'New Draft'}</TabsTrigger></TabsList></div>
                            <TabsContent value="folios" className="space-y-4">
                                {[...(file?.letters || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0)).map((letter, i, arr) => (
                                    <Card key={letter.id} className="shadow-sm"><CardHeader className="py-3 flex flex-row items-center justify-between border-b bg-muted/30"><Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest">{letter.type}</Badge><div className="flex items-center gap-2">{letter.scanUrl && (<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[10px] text-primary font-bold hover:bg-primary/10" onClick={() => window.open(letter.scanUrl, '_blank')}><Eye className="h-3 w-3" />View Scan</Button>)}<span className="text-[10px] text-muted-foreground">{toDate(letter.date) ? format(toDate(letter.date)!, 'PPP') : 'N/A'}</span></div></CardHeader><CardContent className="py-4 space-y-2"><h4 className="font-semibold text-sm">{letter.subject}</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"><div><Label className="text-[9px] text-muted-foreground uppercase">Source/Registry</Label><p className="truncate">{letter.recipient}</p></div><div><Label className="text-[9px] text-muted-foreground uppercase">Doc No.</Label><p className="truncate">{letter.documentNo || 'N/A'}</p></div></div>{letter.remarks && (<div className="mt-2 p-2 bg-muted/20 rounded border-l-2 italic text-xs">{letter.remarks}</div>)}</CardContent></Card>
                                ))}
                            </TabsContent>
                            <TabsContent value="attachments" className="space-y-6">
                                {canInteract && (<Card className="border-dashed border-2 bg-muted/10"><CardContent className="py-10 flex flex-col items-center justify-center space-y-4 px-4 text-center"><div className="bg-primary/10 p-4 rounded-full"><Upload className="h-8 w-8 text-primary" /></div><div className="space-y-1"><h4 className="font-bold">Upload Case Work</h4><p className="text-xs text-muted-foreground">Attach PDFs or Word documents (Max 2MB)</p></div><div className="relative w-full max-w-xs"><input type="file" className="absolute inset-0 opacity-0 cursor-pointer w-full" accept=".pdf,.doc,.docx" onChange={handleFileUpload} disabled={isUploading} /><Button disabled={isUploading} variant="outline" className="gap-2 w-full">{isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Select Document</Button></div></CardContent></Card>)}
                                <div className="space-y-3"><h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Attached Documents</h3><div className="grid gap-3">{(file?.attachments || []).length > 0 ? (file.attachments || []).map(att => (<Card key={att.id}><CardContent className="p-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-0"><div className="p-2 bg-muted rounded shrink-0"><FileIcon className="h-5 w-5 text-muted-foreground" /></div><div className="min-w-0"><p className="text-sm font-semibold leading-none truncate">{att.name}</p><p className="text-[10px] text-muted-foreground uppercase mt-1.5 truncate">By {att.uploadedBy} • {toDate(att.uploadedAt) ? format(toDate(att.uploadedAt)!, 'MMM d') : 'N/A'}</p></div></div><div className="flex items-center gap-1 shrink-0"><Button variant="ghost" size="icon" onClick={() => handleViewDocument(att)} title="View Document"><Eye className="h-4 w-4" /></Button>{canInteract && profile?.fullName === att.uploadedBy && (<Button variant="ghost" size="icon" onClick={() => setAttachmentToDelete(att)} className="text-destructive" title="Delete Document"><Trash2 className="h-4 w-4" /></Button>)}</div></CardContent></Card>)) : (<div className="text-center py-12 border border-dashed rounded-lg bg-background"><AlertCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground italic">No files attached to this case.</p></div>)}</div></div>
                            </TabsContent>
                            <TabsContent value="communications" className="space-y-6">
                                {canInteract && (<Card className={cn("border-primary/20", isSG ? "bg-yellow-50/20" : "bg-primary/5")}><CardHeader className="pb-3"><CardTitle className="text-sm">{isSG ? 'Executive Instruction' : 'Team Messaging'}</CardTitle><CardDescription className="text-xs">Coordinate with co-assignees or the Registry.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-3"><Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">To:</Label><RadioGroup value={recipientType} onValueChange={(val: any) => setRecipientType(val)} className="flex flex-col gap-2"><div className="flex items-center space-x-2 bg-background p-2 rounded-md border shadow-sm"><RadioGroupItem value="lead" id="target-lead" /><Label htmlFor="target-lead" className="text-xs font-medium cursor-pointer">Lead / Team</Label></div>{isSG && (<div className="flex items-center space-x-2 bg-background p-2 rounded-md border shadow-sm"><RadioGroupItem value="attorney" id="target-attorney" /><Label htmlFor="target-attorney" className="text-xs font-medium cursor-pointer">Specific Attorney</Label></div>)}<div className="flex items-center space-x-2 bg-background p-2 rounded-md border shadow-sm"><RadioGroupItem value="registry" id="target-registry" /><Label htmlFor="target-registry" className="text-xs font-medium cursor-pointer">The Registry</Label></div></RadioGroup></div>{recipientType === 'attorney' && (<div className="space-y-2 animate-in fade-in zoom-in-95"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Select Recipient</Label><Select value={specificRecipientId} onValueChange={setSpecificRecipientId}><SelectTrigger className="bg-background"><SelectValue placeholder="Choose attorney..." /></SelectTrigger><SelectContent>{allAttorneys?.map(a => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}</SelectContent></Select></div>)}<Textarea placeholder="Type your message to the team..." value={instructionText} onChange={(e) => setInstructionText(e.target.value)} className="min-h-[100px] text-sm bg-background" /><Button className={cn("w-full h-9 gap-2", isSG && "bg-yellow-600 hover:bg-yellow-700")} onClick={handleSendInstruction} disabled={isSubmitting || !instructionText.trim() || (recipientType === 'attorney' && !specificRecipientId)}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{isSG ? 'Issue Directive' : 'Send Message'}</Button></CardContent></Card>)}
                                <div className="space-y-4">{(file?.internalInstructions || []).length > 0 ? [...(file.internalInstructions)].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0)).map(instruction => (<div key={instruction.id} className={cn("relative pl-4 border-l-2 py-1", instruction.from.toLowerCase().includes('solicitor general') ? "border-l-yellow-500" : instruction.from.toLowerCase().includes('registry') ? "border-l-blue-500" : "border-l-primary/30")}><div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1"><div className="flex items-center gap-2 flex-wrap"><span className={cn("text-[10px] font-bold uppercase", instruction.from.toLowerCase().includes('solicitor general') ? "text-yellow-700" : instruction.from.toLowerCase().includes('registry') ? "text-blue-600" : "text-primary")}>{instruction.from}</span><span className="text-muted-foreground text-[10px]">→</span><span className="text-[10px] font-bold text-muted-foreground uppercase">{instruction.to}</span></div><span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap">{toDate(instruction.date) ? format(toDate(instruction.date)!, 'MMM d, p') : 'N/A'}</span></div><p className={cn("text-sm leading-relaxed p-3 rounded-md border shadow-sm", instruction.from.toLowerCase().includes('solicitor general') ? "bg-yellow-50/30 border-yellow-100 italic" : instruction.from.toLowerCase().includes('registry') ? "bg-blue-50/30" : "bg-background")}>{instruction.text}</p></div>)) : (<div className="text-center py-20 border border-dashed rounded-lg bg-background"><p className="text-sm text-muted-foreground">No communication history yet.</p></div>)}</div>
                            </TabsContent>
                            <TabsContent value="drafts" className="space-y-4">
                                {(file?.internalDrafts || []).length > 0 ? (<Accordion type="single" collapsible className="w-full space-y-2">{(file.internalDrafts || []).map(draft => ( <div key={draft.id} className="relative group border rounded-lg bg-card shadow-sm"><AccordionItem value={draft.id} className="border-none"><AccordionTrigger className="hover:no-underline px-4 py-4"><div className="flex flex-col items-start text-left gap-1 pr-24"><span className="text-sm font-bold text-primary truncate w-full">{draft.title}</span><span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{toDate(draft.date) ? format(toDate(draft.date)!, 'MMM d, yyyy') : 'N/A'}</span></div></AccordionTrigger>{canInteract && (<div className="absolute right-12 top-4 flex items-center gap-1 z-20"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditDraft(draft); }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDraftToDelete(draft); }}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}<AccordionContent className="px-4 pb-6 pt-2 border-t"><div className="text-sm leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_u]:underline [&_strong]:font-bold [&_em]:italic overflow-x-auto mb-6" dangerouslySetInnerHTML={{ __html: draft.content }} />{!isSG && !isHistoricalOnly && (<div className="flex flex-wrap items-center gap-2 pt-4 border-t"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-full mb-1">Finalize & Export to Word:</p><Button variant="outline" size="sm" className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/5" onClick={() => handleExportDraft(draft, 'letter')} disabled={isExporting}>{isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}Export as Letter</Button><Button variant="outline" size="sm" className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/5" onClick={() => handleExportDraft(draft, 'memo')} disabled={isExporting}>{isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}Export as Memo</Button></div>)}</AccordionContent></AccordionItem></div> ))}</Accordion>) : (<div className="text-center py-20 border border-dashed rounded-lg bg-background"><p className="text-sm text-muted-foreground">No shared drafts yet.</p></div>)}
                            </TabsContent>
                            <TabsContent value="new-draft"><Card className="border-primary/10 overflow-hidden"><CardHeader className="border-b bg-muted/30"><CardTitle className="text-sm">{editingDraftId ? 'Edit Draft' : 'Legal Drafting Workspace'}</CardTitle><CardDescription className="text-xs">{editingDraftId ? `Currently modifying draft: ${draftTitle}` : 'Shared team drafting workspace.'}</CardDescription></CardHeader><CardContent className="p-0"><div className="p-4 space-y-4"><div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Draft Title</Label><Input placeholder="e.g. Statement of Defense" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="border-none bg-muted/20 focus-visible:ring-1" /></div><div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-muted/50 rounded-lg border"><div className="flex items-center gap-1 pr-2 border-r overflow-x-auto scrollbar-hide"><Button variant={editor?.isActive('bold') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 shrink-0" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button><Button variant={editor?.isActive('italic') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 shrink-0" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button><Button variant={editor?.isActive('underline') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 shrink-0" onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Button></div><div className="flex items-center gap-1 px-2 border-r"><Button variant={editor?.isActive('bulletList') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 shrink-0" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button></div><div className="ml-auto flex items-center gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-2 border-primary/20 text-primary" disabled={isAILoading || !draftContent || draftContent === '<p></p>'}>{isAILoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}<span className="hidden sm:inline">AI Tools</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Draft Assistant</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleAIRefine("Apply a professional and formal legal tone.")}><Type className="mr-2 h-4 w-4" /> Legal Polish</DropdownMenuItem><DropdownMenuItem onClick={() => handleAIRefine("Make concise while maintaining arguments.")}><Sparkles className="mr-2 h-4 w-4" /> Summarize</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div><div className="relative group border rounded-md min-h-[400px] bg-background shadow-inner"><EditorContent editor={editor} /><div className="absolute bottom-3 right-4 flex items-center gap-3 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded border"><span className="font-bold">{editor?.getText().trim() ? editor.getText().trim().split(/\s+/).length : 0} Words</span></div></div></div><div className="p-4 bg-muted/30 border-t flex flex-col sm:flex-row justify-end gap-3"><Button variant="ghost" onClick={handleDiscardDraft} className="w-full sm:w-auto">Discard</Button><Button className="min-w-[150px] gap-2 w-full sm:w-auto" onClick={handleSaveDraft} disabled={isSubmitting || !draftTitle || !draftContent || draftContent === '<p></p>'}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{editingDraftId ? 'Update Draft' : 'Save to Case File'}</Button></div></CardContent></Card></TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
            <AlertDialog open={!!draftToDelete} onOpenChange={(open) => !open && setDraftToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Draft?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to permanently remove this shared draft?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => draftToDelete && handleDeleteDraft(draftToDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete Draft</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <AlertDialog open={!!attachmentToDelete} onOpenChange={(open) => !open && setAttachmentToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Attachment?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to remove <strong>{attachmentToDelete?.name}</strong> from this case?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => attachmentToDelete && handleDeleteAttachment(attachmentToDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete Attachment</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
    );
}
