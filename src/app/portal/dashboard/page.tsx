
'use client';

import * as React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePortal } from '@/components/portal-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
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
    PinOff,
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
    Filter
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
import { toggleReminder, addCaseReminder, toggleFilePin, addGeneralReminder, toggleGeneralReminder } from '@/app/actions';
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
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
}

const STAGNATION_THRESHOLD_DAYS = 14;
const OVERLOAD_THRESHOLD = 10;
const PAGE_SIZE = 25;

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
    const { attorney, logout, isSG } = usePortal();
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

    const { exec: authTogglePin } = useAuthAction(toggleFilePin);
    const { exec: authToggleReminder } = useAuthAction(toggleReminder);
    const { exec: authAddReminder } = useAuthAction(addCaseReminder);
    const { exec: authAddGeneralReminder } = useAuthAction(addGeneralReminder);
    const { exec: authToggleGeneralReminder } = useAuthAction(toggleGeneralReminder);

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
            // Enhanced Search: File metadata + Team Member Names
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
                // Return early for all results in SG master view
            }

            const isLead = file.assignedTo?.toLowerCase().trim() === myName;
            const isCoAssignee = file.coAssignees?.some(name => name.toLowerCase().trim() === myName);
            const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
            const latestMovement = movements[0];
            const isAtMyDesk = latestMovement?.movedTo?.toLowerCase().trim() === myName;
            
            const fileGroup = file.group?.toLowerCase().trim();
            const isInMyGroup = !!myGroup && fileGroup === myGroup;
            const canOversight = attorney.isGroupHead && isInMyGroup;

            const wasPreviouslyInvolved = file.movements?.some(m => m.movedTo?.toLowerCase().trim() === myName);

            if (isLead || isCoAssignee || isAtMyDesk || canOversight) {
                if (file.status === 'Completed') {
                    completed.push(file);
                } else if (file.pinnedBy?.[attorney.id]) {
                    pinned.push(file);
                } else if (isLead) {
                    primary.push(file);
                } else if (isCoAssignee) {
                    collaborative.push(file);
                } else if (isAtMyDesk) {
                    action.push(file);
                } else if (canOversight) {
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
            const groupName = file.group || 'General / Shared';
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
        if (isSG) return allFiles || [];
        const unique = new Map<string, CorrespondenceFile>();
        [...caseloads.pinned, ...caseloads.primary, ...caseloads.collaborative, ...caseloads.action, ...caseloads.oversight].forEach(f => unique.set(f.id, f));
        return Array.from(unique.values());
    }, [caseloads, allFiles, isSG]);

    const notifications = React.useMemo(() => {
        if (isSG || !myRelatedFiles || !attorney) return [];
        const notes: { id: string; fileId: string; fileNumber: string; message: string; timestamp: Date; type: 'communication' | 'folio' | 'draft' | 'movement' }[] = [];
        const last24h = subHours(new Date(), 24);
        const myName = attorney.fullName.toLowerCase().trim();
        myRelatedFiles.forEach(file => {
            const lastViewedAt = toDate(file.viewedBy?.[attorney.id]);
            const referencePoint = lastViewedAt || last24h;
            (file.internalInstructions || []).forEach(i => {
                const d = toDate(i.date);
                if (d && isAfter(d, referencePoint) && i.from.toLowerCase().trim() !== myName) {
                    notes.push({ id: i.id, fileId: file.id, fileNumber: file.fileNumber, message: `New message from ${i.from}`, timestamp: d, type: 'communication' });
                }
            });
            (file.letters || []).forEach(l => {
                const d = toDate(l.date);
                if (d && isAfter(d, referencePoint)) {
                    notes.push({ id: l.id, fileId: file.id, fileNumber: file.fileNumber, message: `New Folio: ${l.subject}`, timestamp: d, type: 'folio' });
                }
            });
            const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
            const latest = movements[0];
            if (latest) {
                const d = toDate(latest.date);
                if (d && isAfter(d, referencePoint)) {
                    if (isSG || (latest.movedTo.toLowerCase().trim() === myName && latest.receivedBy?.toLowerCase().trim() !== myName)) {
                        notes.push({ id: latest.id, fileId: file.id, fileNumber: file.fileNumber, message: isSG ? `File moved to ${latest.movedTo}` : `File moved to your desk`, timestamp: d, type: 'movement' });
                    }
                }
            }
        });
        return notes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, isSG ? 10 : 5);
    }, [myRelatedFiles, attorney, isSG]);

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
        const myGroup = attorney.group?.toLowerCase().trim();
        const myFiles = allFiles.filter(file => {
            if (isSG) return true;
            const isLead = file.assignedTo?.toLowerCase().trim() === myName;
            const isCoAssignee = file.coAssignees?.some(name => name.toLowerCase().trim() === myName);
            const movements = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
            const latestMovement = movements[0];
            const isAtMyDesk = latestMovement?.movedTo?.toLowerCase().trim() === myName;
            const isInMyGroup = attorney.isGroupHead && !!myGroup && file.group?.toLowerCase().trim() === myGroup;
            return (isLead || isCoAssignee || isAtMyDesk || isInMyGroup);
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
            doc.text(`Group: ${attorney.group || 'N/A'}`, 14, 40);
            doc.text(`Date: ${format(now, 'PPP')}`, 14, 45);
            
            if (isSG && reportCategory !== 'all') {
                doc.text(`Category Filter: ${categories.find(c => c.value === reportCategory)?.label || reportCategory}`, 14, 50);
            }

            let reportFiles = isSG ? caseloads.all : caseloads.primary;
            
            // Apply category filter for SG
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

            // Group files by Department (Group)
            const groupedFiles: Record<string, CorrespondenceFile[]> = {};
            reportFiles.forEach(file => {
                const groupName = file.group || 'General / Shared';
                if (!groupedFiles[groupName]) groupedFiles[groupName] = [];
                groupedFiles[groupName].push(file);
            });

            let finalY = (doc as any).lastAutoTable.finalY + 15;

            Object.entries(groupedFiles).sort().forEach(([groupName, files]) => {
                // Add Group Header
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
            <Link href={`/portal/file/${file.id}`} className="block relative group min-w-0">
                <Card className={cn("hover:border-primary/50 transition-colors shadow-sm border-l-4 overflow-hidden", 
                    isCompleted ? "border-l-green-500 bg-green-50/5 opacity-90" : 
                    type === 'pinned' ? "border-l-yellow-500 bg-yellow-50/10" : 
                    type === 'primary' ? "border-l-primary" : 
                    type === 'collaborative' ? "border-l-teal-500 bg-teal-50/5" :
                    type === 'oversight' ? "border-l-purple-500 bg-purple-50/5" :
                    type === 'historical' ? "border-l-muted-foreground/30 grayscale-[0.5] opacity-80" :
                    "border-l-blue-500")}>
                    <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
                        <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={cn("font-mono text-xs font-bold shrink-0", 
                                    isCompleted ? "text-green-600" :
                                    type === 'pinned' ? "text-yellow-600" : 
                                    type === 'primary' ? "text-primary" : 
                                    type === 'collaborative' ? "text-teal-600" :
                                    type === 'oversight' ? "text-purple-600" :
                                    type === 'historical' ? "text-muted-foreground" :
                                    "text-blue-600" )}>{file.fileNumber}</span>
                                {isCompleted ? (
                                    <Badge variant="secondary" className="text-[9px] uppercase h-4 bg-green-100 text-green-800 border-green-200 shrink-0">Resolved</Badge>
                                ) : isSG ? (
                                    <Badge variant="outline" className="text-[9px] uppercase h-4 border-yellow-500 text-yellow-700 bg-yellow-50/50 shrink-0">Executive Control</Badge>
                                ) : isLead ? (
                                    <Badge variant="outline" className="text-[9px] uppercase h-4 shrink-0">Lead Assignee</Badge>
                                ) : isTeam ? (
                                    <Badge variant="outline" className="text-[9px] uppercase h-4 border-teal-500 text-teal-700 bg-teal-50 shrink-0">Team Member</Badge>
                                ) : type === 'oversight' ? (
                                    <Badge variant="secondary" className="text-[9px] uppercase h-4 bg-purple-100 text-purple-700 border-purple-200 shrink-0">Group Insight</Badge>
                                ) : type === 'historical' ? (
                                    <Badge variant="outline" className="text-[9px] uppercase h-4 text-muted-foreground border-muted-foreground/20 shrink-0">Previous Assignment</Badge>
                                ) : (
                                    <Badge variant="secondary" className="text-[9px] uppercase h-4 bg-blue-50 text-blue-700 border-blue-100 shrink-0">Possession</Badge>
                                )}
                                {isRecentlyUpdated && !isCompleted && type !== 'historical' && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 shrink-0">
                                        <div className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                                        <span className="text-[9px] font-bold uppercase tracking-tighter">Updated</span>
                                    </div>
                                )}
                            </div>
                            <h4 className="font-bold text-sm leading-tight truncate" title={file.subject}>{file.subject}</h4>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-tighter overflow-hidden">
                                <span className={cn("shrink-0", isCompleted ? "text-green-600" : "text-primary")}>{file.category}</span>
                                <span className="shrink-0">•</span>
                                <span className="shrink-0">Group: {file.group || 'General'}</span>
                                <span className="shrink-0">•</span>
                                {isLead || (!file.assignedTo && isWithMe) ? (
                                    <span className="truncate max-w-[150px]">Location: {isWithMe ? 'At My Desk' : (latestMovement?.movedTo || 'Registry')}</span>
                                ) : (
                                    <span className="truncate max-w-[150px]">Lead: {file.assignedTo || 'General / Shared'}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground shrink-0 self-end sm:self-center">
                            <div className="text-right hidden sm:block">
                                <p className="text-[10px] uppercase tracking-tighter">Last Activity</p>
                                <p className="text-xs font-medium whitespace-nowrap">{format(toDate(file.lastActivityAt || file.reportableDate || file.dateCreated)!, 'MMM d, p')}</p>
                            </div>
                            <ChevronRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                {!isCompleted && !isSG && type !== 'historical' && (
                    <Button variant="ghost" size="icon" className={cn("absolute top-2 right-2 h-8 w-8 transition-opacity", file.pinnedBy?.[attorney.id] ? "opacity-100 text-yellow-500" : "opacity-0 group-hover:opacity-100")} onClick={(e) => handleTogglePin(e, file.id)}>
                        {file.pinnedBy?.[attorney.id] ? <Pin className="h-4 w-4 fill-current" /> : <Pin className="h-4 w-4" />}
                    </Button>
                )}
            </Link>
        );
    }

    return (
        <div className="min-h-screen bg-muted/20 pb-20 font-body">
            <header className="sticky top-0 z-10 bg-background border-b px-4 h-16 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-md", isSG ? "bg-yellow-500" : "bg-primary")}>
                        {isSG ? <Crown className="h-5 w-5 text-white" /> : <Folder className="h-5 w-5 text-primary-foreground" />}
                    </div>
                    <div className="hidden sm:block">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold leading-none">{attorney?.fullName}</h2>
                            {isSG ? (
                                <Badge className="bg-yellow-500 text-white border-yellow-600 text-[8px] h-4 uppercase font-bold px-1.5 py-0">Solicitor General</Badge>
                            ) : attorney.isGroupHead && (
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] h-4 uppercase font-bold px-1.5 py-0"><ShieldCheck className="h-3 w-3 mr-1" /> Group Head</Badge>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{attorney?.rank || 'Practitioner'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-2 border-primary/20 text-primary hidden sm:flex" onClick={() => handleOpenCreateDialog()}>
                        <Plus className="h-4 w-4" /> New Reminder
                    </Button>
                    <div className="flex items-center bg-muted/50 p-1 rounded-lg border">
                        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2" onClick={() => setViewMode('list')}><List className="h-4 w-4" /><span className="hidden sm:inline">List</span></Button>
                        <Button variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2" onClick={() => setViewMode('calendar')}><CalendarIcon className="h-4 w-4" /><span className="hidden sm:inline">Calendar</span></Button>
                        {(attorney.isGroupHead || isSG) && (
                            <Button variant={viewMode === 'monitoring' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2" onClick={() => setViewMode('monitoring')}><Activity className="h-4 w-4" /><span className="hidden sm:inline">{isSG ? 'Oversight' : 'Monitoring'}</span></Button>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive"><LogOut className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Logout</span></Button>
                </div>
            </header>

            <main className="container mx-auto p-3 md:p-4 lg:p-6 xl:p-8 space-y-8 min-w-0">
                {viewMode === 'monitoring' && (attorney.isGroupHead || isSG) ? (
                    <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">{isSG ? 'Executive Oversight Hub' : 'Group Oversight Hub'}</h2>
                                <p className="text-sm text-muted-foreground">Strategic monitoring for <strong>{isSG ? 'All groups' : attorney.group}</strong></p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isSG && (
                                    <div className="flex items-center gap-2 mr-2">
                                        <Filter className="h-4 w-4 text-muted-foreground" />
                                        <Select value={reportCategory} onValueChange={setReportCategory}>
                                            <SelectTrigger className="h-9 w-[200px] text-xs">
                                                <SelectValue placeholder="Category Filter" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => (
                                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <Button variant="outline" size="sm" className="h-9 gap-2 border-primary/20 text-primary" onClick={handleGenerateStatusReport} disabled={isReporting}>
                                    {isReporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                    {isSG ? 'Master Status Report' : 'Group Status Report'}
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                            <Card className="shadow-sm border-primary/10">
                                <CardHeader className="pb-3 border-b bg-muted/10">
                                    <div className="flex items-center gap-2">
                                        <Scale className="h-5 w-5 text-primary" />
                                        <div><CardTitle className="text-sm">Workload Distribution</CardTitle><CardDescription className="text-[10px] uppercase tracking-tighter font-bold">{isSG ? 'Cross-Group Analysis' : 'Files per Practitioner'}</CardDescription></div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {(isSG ? executiveWorkloadAnalytics : groupWorkloadAnalytics).chartData.length > 0 ? (
                                        <ChartContainer config={workloadChartConfig} className="min-h-[300px] w-full">
                                            <BarChart data={(isSG ? executiveWorkloadAnalytics : groupWorkloadAnalytics).chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
                                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} width={100} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                                                <ChartTooltip content={<ChartTooltipContent />} />
                                                <ChartLegend content={<ChartLegendContent />} />
                                                <Bar dataKey="active" stackId="a" fill="var(--color-active)" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ChartContainer>
                                    ) : (
                                        <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-2">
                                            <Folder className="h-10 w-10 text-muted-foreground/20" />
                                            <p className="text-sm text-muted-foreground italic">No data available for analysis.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            <Card className="shadow-sm border-primary/10">
                                <CardHeader className="pb-3 border-b bg-muted/10">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-5 w-5 text-primary" />
                                        <div><CardTitle className="text-sm">{isSG ? 'Departmental Burden Rank' : 'Practitioner Burden Rank'}</CardTitle><CardDescription className="text-[10px] uppercase tracking-tighter font-bold">Comparative active caseload analysis</CardDescription></div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[350px] overflow-y-auto">
                                        <Table>
                                            <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[10px] uppercase font-bold">Department/Practitioner</TableHead><TableHead className="text-center text-[10px] uppercase font-bold w-[80px]">Active</TableHead><TableHead className="text-right text-[10px] uppercase font-bold w-[100px]">Load Status</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {(isSG ? executiveWorkloadAnalytics : groupWorkloadAnalytics).chartData.map(row => {
                                                    const isOverloaded = row.active >= (isSG ? OVERLOAD_THRESHOLD * 5 : OVERLOAD_THRESHOLD);
                                                    return (
                                                        <TableRow key={row.name}>
                                                            <TableCell className="text-xs font-bold truncate max-w-[150px]">{row.name}</TableCell>
                                                            <TableCell className="text-center"><span className={cn("text-xs tabular-nums font-bold", isOverloaded ? "text-destructive" : "text-primary")}>{row.active}</span></TableCell>
                                                            <TableCell className="text-right">{isOverloaded ? <Badge variant="destructive" className="text-[8px] uppercase tracking-tighter h-4 px-1.5 animate-pulse">High Load</Badge> : row.active > 0 ? <Badge variant="secondary" className="text-[8px] uppercase tracking-tighter h-4 px-1.5 bg-green-50 text-green-700 border-green-100">Healthy</Badge> : <span className="text-[9px] text-muted-foreground italic">Available</span>}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="space-y-4 min-w-0">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-destructive uppercase tracking-widest"><Zap className="h-4 w-4 animate-pulse" /> Stagnant Exception Report</h3>
                            {stagnantOversightFiles.length > 0 ? (
                                <div className="rounded-md border bg-background shadow-sm overflow-hidden min-w-0">
                                    <div className="w-full overflow-x-auto">
                                        <Table className="min-w-[900px]">
                                            <TableHeader><TableRow className="bg-muted/30"><TableHead className="w-[120px]">File No.</TableHead><TableHead>Group / Assignee</TableHead><TableHead>Current Milestone</TableHead><TableHead>Overall Progress</TableHead><TableHead>Activity Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {stagnantOversightFiles.map(file => {
                                                    const completedCount = (file.milestones || []).filter(m => m.isCompleted).length;
                                                    const totalCount = (file.milestones || []).length;
                                                    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                                                    const lastAct = toDate(file.lastActivityAt || file.reportableDate || file.dateCreated);
                                                    const daysSince = lastAct ? differenceInDays(new Date(), lastAct) : 0;
                                                    return (
                                                        <TableRow key={file.id} className="bg-red-50/20">
                                                            <TableCell><span className="font-mono text-xs font-bold text-primary">{file.fileNumber}</span></TableCell>
                                                            <TableCell><div className="flex flex-col max-w-[200px]"><span className="text-xs font-bold text-muted-foreground uppercase tracking-tighter truncate">{file.group || 'No Group'}</span><span className="text-sm font-medium truncate">{file.assignedTo || 'Unassigned'}</span></div></TableCell>
                                                            <TableCell><div className="flex items-center gap-2 max-w-[150px]"><Flag className="h-3 w-3 text-muted-foreground" /><span className="text-xs font-bold uppercase tracking-tight truncate">{(file.milestones || []).find(m => !m.isCompleted)?.title || "Execution"}</span></div></TableCell>
                                                            <TableCell className="w-[200px]"><div className="space-y-1"><div className="flex items-center justify-between text-[10px] font-bold tabular-nums"><span>{completedCount}/{totalCount}</span><span>{Math.round(progress)}%</span></div><Progress value={progress} className="h-1.5" /></div></TableCell>
                                                            <TableCell><Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 animate-pulse gap-1 px-1.5 py-0.5 whitespace-nowrap"><Zap className="h-3 w-3" /> Stagnant ({daysSince}d)</Badge></TableCell>
                                                            <TableCell className="text-right"><Button variant="ghost" size="sm" asChild><Link href={`/portal/file/${file.id}`}>Review</Link></Button></TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-xl bg-background shadow-inner text-center space-y-4"><div className="bg-green-50 p-4 rounded-full border border-green-100"><ThumbsUp className="h-10 w-10 text-green-600" /></div><div className="space-y-1"><h4 className="text-xl font-bold text-green-800">All Files Active</h4><p className="text-sm text-muted-foreground max-w-sm mx-auto">Great job! There are no stagnant files within oversight at this time.</p></div></div>
                            )}
                        </div>
                    </section>
                ) : viewMode === 'list' ? (
                    <>
                        <div className="relative w-full max-w-2xl mx-auto px-2">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input placeholder={isSG ? "Search all active & completed files..." : "Search caseload by file, subject, or colleague..."} className="pl-12 h-12 text-lg shadow-sm bg-background border-primary/10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        {!searchTerm && (
                            <div className="grid gap-8">
                                {activeReminders.length > 0 && (
                                    <section className="space-y-3 min-w-0">
                                        <h3 className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest">
                                            <Clock className="h-4 w-4" /> Upcoming Deadlines & Reminders
                                        </h3>
                                        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                            {activeReminders.map(reminder => {
                                                const isOverdue = isPast(reminder.date) && !isToday(reminder.date);
                                                return (
                                                    <Card key={reminder.id} className={cn(
                                                        "border-l-4 shadow-sm hover:bg-muted/30 transition-colors cursor-pointer",
                                                        isOverdue ? "border-l-destructive bg-destructive/5" : "border-l-primary bg-primary/5"
                                                    )} onClick={() => reminder.fileId && (window.location.href = `/portal/file/${reminder.fileId}`)}>
                                                        <CardContent className="p-3 flex items-center justify-between gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    {isOverdue && <Badge variant="destructive" className="h-4 text-[8px] uppercase px-1">Overdue</Badge>}
                                                                    <span className={cn("text-[9px] font-mono font-bold uppercase", reminder.fileNumber === 'General' ? "text-purple-600" : "text-primary")}>
                                                                        {reminder.fileNumber === 'General' ? 'Personal Task' : `File ${reminder.fileNumber}`}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm font-semibold truncate leading-tight">{reminder.text}</p>
                                                                <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                                                                    Due: {format(reminder.date, 'MMM d, p')}
                                                                </p>
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 shrink-0 hover:bg-green-100 hover:text-green-700"
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

                                {notifications.length > 0 && (
                                    <section className="space-y-3 min-w-0">
                                        <h3 className="text-xs font-bold flex items-center gap-2 text-red-600 uppercase tracking-widest"><Bell className="h-4 w-4 fill-current animate-bounce" /> Recent Activity</h3>
                                        <div className="grid gap-2">
                                            {notifications.map(note => (
                                                <Link key={note.id} href={`/portal/file/${note.fileId}`} className="min-w-0">
                                                    <Card className="hover:border-red-200 hover:bg-red-50/30 transition-all border-l-4 border-l-red-500 shadow-sm overflow-hidden">
                                                        <CardContent className="p-3 flex items-center justify-between min-w-0"><div className="flex items-center gap-3 min-w-0 flex-1"><div className="p-2 rounded-full bg-red-100 text-red-600 shrink-0">{note.type === 'communication' ? <MessageSquare className="h-4 w-4" /> : note.type === 'folio' ? <FileText className="h-4 w-4" /> : note.type === 'draft' ? <Pencil className="h-4 w-4" /> : <Truck className="h-4 w-4" />}</div><div className="space-y-0.5 min-w-0 flex-1"><p className="text-sm font-semibold leading-tight truncate">{note.message}</p><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter truncate">File {note.fileNumber} • {formatDistanceToNow(note.timestamp)} ago</p></div></div><ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" /></CardContent>
                                                    </Card>
                                                </Link>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}

                        <div className="space-y-8 min-w-0">
                            {isSG ? (
                                <section className="space-y-4 min-w-0"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><h3 className="text-xs font-bold flex items-center gap-2 text-yellow-600 uppercase tracking-widest"><LayoutDashboard className="h-4 w-4" /> Master File Registry</h3><Badge variant="outline" className="text-[10px] h-5 border-yellow-500 text-yellow-700 bg-yellow-50 uppercase font-bold w-fit">Executive Visibility</Badge></div><div className="grid gap-4 grid-cols-1 min-w-0">{paginatedAllFiles.map(file => <FileCard key={file.id} file={file} type="all" />)}</div>{totalPages > 1 && (<div className="flex flex-col sm:flex-row items-center justify-between border-t pt-6 gap-4"><p className="text-xs text-muted-foreground">Showing <span className="font-bold text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * PAGE_SIZE, caseloads.all.length)}</span> of <span className="font-bold text-foreground">{caseloads.all.length}</span> records</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8"><ChevronLeft className="h-4 w-4 mr-1" />Previous</Button><div className="text-xs font-bold px-3 py-1 bg-muted rounded-md border">Page {currentPage} of {totalPages}</div><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8">Next<ChevronRightIcon className="h-4 w-4 ml-1" /></Button></div></div>)}</section>
                            ) : (
                                <div className="space-y-8 min-w-0">
                                    {caseloads.pinned.length > 0 && <section className="space-y-4"><h3 className="text-xs font-bold flex items-center gap-2 text-yellow-600 uppercase tracking-widest"><Star className="h-4 w-4 fill-current" /> Pinned & Urgent Cases</h3><div className="grid gap-4 grid-cols-1">{caseloads.pinned.map(file => <FileCard key={file.id} file={file} type="pinned" />)}</div></section>}
                                    {caseloads.primary.length > 0 && <section className="space-y-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><h3 className="text-xs font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest"><Briefcase className="h-4 w-4" /> My Primary Caseload</h3><Button variant="outline" size="sm" className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/5" onClick={handleGenerateStatusReport} disabled={isReporting}>{isReporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}Download My Status Report</Button></div><div className="grid gap-4 grid-cols-1">{caseloads.primary.map(file => <FileCard key={file.id} file={file} type="primary" />)}</div></section>}
                                    {caseloads.collaborative.length > 0 && <section className="space-y-4"><h3 className="text-xs font-bold flex items-center gap-2 text-teal-600 uppercase tracking-widest"><Users className="h-4 w-4" /> Collaborative Team Cases</h3><div className="grid gap-4 grid-cols-1">{caseloads.collaborative.map(file => <FileCard key={file.id} file={file} type="collaborative" />)}</div></section>}
                                    {caseloads.action.length > 0 && <section className="space-y-4"><h3 className="text-xs font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest"><UserCheck className="h-4 w-4" /> Files on My Desk</h3><div className="grid gap-4 grid-cols-1">{caseloads.action.map(file => <FileCard key={file.id} file={file} type="action" />)}</div></section>}
                                    {caseloads.oversight.length > 0 && <section className="space-y-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><h3 className="text-xs font-bold flex items-center gap-2 text-purple-600 uppercase tracking-widest"><Users className="h-4 w-4" /> Group Oversight ({attorney.group})</h3><Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[9px] uppercase font-bold w-fit">Group Head View</Badge></div><div className="grid gap-4 grid-cols-1">{caseloads.oversight.map(file => <FileCard key={file.id} file={file} type="oversight" />)}</div></section>}
                                    {caseloads.historical.length > 0 && <section className="space-y-4 pt-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><h3 className="text-xs font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest"><History className="h-4 w-4" /> My Previous Assignments (Historical)</h3><Badge variant="secondary" className="bg-muted text-muted-foreground text-[9px] uppercase font-bold w-fit border-none">Read-Only Access</Badge></div><div className="grid gap-4 grid-cols-1">{caseloads.historical.map(file => <FileCard key={file.id} file={file} type="historical" />)}</div></section>}
                                </div>
                            )}
                            {(caseloads.completed.length > 0 && !isSG) && <section className="space-y-4 pt-8 border-t"><h3 className="text-xs font-bold flex items-center gap-2 text-green-600 uppercase tracking-widest"><Archive className="h-4 w-4" /> Completed & Resolved Cases</h3><div className="grid gap-4 grid-cols-1">{caseloads.completed.map(file => <FileCard key={file.id} file={file} type="completed" />)}</div></section>}
                            {availableFiles.length === 0 && caseloads.completed.length === 0 && caseloads.historical.length === 0 && <div className="text-center py-24 border border-dashed rounded-xl bg-background shadow-inner px-4"><AlertCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" /><h4 className="text-xl font-semibold text-muted-foreground">{searchTerm ? 'No results found' : 'Registry is empty'}</h4><p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">Files will appear here once registered or assigned.</p></div>}
                        </div>
                    </>
                ) : (
                    <Card className="shadow-sm overflow-hidden">
                        <CardHeader className="flex flex-col sm:flex-row items-center justify-between bg-muted/30 border-b gap-4"><div className="text-center sm:text-left"><CardTitle className="text-xl">{format(currentMonth, 'MMMM yyyy')}</CardTitle><CardDescription>Tracking {calendarEvents.length} active events</CardDescription></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button><Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRightIcon className="h-4 w-4" /></Button></div></CardHeader>
                        <CardContent className="p-0 overflow-x-auto"><div className="min-w-[600px]"><div className="grid grid-cols-7 border-b">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (<div key={day} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/10">{day}</div>))}</div><div className="grid grid-cols-7">{calendarDays.map((day, idx) => { const dayEvents = calendarEvents.filter(e => isSameDay(e.date, day)); const isCurrentMonth = isSameMonth(day, monthStart); const isTodayDate = isToday(day); return ( <div key={day.toString()} className={cn("min-h-[120px] p-2 border-r border-b relative group hover:bg-primary/5 transition-colors min-w-0", !isCurrentMonth && "bg-muted/5 opacity-40", idx % 7 === 6 && "border-r-0")}><div className="flex justify-between items-start mb-2"><span className={cn("text-xs font-semibold rounded-full h-6 w-6 flex items-center justify-center", isTodayDate && "bg-primary text-primary-foreground")}>{format(day, 'd')}</span>{isCurrentMonth && (<Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleOpenCreateDialog(day)}><Plus className="h-3 w-3" /></Button>)}</div><div className="space-y-1 overflow-hidden">{dayEvents.slice(0, 3).map(event => ( <div key={event.id} className={cn( "text-[9px] px-1.5 py-0.5 rounded border truncate leading-tight font-medium mb-0.5 cursor-pointer hover:brightness-95 transition-all", event.type === 'court' ? "bg-blue-50 text-blue-700 border-blue-100" : isPast(event.date) && !isToday(event.date) ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100" )} onClick={() => { if (event.fileId) { window.location.href = `/portal/file/${event.fileId}`; } else { handleToggleReminder('General', event.id, true); } }} title={`${event.fileNumber}: ${event.text}`}><span className="font-bold mr-1">{event.fileNumber}:</span>{event.text}</div> ))}{dayEvents.length > 3 && <div className="text-[8px] text-center font-bold text-muted-foreground">+ {dayEvents.length - 3} more</div>}</div></div> ); })}</div></div></CardContent>
                    </Card>
                )}
            </main>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl p-6 overflow-visible"><DialogHeader><DialogTitle>Set Deadline Reminder</DialogTitle><DialogDescription>Schedule a task for {selectedDateForReminder ? format(selectedDateForReminder, 'PPP') : 'selected date'}.</DialogDescription></DialogHeader><div className="grid gap-4 py-4 [&_*]:min-w-0 overflow-visible"><div className="space-y-2"><Label>Task Description</Label><Input placeholder="e.g. File Statement of Case" value={reminderText} onChange={(e) => setReminderText(e.target.value)} /></div><div className="space-y-2 min-w-0 overflow-visible"><Label>Activity / Case File</Label><div className="min-w-0 w-full overflow-visible"><Combobox options={fileOptions} value={reminderFileNumber} onChange={reminderFileNumber => setReminderFileNumber(reminderFileNumber)} placeholder="Select case or general activity..." searchPlaceholder="Search by file number or subject..." /></div></div><div className="space-y-2"><Label>Time</Label><Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} /></div></div><DialogFooter className="flex flex-col sm:flex-row gap-3"><Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">Cancel</Button><Button onClick={handleCreateReminder} disabled={isSubmitting || !reminderFileNumber || !reminderText} className="w-full sm:w-auto order-1 sm:order-2">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Reminder</Button></DialogFooter></DialogContent>
            </Dialog>
        </div>
    );
}
