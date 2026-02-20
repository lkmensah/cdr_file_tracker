
'use client';

import * as React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePortal } from '@/components/portal-provider';
import { useCollection, useFirestore, useMemoFirebase, useFirebase } from '@/firebase';
import type { CorrespondenceFile, Attorney, CaseReminder, Reminder } from '@/lib/types';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
    LogOut, 
    Folder, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    ChevronRight, 
    Search, 
    Briefcase, 
    UserCheck, 
    Calendar as CalendarIcon, 
    List, 
    ChevronLeft, 
    ChevronRight as ChevronRightIcon,
    Plus,
    Loader2,
    Pin,
    Star,
    Bell,
    MessageSquare,
    FileText,
    Pencil,
    Truck,
    Archive,
    ShieldCheck,
    Activity,
    Flag,
    Zap,
    ThumbsUp,
    Scale,
    Crown,
    LayoutDashboard,
    History,
    Users,
    FileDown,
    Filter,
    HandIcon,
    ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { 
    format, 
    isToday, 
    isPast, 
    isAfter, 
    subHours, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths,
    formatDistanceToNow,
    differenceInDays
} from 'date-fns';
import { toggleReminder, addCaseReminder, toggleFilePin, addGeneralReminder, toggleGeneralReminder, markAllFilesAsViewed } from '@/app/actions';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { useAuthAction } from '@/hooks/use-auth-action';
import { Progress } from '@/components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { playNotificationSound } from '@/lib/audio';

const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'judgment-debt', label: 'Judgment Debt' },
    { value: 'civil cases (local)', label: 'Civil Cases (Local)' },
    { value: 'civil cases (int\'l)', label: 'Civil Cases (Int\'l)' },
    { value: 'civil cases (regions)', label: 'Civil Cases (Regions)' },
    { value: 'garnishee', label: 'Garnishee' },
    { value: 'notice of intention', label: 'Notice of Intention' },
    { value: 'petition', label: 'Petition' },
    { value: 'mou', label: 'MOU' },
    { value: 'contract/agreement', label: 'Contract/Agreement' },
    { value: 'legal advice/opinion', label: 'Legal Advice/Opinion' },
    { value: 'arbitration (int\'l)', label: 'Arbitration (Int\'l)' },
    { value: 'arbitration (local)', label: 'Arbitration (Local)' },
    { value: 'international organisations/associations', label: 'International Organisations/Associations' },
    { value: 'miscellaneous', label: 'Miscellaneous' },
];

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); 
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
}

const STAGNATION_THRESHOLD_DAYS = 14;
const OVERLOAD_THRESHOLD = 10;
const PAGE_SIZE = 24; // Multiples of 3 work best for the grid

