'use client';

import type { CorrespondenceFile, Letter, Movement, Attorney, CaseReminder, FileRequest, Reminder, UserProfile } from '@/lib/types';
import { Folder, Mail, Scale, Truck, CheckCircle2, Loader2, UserCheck, Users, Calendar, MessageCircle, MessageSquare, FileText, AlertCircle, HandIcon, Clock, Bell, History, Zap, AlarmClock, Send, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardChart } from './dashboard-chart';
import { WorkloadAnalytics } from './workload-analytics';
import React from 'react';
import { cn, truncate } from '@/lib/utils';
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
import { confirmFileReceipt, toggleReminder, cancelFileRequest, markFileAsViewed, toggleGeneralReminder, recordNotification } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { format, isPast, isToday, formatDistanceToNow, subHours, isAfter, addHours } from 'date-fns';
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
  const { isAdmin, profile, isSGSec } = useProfile();
  const [isInTransitOpen, setIsInTransitOpen] = React.useState(false);
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const { toast } = useToast();

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const attorneysQuery = useMemoFirebase(() => firestore ? collection(firestore, 'attorneys') : null, [firestore]);
  const { data: attorneys } = useCollection<Attorney>(attorneysQuery);

  const secretariatQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('role', '==', 'staff@sg_sec')) : null, [firestore]);
  const { data: secretariatUsers } = useCollection<UserProfile>(secretariatQuery);

  const sgName = React.useMemo(() => {
    return attorneys?.find(a => a.isSG)?.fullName;
  }, [attorneys]);

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
            if (isSGSec && sgName && latest.movedTo?.toLowerCase() !== sgName.toLowerCase()) {
                return [];
            }
            return [{ ...file, latestMovement: latest }];
        }
        return [];
    });
  }, [initialFiles, isSGSec, sgName]);

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

  const triggeredReminders = React.useMemo(() => {
    const oneHourFromNow = addHours(currentTime, 1);
    return allUpcomingReminders.filter(reminder => {
        const d = toDate(reminder.date);
        return d && d > currentTime && d <= oneHourFromNow;
    });
  }, [allUpcomingReminders, currentTime]);

  const groupedInTransit = React.useMemo(() => {
    const groups: Record<string, typeof inTransitFiles> = {};
    inTransitFiles.forEach(file => {
        const dest = file.latestMovement.movedTo || 'Registry';
        if (!groups[dest]) groups[dest] = [];
        groups[dest].push(file);
    });

    // 1. Reorder files within each group: Notify first, Remind second
    Object.keys(groups).forEach(dest => {
        groups[dest].sort((a, b) => {
            const aNotified = !!a.latestMovement.notifiedByPhone;
            const bNotified = !!b.latestMovement.notifiedByPhone;
            if (aNotified === bNotified) return 0;
            return aNotified ? 1 : -1; // Notify (false) comes before Remind (true)
        });
    });

    // 2. Sort the destination groups so groups with "Notify" items appear before "Remind-only" groups
    const sortedEntries = Object.entries(groups).sort(([destA, filesA], [destB, filesB]) => {
        const aHasNotify = filesA.some(f => !f.latestMovement.notifiedByPhone);
        const bHasNotify = filesB.some(f => !f.latestMovement.notifiedByPhone);
        
        if (aHasNotify && !bHasNotify) return -1;
        if (!aHasNotify && bHasNotify) return 1;
        
        // Secondary sort by destination name
        return destA.localeCompare(destB);
    });

    return Object.fromEntries(sortedEntries);
  }, [inTransitFiles]);

  const { exec: authConfirmReceipt, isLoading: isConfirming } = useAuthAction(confirmFileReceipt);
  const { exec: authToggleReminder } = useAuthAction(toggleReminder);
  const { exec: authToggleGeneralReminder } = useAuthAction(toggleGeneralReminder);
  const { exec: authCancelRequest } = useAuthAction(cancelFileRequest);
  const { exec: authMarkViewed } = useAuthAction(markFileAsViewed);
  const { exec: authRecordNotification } = useAuthAction(recordNotification);

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

  const handleNotifyAttorney = async (file: typeof inTransitFiles[0]) => {
    const destination = file.latestMovement.movedTo;
    const targetAttorney = attorneys?.find(a => a.fullName.toLowerCase() === destination.toLowerCase());
    
    let notificationPhone = targetAttorney?.phoneNumber;
    let recipientLabel = targetAttorney?.fullName || destination;

    // Special Logic for SG Secretariat Routing
    if (targetAttorney?.isSG) {
        const firstSec = secretariatUsers?.find(u => !!u.phoneNumber);
        if (firstSec) {
            notificationPhone = firstSec.phoneNumber;
            recipientLabel = `SG Secretariat (${firstSec.fullName})`;
        }
    }
    
    if (notificationPhone) {
        if (profile?.phoneNumber) {
            await authRecordNotification(file.fileNumber, file.latestMovement.id, profile.phoneNumber);
        }

        const truncatedSubject = truncate(file.subject, 60);
        const message = encodeURIComponent(
            `Hello ${recipientLabel},\n\nThe following physical file has been delivered to your office:\n\n• *${file.fileNumber}* - ${truncatedSubject}\n\nPlease verify and confirm receipt of the physical folder in the tracking system.\n\nThank you.`
        );
        window.open(`https://wa.me/${notificationPhone.replace(/\D/g, '')}?text=${message}`, '_blank');
        toast({ title: "WhatsApp Alert Opened", description: `Notifying ${recipientLabel}.` });
    } else {
        toast({ variant: 'destructive', title: "No Contact Info", description: `${recipientLabel} has no registered phone number.` });
    }
  };

  const handleSecretariatConfirm = async (file: typeof inTransitFiles[0]) => {
    if (!profile) return;
    const formData = new FormData();
    formData.append('fileNumber', file.fileNumber);
    formData.append('movementId', file.latestMovement.id);
    const result = await authConfirmReceipt(formData);
    if (result && result.message.includes('Success')) {
        toast({ title: "Secretariat Receipt Confirmed", description: "The folder is now marked as delivered to the SG's office. Her portal is now unlocked." });
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
    const truncatedSubject = truncate(reminder.subject || '', 60);

    const fileDisplay = reminder.fileNumber === 'General'
        ? '*General Activity*'
        : `*${reminder.fileNumber}* (${truncatedSubject})`;

    const message = encodeURIComponent(
        `Hello ${attorney.fullName},\n\nThis is an automated reminder from the CDR_File Tracker system regarding this file/activity below:\n\n• File: ${fileDisplay}\n• Task: ${reminder.text}\n• Due Date: ${dateStr}\n\nPlease take the necessary action.\n\nThank you.`
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

  const handleNotifyBatch = async (destination: string, files: typeof inTransitFiles) => {
    const targetAttorney = attorneys?.find(a => a.fullName.toLowerCase() === destination.toLowerCase());
    
    let notificationPhone = targetAttorney?.phoneNumber;
    let recipientLabel = targetAttorney?.fullName || destination;

    if (targetAttorney?.isSG) {
        const firstSec = secretariatUsers?.find(u => !!u.phoneNumber);
        if (firstSec) {
            notificationPhone = firstSec.phoneNumber;
            recipientLabel = `SG Secretariat (${firstSec.fullName})`;
        }
    }
    
    if (notificationPhone) {
        if (profile?.phoneNumber) {
            for (const f of files) {
                await authRecordNotification(f.fileNumber, f.latestMovement.id, profile.phoneNumber);
            }
        }

        const fileList = files.map(f => `• *${f.fileNumber}* - ${truncate(f.subject, 60)}`).join('\n');
        const message = encodeURIComponent(
            `Hello ${recipientLabel},\n\nThe following physical file(s) have been delivered to your office:\n\n${fileList}\n\nPlease log in to verify and confirm receipt of the physical folder(s).\n\nThank you.`
        );
        window.open(`https://wa.me/${notificationPhone.replace(/\D/g, '')}?text=${message}`, '_blank');
        toast({ title: "Batch Notification Opened" });
    } else {
        toast({ variant: 'destructive', title: "No Contact Info", description: `${recipientLabel} has no registered phone number.` });
    }
  };

  return (
    <div className="container mx-auto space-y-8 pb-12 min-w-0 px-3 md:px-4 lg:px-6 xl:px-8">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Files" value={initialFiles.length} icon={Folder} />
            <StatCard title={isSGSec ? "Arrivals for SG" : "Files in Transit"} value={inTransitFiles.length} icon={Truck} colorClass={inTransitFiles.length > 0 ? "text-yellow-500" : ""} onClick={() => setIsInTransitOpen(true)} />
            <StatCard title="Total Incoming Mail" value={initialIncomingMail.length} icon={Mail} />
            <StatCard title="Total Court Processes" value={initialCourtProcesses.length} icon={Scale} />
        </div>

        {isSGSec && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-primary">SG Secretariat Access</h3>
                        <p className="text-sm text-muted-foreground">You are logged in as SG Secretariat. Use the "Arrivals for SG" card above to confirm physical folders as they reach the office.</p>
                    </div>
                </div>
            </div>
        )}

        {!isSGSec && triggeredReminders.length > 0 && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 sm:p-6 shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <AlarmClock className="h-24 w-24 text-amber-600 rotate-12" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4 text-center md:text-left">
                            <div className="bg-amber-100 p-3 rounded-full border border-amber-300 animate-pulse">
                                <Zap className="h-6 w-6 text-amber-600 fill-current" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight">Immediate Action Required</h3>
                                <p className="text-sm text-amber-700 font-medium">You have {triggeredReminders.length} reminder(s) due within the next hour.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-3 w-full md:w-auto">
                            {triggeredReminders.map(r => (
                                <Card key={r.id} className="bg-white/80 border-amber-200 shadow-sm w-full sm:w-[280px]">
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="destructive" className="bg-amber-600 text-white animate-pulse text-[9px] uppercase tracking-tighter h-4">Due Soon</Badge>
                                            <span className="text-[10px] font-mono font-bold text-amber-800">{r.fileNumber}</span>
                                        </div>
                                        <p className="text-xs font-bold truncate leading-tight">{r.text}</p>
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                            <p className="text-[10px] text-amber-600 font-black">{format(toDate(r.date)!, 'p')}</p>
                                            <Button 
                                                size="sm" 
                                                className="h-7 text-[9px] bg-amber-600 hover:bg-amber-700 gap-1.5"
                                                onClick={() => handleSendReminder(r)}
                                            >
                                                <MessageCircle className="h-3 w-3" />
                                                Notify Lead
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
        
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
                                    {!isSGSec && <TableHead className="text-right w-[80px]">Action</TableHead>}
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
                                        {!isSGSec && (
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
                                        )}
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={isSGSec ? 3 : 4} className="h-32 text-center text-muted-foreground italic">
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

        {!isSGSec && (
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
                                        const isDueSoon = d > currentTime && d <= addHours(currentTime, 1);

                                        return (
                                            <TableRow key={reminder.id} className={cn(isDueSoon && "bg-amber-50/50 border-l-4 border-l-amber-500 transition-all")}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className={cn("font-bold text-xs", isOverdue ? "text-destructive" : isDueSoon ? "text-amber-600" : "text-primary")}>
                                                            {format(d, 'MMM d, p')}
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-muted-foreground uppercase">{isToday(d) ? 'Today' : isOverdue ? 'Overdue' : format(d, 'EEEE')}</span>
                                                            {isDueSoon && <Badge variant="destructive" className="bg-amber-600 h-3 text-[7px] px-1 animate-pulse border-none">Urgent</Badge>}
                                                        </div>
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
                                                        <p className="text-xs truncate font-semibold" title={reminder.text}>{reminder.text}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        size="sm" 
                                                        variant={isDueSoon ? "default" : "outline"}
                                                        className={cn("h-8 gap-2", isDueSoon ? "bg-amber-600 hover:bg-amber-700" : "border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300")}
                                                        onClick={() => handleSendReminder(reminder)}
                                                    >
                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                        <span className="hidden sm:inline">{isDueSoon ? 'Notify Now' : 'WhatsApp'}</span>
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
        )}

        <Dialog open={isInTransitOpen} onOpenChange={setIsInTransitOpen}>
            <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isSGSec ? "Files Arriving at SG Secretariat" : "Files in Transit"}</DialogTitle>
                    <DialogDescription>
                        {isSGSec 
                            ? "Confirm arrival of physical folders at the Solicitor General's office." 
                            : "Awaiting physical receipt confirmation from the assigned practitioners."
                        }
                    </DialogDescription>
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
                                    {!isSGSec && (
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-8 bg-background shrink-0 w-full sm:w-auto gap-2" 
                                            onClick={() => handleNotifyBatch(destination, files)}
                                        >
                                            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                                            {files.some(f => f.latestMovement.notifiedByPhone) ? 'Remind' : 'Notify'}
                                        </Button>
                                    )}
                                </div>
                                <div className="rounded-md border overflow-hidden">
                                    <div className="w-full overflow-x-auto">
                                        <Table className="min-w-[600px]">
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="w-[120px]">File No.</TableHead>
                                                    <TableHead>Subject</TableHead>
                                                    <TableHead className="w-[150px]">Date Moved</TableHead>
                                                    <TableHead className="text-right w-[150px]">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {files.map((file) => {
                                                    const moveDate = toDate(file.latestMovement.date);
                                                    return (
                                                    <TableRow key={file.id}>
                                                        <TableCell className="font-medium whitespace-nowrap">*{file.fileNumber}*</TableCell>
                                                        <TableCell className="max-w-0">
                                                            <p className="truncate text-sm" title={file.subject}>{file.subject}</p>
                                                        </TableCell>
                                                        <TableCell className="text-sm whitespace-nowrap">
                                                            {moveDate ? format(moveDate, 'MMM d, p') : 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {isSGSec ? (
                                                                <Button 
                                                                    size="sm" 
                                                                    className="bg-green-600 hover:bg-green-700 h-8 gap-1.5" 
                                                                    onClick={() => handleSecretariatConfirm(file)}
                                                                    disabled={isConfirming}
                                                                >
                                                                    {isConfirming ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                                                    Confirm Arrival
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" variant="ghost" className="h-8 hover:bg-green-50 hover:text-green-700 gap-1.5" onClick={() => handleNotifyAttorney(file)}>
                                                                    <Send className="h-3 w-3" />
                                                                    {file.latestMovement.notifiedByPhone ? 'Remind' : 'Notify'}
                                                                </Button>
                                                            )}
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
                            <h3 className="text-lg font-medium">{isSGSec ? "No Files Awaiting SG Arrival" : "No Files in Transit"}</h3>
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
