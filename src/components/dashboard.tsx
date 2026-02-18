'use client';

import type { CorrespondenceFile, Letter, Movement, Attorney, CaseReminder, FileRequest, Reminder } from '@/lib/types';
import { Folder, Mail, Scale, Truck, CheckCircle2, Loader2, UserCheck, Users, Calendar, MessageCircle, MessageSquare, FileText, AlertCircle, HandIcon, Clock, Bell, History, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardChart } from './dashboard-chart';
import { WorkloadAnalytics } from './workload-analytics';
import React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useAuthAction } from '@/hooks/use-auth-action';
import { confirmFileReceipt, toggleReminder, cancelFileRequest, markFileAsViewed, toggleGeneralReminder } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format, isPast, isToday, formatDistanceToNow, subHours, isAfter } from 'date-fns';
import { Badge } from './ui/badge';
import { useProfile } from './auth-provider';
import { FileDetailDialog } from './file-detail-dialog';

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
}

const StatCard = ({ title, value, icon: Icon, colorClass, onClick }: { title: string, value: number, icon: React.ElementType, colorClass?: string, onClick?: () => void }) => (
    <Card className={cn(onClick && "cursor-pointer hover:bg-accent/50 transition-colors shadow-sm")} onClick={onClick}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={`h-4 w-4 ${colorClass || 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export function Dashboard({
  initialFiles,
  initialIncomingMail,
  initialCourtProcesses,
  generalReminders = [],
}: {
  initialFiles: CorrespondenceFile[];
  initialIncomingMail: Letter[];
  initialCourtProcesses: Letter[];
  generalReminders?: Reminder[];
}) {
  const firestore = useFirestore();
  const { isAdmin, profile } = useProfile();
  const [isInTransitOpen, setIsInTransitOpen] = React.useState(false);
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null);
  const { toast } = useToast();

  const attorneysQuery = useMemoFirebase(() => firestore ? collection(firestore, 'attorneys') : null, [firestore]);
  const { data: attorneys } = useCollection<Attorney>(attorneysQuery);

  const inTransitFiles = React.useMemo(() => {
    return initialFiles.flatMap(file => {
        const movements = Array.isArray(file.movements) ? file.movements : [];
        if (movements.length === 0) return [];
        const sorted = [...movements].sort((a, b) => {
            const dateA = toDate(a.date)?.getTime() || 0;
            const dateB = toDate(b.date)?.getTime() || 0;
            if (dateB !== dateA) return dateB - dateA;
            return b.id.localeCompare(a.id);
        });
        const latest = sorted[0];
        if (latest && !latest.receivedAt && latest.movedTo?.toLowerCase() !== 'registry') {
            return [{ ...file, latestMovement: latest }];
        }
        return [];
    });
  }, [initialFiles]);

  const pendingRequests = React.useMemo(() => {
    return initialFiles.flatMap(file => 
        (file.requests || []).map(req => ({
            ...req,
            fileNumber: file.fileNumber,
            fileSubject: file.subject,
            fileId: file.id
        }))
    ).sort((a, b) => toDate(b.requestedAt)!.getTime() - toDate(a.requestedAt)!.getTime());
  }, [initialFiles]);

  const allUpcomingReminders = React.useMemo(() => {
    const fileReminders = initialFiles.flatMap(file => 
        (file.reminders || [])
            .filter(r => !r.isCompleted)
            .map(r => ({
                ...r,
                fileNumber: file.fileNumber,
                subject: file.subject,
                assignedTo: file.assignedTo,
                isGeneral: false
            }))
    );

    const mappedGeneralReminders = generalReminders.map(r => ({
        ...r,
        fileNumber: 'General',
        subject: 'Administrative / Personal Activity',
        assignedTo: r.attorneyName,
        isGeneral: true
    }));

    return [...fileReminders, ...mappedGeneralReminders].sort((a, b) => {
        const dA = toDate(a.date);
        const dB = toDate(b.date);
        if (!dA || !dB) return 0;
        return dA.getTime() - dB.getTime();
    });
  }, [initialFiles, generalReminders]);

  const groupedInTransit = React.useMemo(() => {
    const groups: Record<string, typeof inTransitFiles> = {};
    inTransitFiles.forEach(file => {
        const dest = file.latestMovement.movedTo || 'Registry';
        if (!groups[dest]) groups[dest] = [];
        groups[dest].push(file);
    });
    return groups;
  }, [inTransitFiles]);

  const { exec: authConfirmReceipt, isLoading: isConfirming } = useAuthAction(confirmFileReceipt);
  const { exec: authToggleReminder } = useAuthAction(toggleReminder);
  const { exec: authToggleGeneralReminder } = useAuthAction(toggleGeneralReminder);
  const { exec: authCancelRequest } = useAuthAction(cancelFileRequest);
  const { exec: authMarkViewed } = useAuthAction(markFileAsViewed);

  const handleViewFile = (fileId: string) => {
    setSelectedFileId(fileId);
    if (profile?.id) {
        authMarkViewed(fileId, profile.id).catch(() => {});
    }
  };

  const selectedFileRef = useMemoFirebase(() => {
    if (!firestore || !selectedFileId) return null;
    return doc(firestore, 'files', selectedFileId);
  }, [firestore, selectedFileId]);
  const { data: selectedFileForDetail } = useDoc<CorrespondenceFile>(selectedFileRef);

  const handleConfirm = async (file: typeof inTransitFiles[0]) => {
    const formData = new FormData();
    formData.append('fileNumber', file.fileNumber);
    formData.append('movementId', file.latestMovement.id);
    const result = await authConfirmReceipt(formData);
    
    if (result && result.message?.includes('Success')) {
        toast({ title: "Receipt Confirmed", description: `File ${file.fileNumber} has been received.` });
        const destination = file.latestMovement.movedTo;
        const targetAttorney = attorneys?.find(a => a.fullName.toLowerCase() === destination.toLowerCase());
        if (targetAttorney?.phoneNumber) {
            const message = encodeURIComponent(
                `Hello ${targetAttorney.fullName},\n\nThe following file(s) have been delivered to your desk and confirmed received in the system:\n\n• ${file.fileNumber} - ${file.subject}\n\nPlease verify physical receipt.\n\nThank you.`
            );
            window.open(`https://wa.me/${targetAttorney.phoneNumber.replace(/\D/g, '')}?text=${message}`, '_blank');
        }
    }
  };

  const handleSendReminder = async (reminder: any) => {
    if (!reminder.assignedTo) {
        toast({ variant: 'destructive', title: "No Assigned Attorney", description: "This file has no attorney assigned to notify." });
        return;
    }

    const attorney = attorneys?.find(a => a.fullName.toLowerCase() === reminder.assignedTo.toLowerCase());
    if (!attorney?.phoneNumber) {
        toast({ variant: 'destructive', title: "No Contact Info", description: "The assigned attorney does not have a registered phone number." });
        return;
    }

    const dateStr = format(toDate(reminder.date)!, 'PPp');
    
    // Shorten title if too long
    const rawSubject = reminder.subject || '';
    const truncatedSubject = rawSubject.length > 60 
        ? rawSubject.substring(0, 57) + "..." 
        : rawSubject;

    const fileDisplay = reminder.fileNumber === 'General'
        ? 'General Activity'
        : `${reminder.fileNumber} (${truncatedSubject})`;

    const message = encodeURIComponent(
        `Hello ${attorney.fullName},\n\nThis is an automated reminder from the File Tracker system regarding this file/activity below:\n\n• File: ${fileDisplay}\n• Task: ${reminder.text}\n• Due Date: ${dateStr}\n\nPlease take the necessary action.\n\nThank you.`
    );
    
    window.open(`https://wa.me/${attorney.phoneNumber.replace(/\D/g, '')}?text=${message}`, '_blank');

    try {
        if (reminder.fileNumber === 'General') {
            await authToggleGeneralReminder(reminder.id);
        } else {
            await authToggleReminder(reminder.fileNumber, reminder.id);
        }
        toast({ 
            title: "Notification Sent", 
            description: "The attorney has been notified and the reminder has been cleared from active lists." 
        });
    } catch (e) {
        console.error("Failed to automatically clear reminder:", e);
    }
  };

  const handleConfirmGroup = async (destination: string, files: typeof inTransitFiles) => {
    let successCount = 0;
    const confirmedFilesInfo: string[] = [];

    for (const file of files) {
        const formData = new FormData();
        formData.append('fileNumber', file.fileNumber);
        formData.append('movementId', file.latestMovement.id);
        const result = await authConfirmReceipt(formData);
        if (result && result.message?.includes('Success')) {
            successCount++;
            confirmedFilesInfo.push(`• ${file.fileNumber} - ${file.subject}`);
        }
    }
    
    if (successCount > 0) {
        toast({ title: "Batch Confirmed", description: `Successfully confirmed ${successCount} files for ${destination}.` });
        const targetAttorney = attorneys?.find(a => a.fullName.toLowerCase() === destination.toLowerCase());
        if (targetAttorney?.phoneNumber) {
            const message = encodeURIComponent(
                `Hello ${targetAttorney.fullName},\n\nThe following file(s) have been delivered to your desk and confirmed received in the system:\n\n${confirmedFilesInfo.join('\n')}\n\nPlease verify physical receipt.\n\nThank you.`
            );
            window.open(`https://wa.me/${targetAttorney.phoneNumber.replace(/\D/g, '')}?text=${message}`, '_blank');
        }
    }
  };

  return (
    <div className="container mx-auto space-y-8 pb-12 min-w-0 px-3 md:px-4 lg:px-6 xl:px-8">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Files" value={initialFiles.length} icon={Folder} />
            <StatCard title="Files in Transit" value={inTransitFiles.length} icon={Truck} colorClass={inTransitFiles.length > 0 ? "text-yellow-500" : ""} onClick={() => setIsInTransitOpen(true)} />
            <StatCard title="Total Incoming Mail" value={initialIncomingMail.length} icon={Mail} />
            <StatCard title="Total Court Processes" value={initialCourtProcesses.length} icon={Scale} />
        </div>
        
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
            <DashboardChart files={initialFiles} />
            <WorkloadAnalytics files={initialFiles} attorneys={attorneys || []} />
        </div>

        <div className="grid gap-8 grid-cols-1 min-w-0">
            <Card className="shadow-sm border-primary/10 overflow-hidden">
                <CardHeader className="pb-3 border-b">
                    <div className="flex items-center gap-2">
                        <HandIcon className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle>Physical File Requests</CardTitle>
                            <CardDescription>Attorneys awaiting physical files from Registry.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-[600px] lg:min-w-full">
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="w-[120px]">Requested By</TableHead>
                                    <TableHead>File Info</TableHead>
                                    <TableHead className="w-[80px]">Awaiting</TableHead>
                                    <TableHead className="text-right w-[80px]">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingRequests.length > 0 ? pendingRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>
                                            <div className="flex flex-col max-w-[110px]">
                                                <span className="text-sm font-bold truncate">{req.requesterName}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">Practitioner</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-0">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] font-mono font-bold text-primary">{req.fileNumber}</span>
                                                <p className="text-xs truncate" title={req.fileSubject}>{req.fileSubject}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] whitespace-nowrap gap-1 px-1.5 py-0">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(toDate(req.requestedAt)!)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-destructive hover:bg-destructive/10 h-8"
                                                onClick={() => authCancelRequest(req.fileNumber, req.id)}
                                            >
                                                Clear
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                                            No pending file requests.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid gap-8 min-w-0">
            <Card className="shadow-sm border-primary/10 overflow-hidden">
                <CardHeader className="pb-3 border-b">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle>Upcoming System-wide Deadlines</CardTitle>
                            <CardDescription>Aggregated reminders for both case files and general activities.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-[800px] lg:min-w-full">
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="w-[150px]">Due Date/Time</TableHead>
                                    <TableHead className="w-[150px]">Attorney</TableHead>
                                    <TableHead>File / Task</TableHead>
                                    <TableHead className="text-right w-[100px]">Notify</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allUpcomingReminders.length > 0 ? allUpcomingReminders.map(reminder => {
                                    const d = toDate(reminder.date)!;
                                    const isOverdue = isPast(d) && !isToday(d);
                                    return (
                                        <TableRow key={reminder.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className={cn("font-bold text-xs", isOverdue ? "text-destructive" : "text-primary")}>
                                                        {format(d, 'MMM d, p')}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{isToday(d) ? 'Today' : isOverdue ? 'Overdue' : format(d, 'EEEE')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-sm font-medium truncate max-w-[140px]" title={reminder.assignedTo || 'Unassigned'}>
                                                    {reminder.assignedTo || 'Unassigned'}
                                                </p>
                                            </TableCell>
                                            <TableCell className="max-w-0">
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className={cn("text-[10px] font-mono font-bold uppercase truncate", reminder.fileNumber === 'General' ? "text-purple-600" : "text-muted-foreground")}>
                                                        {reminder.fileNumber}
                                                    </span>
                                                    <p className="text-xs truncate" title={reminder.text}>{reminder.text}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="h-8 gap-2 border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                                    onClick={() => handleSendReminder(reminder)}
                                                >
                                                    <MessageCircle className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">WhatsApp</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                                            No active reminders found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Dialog open={isInTransitOpen} onOpenChange={setIsInTransitOpen}>
            <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Files in Transit</DialogTitle>
                    <DialogDescription>Awaiting acknowledgment at their destination. Grouped by recipient.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-8 [&_*]:min-w-0">
                    {Object.keys(groupedInTransit).length > 0 ? (
                        Object.entries(groupedInTransit).map(([destination, files]) => (
                            <div key={destination} className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-muted/30 p-3 rounded-lg border min-w-0 gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <UserCheck className="h-5 w-5 text-primary shrink-0" />
                                        <h3 className="font-semibold text-lg truncate">{destination}</h3>
                                        <span className="text-sm text-muted-foreground ml-2 shrink-0">({files.length})</span>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-8 bg-background shrink-0 w-full sm:w-auto" onClick={() => handleConfirmGroup(destination, files)} disabled={isConfirming}>
                                        {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mr-2" />}
                                        Confirm &amp; Notify
                                    </Button>
                                </div>
                                <div className="rounded-md border overflow-hidden">
                                    <div className="w-full overflow-x-auto">
                                        <Table className="min-w-[600px]">
                                            <TableHeader><TableRow className="bg-muted/50"><TableHead className="w-[120px]">File No.</TableHead><TableHead>Subject</TableHead><TableHead className="w-[150px]">Date Moved</TableHead><TableHead className="text-right w-[100px]">Action</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {files.map((file) => {
                                                    const moveDate = toDate(file.latestMovement.date);
                                                    return (
                                                    <TableRow key={file.id}>
                                                        <TableCell className="font-medium whitespace-nowrap">{file.fileNumber}</TableCell>
                                                        <TableCell className="max-w-0">
                                                            <p className="truncate text-sm" title={file.subject}>{file.subject}</p>
                                                        </TableCell>
                                                        <TableCell className="text-sm whitespace-nowrap">
                                                            {moveDate ? format(moveDate, 'MMM d, p') : 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" variant="ghost" className="h-8 hover:bg-green-50 hover:text-green-700" onClick={() => handleConfirm(file)} disabled={isConfirming}>
                                                                Confirm
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="rounded-full bg-muted p-4 mb-4"><Truck className="h-8 w-8 text-muted-foreground opacity-50" /></div>
                            <h3 className="text-lg font-medium">No Files in Transit</h3>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>

        <FileDetailDialog
            file={selectedFileForDetail}
            isOpen={!!selectedFileId && !!selectedFileForDetail}
            onOpenChange={(isOpen) => !isOpen && setSelectedFileId(null)}
            onDataChange={() => { /* Real-time updates handled by Firebase */ }}
        />
    </div>
  );
}