const workloadChartConfig = {
  active: {
    label: "Active Cases",
    color: "hsl(var(--chart-1))",
  },
  completed: {
    label: "Resolved",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export default function PortalDashboard() {
    const { attorney, logout, isSG, isActingSG } = usePortal();
    const { user } = useFirebase();
    const { toast } = useToast();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [viewMode, setViewMode] = React.useState<'list' | 'calendar' | 'monitoring'>('list');
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [currentPage, setCurrentPage] = React.useState(1);
    const [isReporting, setIsReporting] = React.useState(false);
    const [reportCategory, setReportCategory] = React.useState('all');

    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [reminderFileNumber, setReminderFileNumber] = React.useState('');
    const [reminderText, setReminderText] = React.useState('');
    const [reminderTime, setReminderTime] = React.useState('09:00');
    const [selectedDateForReminder, setSelectedDateForReminder] = React.useState<Date | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Audio Alert Tracker
    const [lastNotifiedId, setLastNotificationId] = React.useState<string | null>(null);

    const { exec: authTogglePin } = useAuthAction(toggleFilePin);
    const { exec: authToggleReminder } = useAuthAction(toggleReminder);
    const { exec: authAddReminder } = useAuthAction(addCaseReminder);
    const { exec: authAddGeneralReminder } = useAuthAction(addGeneralReminder);
    const { exec: authToggleGeneralReminder } = useAuthAction(toggleGeneralReminder);
    const { exec: authClearAllViewed, isLoading: isClearing } = useAuthAction(markAllFilesAsViewed);

    const filesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'files'), orderBy('dateCreated', 'desc'));
    }, [firestore]);

    const remindersQuery = useMemoFirebase(() => {
        if (!firestore || !attorney) return null;
        return query(collection(firestore, 'reminders'), where('attorneyId', '==', attorney.id), where('isCompleted', '==', false));
    }, [firestore, attorney]);

    const { data: allFiles, isLoading } = useCollection<CorrespondenceFile>(filesQuery);
    const { data: personalReminders } = useCollection<Reminder>(remindersQuery);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const caseloads = React.useMemo(() => {
        if (!allFiles || !attorney) return { primary: [], collaborative: [], action: [], pinned: [], oversight: [], completed: [], historical: [], all: [] };
        
        const term = searchTerm.toLowerCase();
        const primary: CorrespondenceFile[] = [];
        const collaborative: CorrespondenceFile[] = [];
        const action: CorrespondenceFile[] = [];
        const pinned: CorrespondenceFile[] = [];
        const oversight: CorrespondenceFile[] = [];
        const completed: CorrespondenceFile[] = [];
        const historical: CorrespondenceFile[] = [];
        const all: CorrespondenceFile[] = [];

        const myName = attorney.fullName.toLowerCase().trim();
        const myGroup = attorney.group?.toLowerCase().trim();

        allFiles.forEach(file => {
            const isMatch = !searchTerm.trim() || 
                file.fileNumber.toLowerCase().includes(term) ||
                file.subject.toLowerCase().includes(term) ||
                file.category.toLowerCase().includes(term) ||
                file.assignedTo?.toLowerCase().includes(term) ||
                file.coAssignees?.some(name => name.toLowerCase().includes(term));

            if (!isMatch) return;

            if (isSG) {
                all.push(file);
                if (file.status === 'Completed') completed.push(file);
            }

            const isLead = file.assignedTo?.toLowerCase().trim() === myName;
            const isCoAssignee = file.coAssignees?.some(name => name.toLowerCase().trim() === myName);
            const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
            const latestMovement = movements[0];
            const isAtMyDesk = latestMovement?.movedTo?.toLowerCase().trim() === myName;
            
            const fileGroup = (file.group || 'no group yet').toLowerCase().trim();
            const isInMyGroup = (attorney.isGroupHead || attorney.isActingGroupHead) && !!myGroup && myGroup !== 'no group yet' && fileGroup === myGroup;

            const isPinned = file.pinnedBy?.[attorney.id] === true;
            const wasPreviouslyInvolved = file.movements?.some(m => m.movedTo?.toLowerCase().trim() === myName);

            if (isLead || isCoAssignee || isAtMyDesk || isInMyGroup || isPinned) {
                if (file.status === 'Completed') {
                    completed.push(file);
                } else if (isPinned) {
                    pinned.push(file);
                } else if (isLead) {
                    primary.push(file);
                } else if (isCoAssignee) {
                    collaborative.push(file);
                } else if (isAtMyDesk) {
                    action.push(file);
                } else if (isInMyGroup) {
                    oversight.push(file);
                }
            } else if (wasPreviouslyInvolved) {
                historical.push(file);
            }
        });

        return { primary, collaborative, action, pinned, oversight, completed, historical, all };
    }, [allFiles, attorney, searchTerm, isSG]);

    const paginatedAllFiles = React.useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return caseloads.all.slice(start, start + PAGE_SIZE);
    }, [caseloads.all, currentPage]);

    const totalPages = Math.ceil(caseloads.all.length / PAGE_SIZE);

    const stagnantOversightFiles = React.useMemo(() => {
        const sourceList = isSG ? caseloads.all : caseloads.oversight;
        return sourceList.filter(file => {
            if (file.status === 'Completed') return false;
            const lastAct = toDate(file.lastActivityAt || file.reportableDate || file.dateCreated);
            const daysSince = lastAct ? differenceInDays(new Date(), lastAct) : 0;
            return daysSince >= STAGNATION_THRESHOLD_DAYS;
        });
    }, [caseloads.oversight, caseloads.all, isSG]);

    const executiveWorkloadAnalytics = React.useMemo(() => {
        if (!isSG || !allFiles) return { chartData: [], workload: {} };
        const groupWorkload: Record<string, { active: number; completed: number }> = {};
        allFiles.forEach(file => {
            const groupName = file.group || 'no group yet';
            if (!groupWorkload[groupName]) groupWorkload[groupName] = { active: 0, completed: 0 };
            if (file.status === 'Completed') groupWorkload[groupName].completed++;
            else groupWorkload[groupName].active++;
        });
        const chartData = Object.entries(groupWorkload)
            .map(([name, data]) => ({
                name,
                active: data.active,
                completed: data.completed,
                total: data.active + data.completed
            }))
            .sort((a, b) => b.active - a.active);
        return { chartData, groupWorkload };
    }, [isSG, allFiles]);

    const groupWorkloadAnalytics = React.useMemo(() => {
        if (isSG) return { chartData: [], workload: {} };
        if (!caseloads.oversight && !caseloads.completed) return { chartData: [], summary: [] };
        const workload: Record<string, { active: number; completed: number }> = {};
        [...caseloads.oversight, ...caseloads.completed].forEach(file => {
            const names = [file.assignedTo, ...(file.coAssignees || [])].filter(Boolean) as string[];
            names.forEach(name => {
                if (!workload[name]) workload[name] = { active: 0, completed: 0 };
                if (file.status === 'Completed') workload[name].completed++;
                else workload[name].active++;
            });
        });
        const chartData = Object.entries(workload)
            .map(([name, data]) => ({
                name,
                active: data.active,
                completed: data.completed,
                total: data.active + data.completed
            }))
            .sort((a, b) => b.active - a.active);
        return { chartData, workload };
    }, [caseloads.oversight, caseloads.completed, isSG]);

    const myRelatedFiles = React.useMemo(() => {
        if (!allFiles || !attorney) return [];
        if (isSG) return allFiles;
        
        const myName = attorney.fullName.toLowerCase().trim();
        const myGroup = attorney.group?.toLowerCase().trim();
        const unique = new Map<string, CorrespondenceFile>();
        
        allFiles.forEach(file => {
            const isLead = file.assignedTo?.toLowerCase().trim() === myName;
            const isCoAssignee = file.coAssignees?.some(name => name.toLowerCase().trim() === myName);
            const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
            const latestMovement = movements[0];
            const isAtMyDesk = latestMovement?.movedTo?.toLowerCase().trim() === myName;
            const fileGroup = (file.group || 'no group yet').toLowerCase().trim();
            const isInMyGroup = (attorney.isGroupHead || attorney.isActingGroupHead) && !!myGroup && myGroup !== 'no group yet' && fileGroup === myGroup;
            const isPinned = file.pinnedBy?.[attorney.id] === true;
            const isHistorical = file.movements?.some(m => m.movedTo?.toLowerCase().trim() === myName);
            
            if (isLead || isCoAssignee || isAtMyDesk || isInMyGroup || isPinned || isHistorical) {
                unique.set(file.id, file);
            }
        });
        
        return Array.from(unique.values());
    }, [allFiles, attorney, isSG]);

    const notifications = React.useMemo(() => {
        if (!myRelatedFiles || !attorney) return [];
        const notes: { id: string; fileId: string; fileNumber: string; message: string; timestamp: Date; type: 'communication' | 'folio' | 'draft' | 'movement' }[] = [];
        const now = new Date();
        const last24h = subHours(now, 24);
        const myName = attorney.fullName.toLowerCase().trim();
        
        myRelatedFiles.forEach(file => {
            const lastViewedAt = toDate(file.viewedBy?.[attorney.id]);
            const referencePoint = lastViewedAt || last24h;
            
            (file.internalInstructions || []).forEach(i => {
                const d = toDate(i.date);
                // Notification Policy: Must be AFTER last view, NOT in the future, and NOT from self.
                if (d && isAfter(d, referencePoint) && !isAfter(d, now) && i.from.toLowerCase().trim() !== myName) {
                    notes.push({ id: i.id, fileId: file.id, fileNumber: file.fileNumber, message: `New message from ${i.from}`, timestamp: d, type: 'communication' });
                }
            });
            
            (file.letters || []).forEach(l => {
                const d = toDate(l.date);
                if (d && isAfter(d, referencePoint) && !isAfter(d, now)) {
                    notes.push({ id: l.id, fileId: file.id, fileNumber: file.fileNumber, message: `New Folio: ${l.subject}`, timestamp: d, type: 'folio' });
                }
            });
            
            const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
            const latest = movements[0];
            if (latest) {
                const d = toDate(latest.date);
                if (d && isAfter(d, referencePoint) && !isAfter(d, now)) {
                    if (isSG || (latest.movedTo.toLowerCase().trim() === myName && latest.receivedBy?.toLowerCase().trim() !== myName)) {
                        notes.push({ id: latest.id, fileId: file.id, fileNumber: file.fileNumber, message: isSG ? `File moved to ${latest.movedTo}` : `File moved to your desk`, timestamp: d, type: 'movement' });
                    }
                }
            }
        });
        
        return notes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 30);
    }, [myRelatedFiles, attorney, isSG]);

    // Audible Alert Hook
    React.useEffect(() => {
        const newestNote = notifications[0];
        if (newestNote) {
            // If we have a truly new notification (not the one we tracked last)
            // and we've already initialized the tracker (to avoid beep on first load)
            if (lastNotifiedId !== null && newestNote.id !== lastNotifiedId) {
                playNotificationSound();
            }
            setLastNotificationId(newestNote.id);
        } else if (notifications.length === 0) {
            // Ensure clear actions correctly reset the tracking anchor
            setLastNotificationId("");
        }
    }, [notifications, lastNotifiedId]);

    const handleClearAllNotifications = async () => {
        if (!attorney || myRelatedFiles.length === 0) return;
        const fileIds = myRelatedFiles.map(f => f.id);
        const result = await authClearAllViewed(fileIds, attorney.id);
        if (result.success) {
            toast({ title: 'Notifications Cleared', description: 'All current activities marked as read.' });
        }
    };

    const availableFiles = React.useMemo(() => {
        if (isSG) return allFiles?.filter(f => f.status !== 'Completed') || [];
        return [...caseloads.pinned, ...caseloads.primary, ...caseloads.collaborative, ...caseloads.action];
    }, [caseloads, allFiles, isSG]);

    const fileOptions = React.useMemo(() => {
        const options = [{ label: "-- General Activity (No File) --", value: "general" }];
        availableFiles.forEach(file => {
            options.push({ label: `${file.fileNumber} - ${file.subject}`, value: file.fileNumber });
        });
        return options;
    }, [availableFiles]);

    const calendarEvents = React.useMemo(() => {
        if (!allFiles || !attorney) return [];
        const myName = attorney.fullName.toLowerCase().trim();
        const myGroup = (attorney.group || 'no group yet').toLowerCase().trim();
        const myFiles = allFiles.filter(file => {
            if (isSG) return true;
            const isLead = file.assignedTo?.toLowerCase().trim() === myName;
            const isCoAssignee = file.coAssignees?.some(name => name.toLowerCase().trim() === myName);
            const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
            const latestMovement = movements[0];
            const isAtMyDesk = latestMovement?.movedTo?.toLowerCase().trim() === myName;
            const fileGroup = (file.group || 'no group yet').toLowerCase().trim();
            const isInMyGroup = (attorney.isGroupHead || attorney.isActingGroupHead) && !!myGroup && myGroup !== 'no group yet' && fileGroup === myGroup;
            const isPinned = file.pinnedBy?.[attorney.id] === true;
            return (isLead || isCoAssignee || isAtMyDesk || isInMyGroup || isPinned);
        });
        const events: { id: string; date: Date; text: string; type: 'deadline' | 'court'; fileNumber: string; fileId: string; isCompleted?: boolean; isGeneral?: boolean }[] = [];
        myFiles.forEach(f => {
            (f.reminders || []).forEach(r => {
                const reminderDate = toDate(r.date);
                if (reminderDate) events.push({ id: r.id, date: reminderDate, text: r.text, type: 'deadline', fileNumber: f.fileNumber, fileId: f.id, isCompleted: r.isCompleted, isGeneral: false });
            });
            (f.letters || []).filter(l => l.type === 'Court Process' && l.hearingDate).forEach(l => {
                const hearingDate = toDate(l.hearingDate);
                if (hearingDate) events.push({ id: l.id, date: hearingDate, text: `HEARING: ${l.subject}`, type: 'court', fileNumber: f.fileNumber, fileId: f.id, isGeneral: false });
            });
        });
        (personalReminders || []).forEach(r => {
            const d = toDate(r.date);
            if (d) events.push({ id: r.id, date: d, text: r.text, type: 'deadline', fileNumber: 'General', fileId: '', isCompleted: r.isCompleted, isGeneral: true });
        });
        return events.filter(e => !e.isCompleted).sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [allFiles, attorney, personalReminders, isSG]);

    const activeReminders = React.useMemo(() => calendarEvents.filter(e => e.type === 'deadline'), [calendarEvents]);

    const handleToggleReminder = async (fileNumber: string, id: string, isGeneral?: boolean) => {
        if (isGeneral || fileNumber === 'General') {
            await authToggleGeneralReminder(id);
            toast({ title: 'Personal Reminder Completed' });
        } else {
            await authToggleReminder(fileNumber, id);
            toast({ title: 'Case Reminder Completed' });
        }
    };

    const handleTogglePin = async (e: React.MouseEvent, fileId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (attorney) await authTogglePin(fileId, attorney.id);
    }

    const handleOpenCreateDialog = (date: Date = new Date()) => {
        setSelectedDateForReminder(date);
        setIsCreateDialogOpen(true);
    };

    const handleCreateReminder = async () => {
        if (!reminderFileNumber || !reminderText || !selectedDateForReminder || !attorney) return;
        setIsSubmitting(true);
        const combinedDate = new Date(selectedDateForReminder);
        const [hours, minutes] = reminderTime.split(':').map(Number);
        combinedDate.setHours(hours, minutes);
        let result;
        if (reminderFileNumber === 'general') {
            result = await authAddGeneralReminder({ text: reminderText, date: combinedDate.toISOString(), attorneyId: attorney.id, attorneyName: attorney.fullName });
        } else {
            result = await authAddReminder(reminderFileNumber, { text: reminderText, date: combinedDate.toISOString() });
        }
        if (result.success) {
            toast({ title: 'Reminder Created' });
            setIsCreateDialogOpen(false);
            setReminderText('');
            setReminderFileNumber('');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setIsSubmitting(false);
    };

    const handleGenerateStatusReport = () => {
        if (!attorney || !allFiles) return;
        setIsReporting(true);
        try {
            const doc = new jsPDF();
            const now = new Date();
            const myName = attorney.fullName;
            
            doc.setFontSize(18);
            doc.text(isSG ? 'Master Registry Status Report' : 'Practitioner Status Report', 14, 22);
            doc.setFontSize(10);
            doc.text(`Generated By: ${myName}`, 14, 30);
            doc.text(`Rank: ${attorney.rank || 'Practitioner'}`, 14, 35);
            doc.text(`Group: ${attorney.group || 'no group yet'}`, 14, 40);
            doc.text(`Date: ${format(now, 'PPP')}`, 14, 45);
            
            if (isSG && reportCategory !== 'all') {
                doc.text(`Category Filter: ${categories.find(c => c.value === reportCategory)?.label || reportCategory}`, 14, 50);
            }

            let reportFiles = isSG ? caseloads.all : caseloads.primary;
            
            if (isSG && reportCategory !== 'all') {
                if (reportCategory === 'judgment-debt') {
                    reportFiles = reportFiles.filter(f => f.isJudgmentDebt === true);
                } else {
                    reportFiles = reportFiles.filter(f => f.category?.toLowerCase() === reportCategory.toLowerCase());
                }
            }

            const activeCount = reportFiles.filter(f => f.status !== 'Completed').length;
            const completedCount = reportFiles.filter(f => f.status === 'Completed').length;
            
            doc.setFontSize(12);
            doc.text('Caseload Summary', 14, 60);
            autoTable(doc, {
                head: [['Total Files', 'Active', 'Completed']],
                body: [[reportFiles.length, activeCount, completedCount]],
                startY: 65,
                theme: 'grid',
                headStyles: { fillColor: [84, 101, 55] },
            });

            const groupedFiles: Record<string, CorrespondenceFile[]> = {};
            reportFiles.forEach(file => {
                const groupName = file.group || 'no group yet';
                if (!groupedFiles[groupName]) groupedFiles[groupName] = [];
                groupedFiles[groupName].push(file);
            });

            let finalY = (doc as any).lastAutoTable.finalY + 15;

            Object.entries(groupedFiles).sort().forEach(([groupName, files]) => {
                if (finalY > 250) { doc.addPage(); finalY = 20; }
                doc.setFontSize(11);
                doc.setTextColor(84, 101, 55);
                doc.text(`Department: ${groupName.toUpperCase()} (${files.length} Files)`, 14, finalY);
                doc.setTextColor(0, 0, 0);

                const tableData = files.map(file => {
                    const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
                    const latest = movements[0];
                    const isAtMyDesk = latest?.movedTo?.toLowerCase().trim() === myName.toLowerCase().trim();
                    const level = isAtMyDesk ? 'AT MY DESK' : (latest?.movedTo || 'REGISTRY');
                    const completedM = (file.milestones || []).filter(m => m.isCompleted).length;
                    const totalM = (file.milestones || []).length;
                    const currentM = (file.milestones || []).find(m => !m.isCompleted)?.title || 'Execution';
                    const stage = `${currentM} (${completedM}/${totalM})`;
                    const status = file.status === 'Completed' ? 'RESOLVED' : 'ACTIVE';
                    const statusDesc = latest?.status || 'Assigned';
                    return [file.fileNumber, file.subject, stage, level, `${status}\n(${statusDesc})` ];
                });

                autoTable(doc, {
                    head: [['File No.', 'Subject/Topic', 'Stage (Milestones)', 'Level (Possession)', 'Overall Status']],
                    body: tableData,
                    startY: finalY + 5,
                    theme: 'grid',
                    headStyles: { fillColor: [100, 100, 100] },
                    styles: { fontSize: 8, cellPadding: 3 },
                    columnStyles: { 1: { cellWidth: 60 }, 4: { cellWidth: 30 } }
                });

                finalY = (doc as any).lastAutoTable.finalY + 15;
            });

            doc.save(`${isSG ? 'Master' : 'Practitioner'}_Status_Report_${format(now, 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'Status Report Generated', description: 'Your report has been exported to PDF.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not generate status report.' });
        } finally {
            setIsReporting(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading workspace...</div>;
    if (!attorney) return null;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const FileCard = ({ file, type }: { file: CorrespondenceFile, type: 'pinned' | 'primary' | 'collaborative' | 'action' | 'oversight' | 'completed' | 'historical' | 'all' }) => {
        const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
        const latestMovement = movements[0];
        const isWithMe = latestMovement?.movedTo?.toLowerCase().trim() === attorney.fullName.toLowerCase().trim();
        const isLead = file.assignedTo?.toLowerCase().trim() === attorney.fullName.toLowerCase().trim();
        const isTeam = file.coAssignees?.some(name => name.toLowerCase().trim() === attorney.fullName.toLowerCase().trim());
        
        const activityTime = toDate(file.lastActivityAt || file.reportableDate || file.dateCreated);
        const lastViewedAt = toDate(file.viewedBy?.[attorney.id]);
        const isRecentlyUpdated = activityTime && isAfter(activityTime, subHours(new Date(), 24)) && (!lastViewedAt || isAfter(activityTime, lastViewedAt));
        const isCompleted = file.status === 'Completed';

        return (
            <Link href={`/portal/file/${file.id}`} className="block h-full group relative">
                <Card className={cn("h-full hover:border-primary transition-all duration-300 shadow-sm border-l-4 overflow-hidden flex flex-col group-hover:shadow-md", 
                    isCompleted ? "border-l-green-500 bg-green-50/5 opacity-90" : 
                    type === 'pinned' ? "border-l-yellow-500 bg-yellow-50/10" : 
                    type === 'primary' ? "border-l-primary" : 
                    type === 'collaborative' ? "border-l-teal-500 bg-teal-50/5" :
                    type === 'oversight' ? "border-l-purple-500 bg-purple-50/5" :
                    type === 'historical' ? "border-l-muted-foreground/30 grayscale-[0.5] opacity-80" :
                    "border-l-blue-500")}>
                    <CardContent className="p-5 flex flex-col flex-1 gap-4 min-w-0">
                        <div className="space-y-3 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className={cn("font-mono text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded bg-muted/50", 
                                        isCompleted ? "text-green-600" :
                                        type === 'pinned' ? "text-yellow-600" : 
                                        type === 'primary' ? "text-primary" : 
                                        type === 'collaborative' ? "text-teal-600" :
                                        type === 'oversight' ? "text-purple-600" :
                                        type === 'historical' ? "text-muted-foreground" :
                                        "text-blue-600" )}>{file.fileNumber}</span>
                                    {isRecentlyUpdated && !isCompleted && type !== 'historical' && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                                            <span className="text-[8px] font-black uppercase text-red-600 tracking-tight">New</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    {isCompleted ? (
                                        <Badge variant="secondary" className="text-[8px] uppercase h-4 bg-green-100 text-green-800 border-green-200">Resolved</Badge>
                                    ) : isSG ? (
                                        <Badge variant="outline" className="text-[8px] uppercase h-4 border-yellow-500 text-yellow-700 bg-yellow-50/50">Executive</Badge>
                                    ) : isLead ? (
                                        <Badge variant="outline" className="text-[8px] uppercase h-4">Lead</Badge>
                                    ) : isTeam ? (
                                        <Badge variant="outline" className="text-[8px] uppercase h-4 border-teal-500 text-teal-700 bg-teal-50">Team</Badge>
                                    ) : type === 'oversight' ? (
                                        <Badge variant="secondary" className="text-[8px] uppercase h-4 bg-purple-100 text-purple-700 border-purple-200">Oversight</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="text-[8px] uppercase h-4 bg-blue-50 text-blue-700 border-blue-100">At Desk</Badge>
                                    )}
                                </div>
                            </div>
                            
                            <h4 className="font-bold text-sm leading-snug line-clamp-3 group-hover:text-primary transition-colors" title={file.subject}>
                                {file.subject}
                            </h4>
                        </div>

                        <div className="pt-3 border-t space-y-2">
                            <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-widest text-muted-foreground">
                                <span className="truncate max-w-[60%]">{file.category}</span>
                                <span className="shrink-0">{format(toDate(file.lastActivityAt || file.reportableDate || file.dateCreated)!, 'MMM d')}</span>
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <Badge variant="outline" className="bg-muted/30 text-[9px] h-5 py-0 border-none shrink-0">
                                        <Truck className="h-2.5 w-2.5 mr-1" /> {isWithMe ? 'At My Desk' : (latestMovement?.movedTo || 'Registry')}
                                    </Badge>
                                    {!isLead && file.assignedTo && (
                                        <span className="text-[9px] text-muted-foreground truncate italic">Lead: {file.assignedTo}</span>
                                    )}
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {!isCompleted && !isSG && type !== 'historical' && (
                    <Button variant="ghost" size="icon" className={cn("absolute top-3 right-3 h-7 w-7 transition-all rounded-full bg-background/80 backdrop-blur-sm shadow-sm border", file.pinnedBy?.[attorney.id] ? "opacity-100 text-yellow-500 scale-110" : "opacity-0 group-hover:opacity-100 scale-100")} onClick={(e) => handleTogglePin(e, file.id)}>
                        <Star className={cn("h-3.5 w-3.5", file.pinnedBy?.[attorney.id] && "fill-current")} />
                    </Button>
                )}
            </Link>
        );
    }

    const isGroupExecutive = attorney.isGroupHead || attorney.isActingGroupHead || isSG;

    return (
        <div className="min-h-screen bg-muted/20 pb-20 font-body">
            <header className="sticky top-0 z-10 bg-background border-b px-4 h-16 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", isSG ? "bg-yellow-500" : "bg-primary")}>
                        {isSG ? <Crown className="h-5 w-5 text-white" /> : <Folder className="h-5 w-5 text-primary-foreground" />}
                    </div>
                    <div className="hidden sm:block">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold leading-none">{attorney?.fullName}</h2>
                            {attorney.isSG ? (
                                <Badge className="bg-yellow-500 text-white border-yellow-600 text-[8px] h-4 uppercase font-bold px-1.5 py-0">Solicitor General</Badge>
                            ) : isActingSG ? (
                                <Badge className="bg-amber-500 text-white border-amber-600 text-[8px] h-4 uppercase font-bold px-1.5 py-0"><HandIcon className="h-3 w-3 mr-1" /> Acting SG</Badge>
                            ) : attorney.isGroupHead ? (
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] h-4 uppercase font-bold px-1.5 py-0"><ShieldCheck className="h-3 w-3 mr-1" /> Group Head</Badge>
                            ) : attorney.isActingGroupHead ? (
                                <Badge className="bg-blue-500 text-white border-blue-600 text-[8px] h-4 uppercase font-bold px-1.5 py-0"><ShieldAlert className="h-3 w-3 mr-1" /> Acting GH</Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground text-[8px] h-4 uppercase font-bold px-1.5 py-0">Practitioner</Badge>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.1em] mt-1">{attorney?.group || 'no group yet'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative h-10 w-10 hover:bg-muted/50 transition-colors">
                                <Bell className="h-5 w-5 text-muted-foreground" />
                                {notifications.length > 0 && (
                                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-background animate-in zoom-in-50">
                                        {notifications.length}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] sm:w-[450px] p-0 shadow-2xl overflow-hidden rounded-xl border-primary/10" align="end">
                            <div className="flex items-center justify-between p-4 bg-muted/30 border-b">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Bell className="h-3.5 w-3.5" /> Recent Activity
                                </h3>
                                {notifications.length > 0 && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors"
                                        onClick={handleClearAllNotifications}
                                        disabled={isClearing}
                                    >
                                        {isClearing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                        Clear All
                                    </Button>
                                )}
                            </div>
                            <ScrollArea className="max-h-[450px]">
                                {notifications.length > 0 ? (
                                    <div className="grid divide-y">
                                        {notifications.map(note => (
                                            <Link key={note.id} href={`/portal/file/${note.fileId}`} className="p-4 hover:bg-primary/5 transition-all duration-200 block group">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2.5 rounded-full bg-red-50 text-red-600 shrink-0 group-hover:scale-110 transition-transform shadow-sm border border-red-100">
                                                        {note.type === 'communication' ? <MessageSquare className="h-4 w-4" /> : note.type === 'folio' ? <FileText className="h-4 w-4" /> : note.type === 'draft' ? <Pencil className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                                                    </div>
                                                    <div className="space-y-1 min-w-0 flex-1">
                                                        <p className="text-sm font-bold leading-tight text-foreground truncate group-hover:text-primary transition-colors">{note.message}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter truncate opacity-70">
                                                            File {note.fileNumber} • {formatDistanceToNow(note.timestamp)} ago
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-16 text-center text-muted-foreground space-y-3">
                                        <div className="bg-muted/50 p-4 rounded-full w-fit mx-auto shadow-inner"><CheckCircle2 className="h-10 w-10 opacity-20" /></div>
                                        <p className="text-xs font-bold uppercase tracking-widest">No New Alerts</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>

                    <div className="flex items-center bg-muted/50 p-1.5 rounded-xl border border-primary/10 ml-2 shadow-inner">
                        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg" onClick={() => setViewMode('list')}><List className="h-4 w-4" /><span className="hidden sm:inline">Caseload</span></Button>
                        <Button variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg" onClick={() => setViewMode('calendar')}><CalendarIcon className="h-4 w-4" /><span className="hidden sm:inline">Calendar</span></Button>
                        {isGroupExecutive && (
                            <Button variant={viewMode === 'monitoring' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg" onClick={() => setViewMode('monitoring')}><Activity className="h-4 w-4" /><span className="hidden sm:inline">{isSG ? 'Oversight' : 'Monitoring'}</span></Button>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors ml-2 font-bold uppercase text-[10px] tracking-widest"><LogOut className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Logout</span></Button>
                </div>
            </header>

            <main className="max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8 xl:p-10 space-y-10 min-w-0">
                {viewMode === 'monitoring' && isGroupExecutive ? (
                    <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-background p-6 rounded-2xl border shadow-sm border-primary/10">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">{isSG ? <Crown className="h-8 w-8 text-yellow-500" /> : <ShieldCheck className="h-8 w-8 text-primary" />}{isSG ? 'Executive Oversight' : 'Group Hub'}</h2>
                                <p className="text-sm text-muted-foreground mt-1">Strategic performance monitoring for <strong>{isSG ? 'All departments' : attorney.group || 'no group yet'}</strong></p>
                            </div>
                            <div className="flex items-center gap-3">
                                {isSG && (
                                    <div className="flex items-center gap-2 mr-2">
                                        <Filter className="h-4 w-4 text-muted-foreground" />
                                        <Select value={reportCategory} onValueChange={setReportCategory}>
                                            <SelectTrigger className="h-10 w-[220px] text-xs font-bold rounded-lg border-primary/10">
                                                <SelectValue placeholder="Filter by Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => (
                                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <Button variant="outline" size="sm" className="h-10 gap-2 border-primary/20 text-primary font-bold hover:bg-primary/5 rounded-lg" onClick={handleGenerateStatusReport} disabled={isReporting}>
                                    {isReporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                    {isSG ? 'Master Status Report' : 'Group Status Report'}
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-8 grid-cols-1 xl:grid-cols-2">
                            <Card className="shadow-sm border-primary/10 rounded-2xl overflow-hidden">
                                <CardHeader className="pb-4 border-b bg-muted/10">
                                    <div className="flex items-center gap-3">
                                        <Scale className="h-6 w-6 text-primary" />
                                        <div><CardTitle className="text-base font-black uppercase tracking-tight">Workload Distribution</CardTitle><CardDescription className="text-[10px] uppercase tracking-widest font-black text-primary/60">{isSG ? 'Cross-Group Analysis' : 'Files per Practitioner'}</CardDescription></div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-8">
                                    {(isSG ? executiveWorkloadAnalytics : groupWorkloadAnalytics).chartData.length > 0 ? (
                                        <ChartContainer config={workloadChartConfig} className="min-h-[350px] w-full">
                                            <BarChart data={(isSG ? executiveWorkloadAnalytics : groupWorkloadAnalytics).chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
                                                <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} width={120} style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                                <ChartTooltip content={<ChartTooltipContent />} />
                                                <ChartLegend content={<ChartLegendContent />} />
                                                <Bar dataKey="active" stackId="a" fill="var(--color-active)" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" radius={[0, 6, 6, 0]} />
                                            </BarChart>
                                        </ChartContainer>
                                    ) : (
                                        <div className="h-[350px] flex flex-col items-center justify-center text-center space-y-3">
                                            <Folder className="h-12 w-12 text-muted-foreground/20" />
                                            <p className="text-sm text-muted-foreground italic font-medium">No departmental data recorded yet.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            <Card className="shadow-sm border-primary/10 rounded-2xl overflow-hidden">
                                <CardHeader className="pb-4 border-b bg-muted/10">
                                    <div className="flex items-center gap-3">
                                        <Users className="h-6 w-6 text-primary" />
                                        <div><CardTitle className="text-base font-black uppercase tracking-tight">{isSG ? 'Departmental Burden Rank' : 'Practitioner Burden Rank'}</CardTitle><CardDescription className="text-[10px] uppercase tracking-widest font-black text-primary/60">Active caseload comparison</CardDescription></div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[450px] overflow-y-auto scrollbar-hide">
                                        <Table>
                                            <TableHeader><TableRow className="bg-muted/30 border-b-2"><TableHead className="text-[10px] uppercase font-black tracking-widest pl-6">Entity/Practitioner</TableHead><TableHead className="text-center text-[10px] uppercase font-black tracking-widest w-[100px]">Active</TableHead><TableHead className="text-right text-[10px] uppercase font-black tracking-widest w-[120px] pr-6">Status</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {(isSG ? executiveWorkloadAnalytics : groupWorkloadAnalytics).chartData.map(row => {
                                                    const isOverloaded = row.active >= (isSG ? OVERLOAD_THRESHOLD * 5 : OVERLOAD_THRESHOLD);
                                                    return (
                                                        <TableRow key={row.name} className="hover:bg-muted/20 transition-colors">
                                                            <TableCell className="text-xs font-black uppercase tracking-tight pl-6">{row.name}</TableCell>
                                                            <TableCell className="text-center"><span className={cn("text-sm tabular-nums font-black", isOverloaded ? "text-destructive" : "text-primary")}>{row.active}</span></TableCell>
                                                            <TableCell className="text-right pr-6">{isOverloaded ? <Badge variant="destructive" className="text-[8px] font-black uppercase tracking-widest h-5 px-2 animate-pulse shadow-sm">High Burden</Badge> : row.active > 0 ? <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest h-5 px-2 bg-green-50 text-green-700 border-green-100 shadow-sm">Healthy</Badge> : <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter opacity-50">Available</span>}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="space-y-6 min-w-0">
                            <h3 className="text-sm font-black flex items-center gap-3 text-destructive uppercase tracking-[0.2em] bg-red-50 w-fit px-4 py-2 rounded-lg border border-red-100"><Zap className="h-5 w-5 animate-pulse" /> Stagnant Exception Report</h3>
                            {stagnantOversightFiles.length > 0 ? (
                                <div className="rounded-2xl border bg-background shadow-sm overflow-hidden min-w-0 border-primary/10">
                                    <div className="w-full overflow-x-auto">
                                        <Table className="min-w-[1000px]">
                                            <TableHeader><TableRow className="bg-muted/30"><TableHead className="w-[150px] pl-6 font-black uppercase text-[10px] tracking-widest">File Number</TableHead><TableHead className="font-black uppercase text-[10px] tracking-widest">Assignee & Dept</TableHead><TableHead className="font-black uppercase text-[10px] tracking-widest">Current Milestone</TableHead><TableHead className="font-black uppercase text-[10px] tracking-widest">Case Progress</TableHead><TableHead className="font-black uppercase text-[10px] tracking-widest">Last Activity</TableHead><TableHead className="text-right pr-6 font-black uppercase text-[10px] tracking-widest">Action</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {stagnantOversightFiles.map(file => {
                                                    const completedCount = (file.milestones || []).filter(m => m.isCompleted).length;
                                                    const totalCount = (file.milestones || []).length;
                                                    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                                                    const lastAct = toDate(file.lastActivityAt || file.reportableDate || file.dateCreated);
                                                    const daysSince = lastAct ? differenceInDays(new Date(), lastAct) : 0;
                                                    return (
                                                        <TableRow key={file.id} className="bg-red-50/10 hover:bg-red-50/30 transition-colors border-b border-red-100/50">
                                                            <TableCell className="pl-6"><span className="font-mono text-xs font-black text-primary px-2 py-1 rounded bg-muted/50">{file.fileNumber}</span></TableCell>
                                                            <TableCell><div className="flex flex-col max-w-[250px]"><span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter truncate opacity-70">{file.group || 'no group yet'}</span><span className="text-sm font-bold text-foreground truncate">{file.assignedTo || 'Unassigned'}</span></div></TableCell>
                                                            <TableCell><div className="flex items-center gap-2 max-w-[180px]"><Flag className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-black uppercase tracking-tighter truncate">{(file.milestones || []).find(m => !m.isCompleted)?.title || "Execution"}</span></div></TableCell>
                                                            <TableCell className="w-[220px]"><div className="space-y-1.5"><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest tabular-nums text-primary/70"><span>{completedCount}/{totalCount}</span><span>{Math.round(progress)}%</span></div><Progress value={progress} className="h-2 rounded-full shadow-inner" /></div></TableCell>
                                                            <TableCell><Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 animate-pulse gap-1.5 px-2 py-1 font-black uppercase text-[9px] tracking-widest shadow-sm"><Zap className="h-3 w-3" /> {daysSince} Days Idle</Badge></TableCell>
                                                            <TableCell className="text-right pr-6"><Button variant="ghost" size="sm" asChild className="hover:bg-red-100 rounded-lg text-xs font-black uppercase tracking-widest"><Link href={`/portal/file/${file.id}`}>Review Case</Link></Button></TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed rounded-3xl bg-background shadow-inner text-center space-y-6 border-green-100"><div className="bg-green-50 p-6 rounded-full border border-green-100 shadow-sm"><ThumbsUp className="h-12 w-12 text-green-600" /></div><div className="space-y-2"><h4 className="text-2xl font-black text-green-800 uppercase tracking-tight">System Status: Active</h4><p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">Excellent work! Every file within oversight has been updated within the last 14 days.</p></div></div>
                            )}
                        </div>
                    </section>
                ) : viewMode === 'list' ? (
                    <>
                        <div className="relative w-full max-w-4xl mx-auto px-4">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/50" />
                            <Input placeholder={isSG ? "Search master file registry..." : "Search your assigned caseload by file, subject, or colleague..."} className="pl-16 h-16 text-xl shadow-lg bg-background border-primary/10 w-full rounded-2xl focus-visible:ring-primary/20 transition-shadow" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        {!searchTerm && (
                            <div className="grid gap-10">
                                {activeReminders.length > 0 && (
                                    <section className="space-y-5 min-w-0">
                                        <h3 className="text-[10px] font-black flex items-center gap-3 text-primary uppercase tracking-[0.2em] bg-primary/5 w-fit px-4 py-2 rounded-lg border border-primary/10">
                                            <Clock className="h-4 w-4" /> Upcoming Deadlines
                                        </h3>
                                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {activeReminders.map(reminder => {
                                                const isOverdue = isPast(reminder.date) && !isToday(reminder.date);
                                                return (
                                                    <Card key={reminder.id} className={cn(
                                                        "border-l-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer rounded-xl group",
                                                        isOverdue ? "border-l-destructive bg-destructive/5" : "border-l-primary bg-primary/5"
                                                    )} onClick={() => reminder.fileId && (window.location.href = `/portal/file/${reminder.fileId}`)}>
                                                        <CardContent className="p-4 flex items-start justify-between gap-4">
                                                            <div className="min-w-0 flex-1 space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    {isOverdue && <Badge variant="destructive" className="h-4 text-[8px] font-black uppercase px-1.5 tracking-widest animate-pulse">Overdue</Badge>}
                                                                    <span className={cn("text-[9px] font-black font-mono uppercase tracking-widest", reminder.fileNumber === 'General' ? "text-purple-600" : "text-primary/70")}>
                                                                        {reminder.fileNumber === 'General' ? 'Personal' : `File ${reminder.fileNumber}`}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm font-bold truncate leading-snug group-hover:text-primary transition-colors">{reminder.text}</p>
                                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-70">
                                                                    Due: {format(reminder.date, 'MMM d, p')}
                                                                </p>
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-9 w-9 shrink-0 rounded-full hover:bg-green-100 hover:text-green-700 transition-colors"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleToggleReminder(reminder.fileNumber, reminder.id, reminder.isGeneral);
                                                                }}
                                                            >
                                                                <CheckCircle2 className="h-5 w-5" />
                                                            </Button>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}

                        <div className="space-y-12 min-w-0">
                            {isSG ? (
                                <section className="space-y-6 min-w-0"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4"><h3 className="text-sm font-black flex items-center gap-3 text-yellow-600 uppercase tracking-[0.2em]"><LayoutDashboard className="h-5 w-5" /> Master Registry Cluster</h3><Badge variant="outline" className={cn("text-[10px] h-6 px-3 border-yellow-500 text-yellow-700 bg-yellow-50 uppercase font-black tracking-widest rounded-full shadow-sm", isActingSG && "border-amber-500 text-amber-700 bg-amber-50")}>{isActingSG ? 'Acting SG Oversight Active' : 'Registry Leadership View'}</Badge></div><div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-w-0">{paginatedAllFiles.map(file => <FileCard key={file.id} file={file} type="all" />)}</div>{totalPages > 1 && (<div className="flex flex-col sm:flex-row items-center justify-between border-t pt-8 gap-6"><p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Showing <span className="font-black text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span> to <span className="font-black text-foreground">{Math.min(currentPage * PAGE_SIZE, caseloads.all.length)}</span> of <span className="font-black text-foreground">{caseloads.all.length}</span> records</p><div className="flex items-center gap-3"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest"><ChevronLeft className="h-4 w-4 mr-2" />Prev</Button><div className="text-[10px] font-black px-4 py-2 bg-muted rounded-xl border tracking-widest">Page {currentPage} of {totalPages}</div><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest">Next<ChevronRightIcon className="h-4 w-4 ml-2" /></Button></div></div>)}</section>
                            ) : (
                                <div className="space-y-12 min-w-0">
                                    {caseloads.pinned.length > 0 && <section className="space-y-6"><h3 className="text-xs font-black flex items-center gap-3 text-yellow-600 uppercase tracking-[0.2em] bg-yellow-50 w-fit px-4 py-2 rounded-lg border border-yellow-100"><Star className="h-5 w-5 fill-current" /> High Priority Cluster</h3><div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{caseloads.pinned.map(file => <FileCard key={file.id} file={file} type="pinned" />)}</div></section>}
                                    {caseloads.primary.length > 0 && <section className="space-y-6"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4"><h3 className="text-xs font-black flex items-center gap-3 text-primary uppercase tracking-[0.2em]"><Briefcase className="h-5 w-5" /> Primary Caseload</h3><Button variant="outline" size="sm" className="h-9 gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-lg font-bold text-[10px] uppercase tracking-widest" onClick={handleGenerateStatusReport} disabled={isReporting}>{isReporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}Download Progress Report</Button></div><div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{caseloads.primary.map(file => <FileCard key={file.id} file={file} type="primary" />)}</div></section>}
                                    {caseloads.collaborative.length > 0 && <section className="space-y-6"><h3 className="text-xs font-black flex items-center gap-3 text-teal-600 uppercase tracking-[0.2em] border-b pb-4"><Users className="h-5 w-5" /> Team Assignments</h3><div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{caseloads.collaborative.map(file => <FileCard key={file.id} file={file} type="collaborative" />)}</div></section>}
                                    {caseloads.action.length > 0 && <section className="space-y-6"><h3 className="text-xs font-black flex items-center gap-3 text-blue-600 uppercase tracking-[0.2em] border-b pb-4"><UserCheck className="h-5 w-5" /> Possession Queue</h3><div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{caseloads.action.map(file => <FileCard key={file.id} file={file} type="action" />)}</div></section>}
                                    {caseloads.oversight.length > 0 && <section className="space-y-6"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4"><h3 className="text-xs font-black flex items-center gap-3 text-purple-600 uppercase tracking-[0.2em]"><ShieldCheck className="h-5 w-5" /> Group Oversight Hub</h3>{attorney.isActingGroupHead ? <Badge className="bg-blue-500 text-white text-[9px] uppercase font-black tracking-widest px-3 h-6 rounded-full shadow-sm">Acting Group Head View</Badge> : <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[9px] uppercase font-black tracking-widest px-3 h-6 rounded-full shadow-sm border-purple-200">Group Head Dashboard</Badge>}</div><div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{caseloads.oversight.map(file => <FileCard key={file.id} file={file} type="oversight" />)}</div></section>}
                                    {caseloads.historical.length > 0 && <section className="space-y-6 pt-6"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4"><h3 className="text-xs font-black flex items-center gap-3 text-muted-foreground uppercase tracking-[0.2em]"><History className="h-5 w-5" /> Historical Insight</h3><Badge variant="secondary" className="bg-muted text-muted-foreground text-[9px] uppercase font-black tracking-widest px-3 h-6 rounded-full border-none opacity-70">Read-Only Archive</Badge></div><div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{caseloads.historical.map(file => <FileCard key={file.id} file={file} type="historical" />)}</div></section>}
                                </div>
                            )}
                            {(caseloads.completed.length > 0 && !isSG) && <section className="space-y-6 pt-12 border-t"><h3 className="text-xs font-black flex items-center gap-3 text-green-600 uppercase tracking-[0.2em] border-b pb-4"><Archive className="h-5 w-5" /> Resolved Cases</h3><div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{caseloads.completed.map(file => <FileCard key={file.id} file={file} type="completed" />)}</div></section>}
                            {availableFiles.length === 0 && caseloads.completed.length === 0 && caseloads.historical.length === 0 && <div className="text-center py-32 border-2 border-dashed rounded-3xl bg-background shadow-inner px-6"><div className="bg-muted/50 p-6 rounded-full w-fit mx-auto shadow-inner mb-6"><AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" /></div><h4 className="text-2xl font-black text-muted-foreground uppercase tracking-tight">{searchTerm ? 'No matches found' : 'Workspace Empty'}</h4><p className="text-sm text-muted-foreground max-w-xs mx-auto mt-3 font-medium">Your assigned records will appear here once registered by the Registry or linked to your profile.</p></div>}
                        </div>
                    </>
                ) : (
                    <Card className="shadow-xl overflow-hidden rounded-2xl border-primary/10">
                        <CardHeader className="flex flex-col sm:flex-row items-center justify-between bg-muted/30 border-b p-6 gap-6"><div className="text-center sm:text-left"><CardTitle className="text-2xl font-black tracking-tight uppercase">{format(currentMonth, 'MMMM yyyy')}</CardTitle><CardDescription className="font-bold uppercase tracking-widest text-[10px] text-primary/60">Tracking {calendarEvents.length} active legal events</CardDescription></div><div className="flex items-center gap-3"><Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-5 w-5" /></Button><Button variant="outline" size="sm" className="h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest" onClick={() => setCurrentMonth(new Date())}>Today</Button><Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRightIcon className="h-5 w-5" /></Button></div></CardHeader>
                        <CardContent className="p-0 overflow-x-auto"><div className="min-w-[800px]"><div className="grid grid-cols-7 border-b">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (<div key={day} className="p-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-muted/10 border-r last:border-r-0">{day}</div>))}</div><div className="grid grid-cols-7">{calendarDays.map((day, idx) => { const dayEvents = calendarEvents.filter(e => isSameDay(e.date, day)); const isCurrentMonth = isSameMonth(day, monthStart); const isTodayDate = isToday(day); return ( <div key={day.toString()} className={cn("min-h-[150px] p-3 border-r border-b relative group hover:bg-primary/[0.02] transition-colors min-w-0", !isCurrentMonth && "bg-muted/5 opacity-40", idx % 7 === 6 && "border-r-0")}><div className="flex justify-between items-start mb-3"><span className={cn("text-xs font-black rounded-lg h-7 w-7 flex items-center justify-center transition-colors shadow-sm", isTodayDate ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground")}>{format(day, 'd')}</span>{isCurrentMonth && (<Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 text-primary" onClick={() => handleOpenCreateDialog(day)}><Plus className="h-4 w-4" /></Button>)}</div><div className="space-y-1.5 overflow-hidden">{dayEvents.slice(0, 4).map(event => ( <div key={event.id} className={cn( "text-[9px] px-2 py-1 rounded-lg border-l-2 truncate leading-tight font-black uppercase tracking-tighter cursor-pointer hover:brightness-95 transition-all shadow-sm", event.type === 'court' ? "bg-blue-50 text-blue-700 border-blue-200 border-l-blue-600" : isPast(event.date) && !isToday(event.date) ? "bg-red-50 text-red-700 border-red-200 border-l-red-600" : "bg-green-50 text-green-700 border-green-200 border-l-green-600" )} onClick={() => { if (event.fileId) { window.location.href = `/portal/file/${event.fileId}`; } else { handleToggleReminder('General', event.id, true); } }} title={`${event.fileNumber}: ${event.text}`}><span className="opacity-60 mr-1">{event.fileNumber}:</span>{event.text}</div> ))}{dayEvents.length > 4 && <div className="text-[8px] text-center font-black text-muted-foreground uppercase tracking-widest pt-1">+ {dayEvents.length - 4} more</div>}</div></div> ); })}</div></div></CardContent>
                    </Card>
                )}
            </main>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl p-8 rounded-2xl overflow-visible"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tight">Set Case Deadline</DialogTitle><DialogDescription className="font-medium text-muted-foreground">Schedule a legal task or reminder for {selectedDateForReminder ? format(selectedDateForReminder, 'PPP') : 'the selected date'}.</DialogDescription></DialogHeader><div className="grid gap-6 py-6 [&_*]:min-w-0 overflow-visible"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Task Description</Label><Input placeholder="e.g. File Statement of Case" value={reminderText} onChange={(e) => setReminderText(e.target.value)} className="h-12 text-sm font-bold rounded-xl bg-muted/20 border-none focus-visible:ring-primary/20" /></div><div className="space-y-2 min-w-0 overflow-visible"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Associated Activity / Case File</Label><div className="min-w-0 w-full overflow-visible"><Combobox options={fileOptions} value={reminderFileNumber} onChange={reminderFileNumber => setReminderFileNumber(reminderFileNumber)} placeholder="Select case or personal activity..." searchPlaceholder="Search by file number or subject..." /></div></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Due Time</Label><Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="h-12 text-sm font-bold rounded-xl bg-muted/20 border-none" /></div></div><DialogFooter className="flex flex-col sm:flex-row gap-4 pt-4 border-t"><Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto order-2 sm:order-1 font-bold uppercase text-[10px] tracking-widest">Discard</Button><Button onClick={handleCreateReminder} disabled={isSubmitting || !reminderFileNumber || !reminderText} className="w-full sm:w-auto order-1 sm:order-2 h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-primary/20 transition-all active:scale-95">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Reminder</Button></DialogFooter></DialogContent>
            </Dialog>
        </div>
    );
}
