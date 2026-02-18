
'use client';

import * as React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { CorrespondenceFile, Attorney } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, File as FileIcon, Users, AlertCircle, Banknote, ShieldAlert } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getMonth, getQuarter, getYear, startOfQuarter, endOfQuarter, startOfMonth, endOfMonth, endOfDay, startOfYear, endOfYear } from 'date-fns';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";

type CategorySummary = {
  total: number;
  inProgress: number;
  completed: number;
};

type AttorneySummary = {
  total: number;
  inProgress: number;
  completed: number;
};

type ReportData = {
  summary: Record<string, CategorySummary>;
  attorneyWorkload: Record<string, AttorneySummary>;
  details: Record<string, (CorrespondenceFile & { currentStatus: string })[]>;
  judgmentDebtSummary: {
    totalCases: number;
    totalAmountGHC: number;
    totalAmountUSD: number;
    cases: (CorrespondenceFile & { currentStatus: string })[];
  };
  period: string;
  categoryFilter: string;
};

const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'judgment-debt', label: 'Judgment Debt Cases Only' },
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

const workloadChartConfig = {
  inProgress: {
    label: "In Progress",
    color: "hsl(var(--chart-1))",
  },
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    if (!isNaN(new Date(value).getTime())) return new Date(value);
    return null;
};

const getFileStatus = (file: CorrespondenceFile): { status: 'Completed' | 'In Progress'; currentStatus: string } => {
    if (file.status === 'Completed') {
        return { status: 'Completed', currentStatus: 'Completed' };
    }

    const movements = Array.isArray(file.movements) ? file.movements : [];
    if (movements.length === 0) {
        return { status: 'In Progress', currentStatus: 'New Case' };
    }

    const sortedMovements = [...movements].sort((a, b) => {
        const dateA = toDate(a.date)?.getTime() || 0;
        const dateB = toDate(b.date)?.getTime() || 0;
        if (dateB !== dateA) return dateB - dateA;
        return b.id.localeCompare(a.id);
    });
    
    const latestMovement = sortedMovements[0];
    const statusText = (latestMovement?.status || '').toLowerCase();
    const completionKeywords = ['closed', 'completed', 'archived', 'done', 'finished', 'concluded'];
    const isCompleted = completionKeywords.some(keyword => statusText.includes(keyword));

    if (isCompleted) {
        return { status: 'Completed', currentStatus: latestMovement.status || 'Completed' };
    }
    return { status: 'In Progress', currentStatus: latestMovement?.status || 'In Progress' };
};

const formatCurrency = (amount: number = 0, currency: 'GHS' | 'USD' = 'GHS') => {
    return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

export default function ReportPage() {
  const firestore = useFirestore();

  const filesQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'files'), orderBy('dateCreated', 'desc'));
    },
    [firestore]
  );
  
  const attorneysQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'attorneys'), orderBy('fullName', 'asc'));
    },
    [firestore]
  );

  const { data: files, isLoading: isLoadingFiles } = useCollection<CorrespondenceFile>(filesQuery);
  const { data: attorneys, isLoading: isLoadingAttorneys } = useCollection<Attorney>(attorneysQuery);
  
  const [reportData, setReportData] = React.useState<ReportData | null>(null);
  const [reportType, setReportType] = React.useState<'all' | 'monthly' | 'quarterly' | 'annually'>('all');
  const [selectedYear, setSelectedYear] = React.useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = React.useState<string>((getMonth(new Date()) + 1).toString());
  const [selectedQuarter, setSelectedQuarter] = React.useState<string>(getQuarter(new Date()).toString());
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  const isLoading = (isLoadingFiles || isLoadingAttorneys) && (!files || !attorneys);

  const handleGenerateReport = () => {
    let currentFiles = files || [];
    let currentAttorneys = attorneys || [];
    let filteredFiles = currentFiles;
    let periodDescription = "All Time";

    // 1. Filter by Category
    if (selectedCategory === 'judgment-debt') {
        filteredFiles = filteredFiles.filter(file => file.isJudgmentDebt === true);
    } else if (selectedCategory !== 'all') {
        filteredFiles = filteredFiles.filter(file => file.category?.toLowerCase() === selectedCategory.toLowerCase());
    }

    // 2. Filter by Date Period
    const year = parseInt(selectedYear);

    if (reportType === 'monthly') {
        const month = parseInt(selectedMonth) - 1;
        const startDate = startOfMonth(new Date(year, month));
        const endDate = endOfDay(endOfMonth(new Date(year, month)));
        filteredFiles = filteredFiles.filter(file => {
            const reportableDate = toDate(file.reportableDate) || toDate(file.dateCreated);
            return reportableDate && reportableDate >= startDate && reportableDate <= endDate;
        });
        periodDescription = `Month: ${startDate.toLocaleString('default', { month: 'long' })} ${year}`;

    } else if (reportType === 'quarterly') {
        const quarter = parseInt(selectedQuarter);
        const startDate = startOfQuarter(new Date(year, (quarter - 1) * 3));
        const endDate = endOfDay(endOfQuarter(new Date(year, (quarter - 1) * 3)));
        filteredFiles = filteredFiles.filter(file => {
            const reportableDate = toDate(file.reportableDate) || toDate(file.dateCreated);
            return reportableDate && reportableDate >= startDate && reportableDate <= endDate;
        });
        periodDescription = `Quarter ${quarter} ${year}`;
    } else if (reportType === 'annually') {
        const startDate = startOfYear(new Date(year, 0));
        const endDate = endOfDay(endOfYear(new Date(year, 0)));
        filteredFiles = filteredFiles.filter(file => {
            const reportableDate = toDate(file.reportableDate) || toDate(file.dateCreated);
            return reportableDate && reportableDate >= startDate && reportableDate <= endDate;
        });
        periodDescription = `Year: ${year}`;
    }

    const summary: Record<string, CategorySummary> = {};
    const attorneyWorkload: Record<string, AttorneySummary> = {};
    const details: Record<string, (CorrespondenceFile & { currentStatus: string })[]> = {};
    const judgmentDebtSummary = {
        totalCases: 0,
        totalAmountGHC: 0,
        totalAmountUSD: 0,
        cases: [] as (CorrespondenceFile & { currentStatus: string })[]
    };

    currentAttorneys.forEach(attorney => {
        attorneyWorkload[attorney.fullName] = { total: 0, inProgress: 0, completed: 0 };
    });

    filteredFiles.forEach(file => {
        const { status, currentStatus } = getFileStatus(file);
        const category = file.category || 'Uncategorized';
        
        let assignedTo = 'Unassigned / Other';
        if (file.assignedTo) {
            const normalizedAssigned = file.assignedTo.trim().toLowerCase();
            const matchingAttorney = currentAttorneys.find(a => a.fullName.toLowerCase() === normalizedAssigned);
            if (matchingAttorney) {
                assignedTo = matchingAttorney.fullName;
            } else if (normalizedAssigned === 'registry') {
                assignedTo = 'Registry';
            } else {
                assignedTo = file.assignedTo;
            }
        }

        if (!summary[category]) {
            summary[category] = { total: 0, inProgress: 0, completed: 0 };
        }
        summary[category].total++;
        if (status === 'In Progress') {
            summary[category].inProgress++;
        } else {
            summary[category].completed++;
        }

        if (assignedTo !== 'Registry') {
            if (!attorneyWorkload[assignedTo]) {
                attorneyWorkload[assignedTo] = { total: 0, inProgress: 0, completed: 0 };
            }
            attorneyWorkload[assignedTo].total++;
            if (status === 'In Progress') {
                attorneyWorkload[assignedTo].inProgress++;
            } else {
                attorneyWorkload[assignedTo].completed++;
            }
        }

        if (file.isJudgmentDebt) {
            judgmentDebtSummary.totalCases++;
            judgmentDebtSummary.totalAmountGHC += (file.amountGHC || file.amountInvolved || 0);
            judgmentDebtSummary.totalAmountUSD += (file.amountUSD || 0);
            judgmentDebtSummary.cases.push({ ...file, currentStatus });
        }

        if (!details[category]) {
            details[category] = [];
        }
        details[category].push({ ...file, currentStatus });
    });

    Object.values(details).forEach(fileList => {
        fileList.sort((a, b) => a.fileNumber.localeCompare(b.fileNumber));
    });

    setReportData({ 
        summary, 
        attorneyWorkload,
        details, 
        judgmentDebtSummary,
        period: periodDescription,
        categoryFilter: selectedCategory === 'all' ? 'All Categories' : categories.find(c => c.value === selectedCategory)?.label || selectedCategory
    });
  };

  /**
   * PDF-safe currency formatting that replaces special symbols with text codes.
   */
  const formatCurrencyForPDF = (amount: number = 0, currency: 'GHS' | 'USD' = 'GHS') => {
    const formatted = formatCurrency(amount, currency);
    // Replace the Cedi symbol which often breaks in PDF standard fonts
    return formatted.replace('GH₵', 'GHS ').replace('$', '$ ');
  };

  const handleExportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('File Status Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Period: ${reportData.period}`, 14, 28);
    doc.text(`Filter: ${reportData.categoryFilter}`, 14, 34);
    
    doc.setFontSize(14);
    doc.text('Summary by Category', 14, 45);
    autoTable(doc, {
      head: [['Category', 'Total Files', 'In Progress', 'Completed']],
      body: Object.entries(reportData.summary).map(([category, data]) => [
        category,
        data.total,
        data.inProgress,
        data.completed,
      ]),
      startY: 50,
      theme: 'grid',
      headStyles: { fillColor: [84, 101, 55] },
    });

    let finalY = (doc as any).lastAutoTable.finalY || 100;

    if (reportData.judgmentDebtSummary.totalCases > 0) {
        finalY = (doc as any).lastAutoTable.finalY || 100;
        doc.setFontSize(14);
        doc.text('Judgment Debt Analysis', 14, finalY + 15);
        autoTable(doc, {
            head: [['File Number', 'Subject', 'Assigned To', 'Amount (GHS)', 'Amount (USD)']],
            body: reportData.judgmentDebtSummary.cases.map(c => [
                c.fileNumber,
                c.subject,
                c.assignedTo || 'N/A',
                formatCurrencyForPDF(c.amountGHC || c.amountInvolved, 'GHS'),
                formatCurrencyForPDF(c.amountUSD, 'USD')
            ]),
            foot: [['Total', `${reportData.judgmentDebtSummary.totalCases} Cases`, '', formatCurrencyForPDF(reportData.judgmentDebtSummary.totalAmountGHC, 'GHS'), formatCurrencyForPDF(reportData.judgmentDebtSummary.totalAmountUSD, 'USD')]],
            startY: finalY + 20,
            theme: 'grid',
            headStyles: { fillColor: [153, 27, 27] },
        });
    }

    finalY = (doc as any).lastAutoTable.finalY || finalY + 100;
    doc.setFontSize(14);
    doc.text('Detailed File List', 14, finalY + 15);

    Object.entries(reportData.details).forEach(([category, fileList]) => {
        finalY = (doc as any).lastAutoTable.finalY;
        if (finalY > 250) { 
            doc.addPage();
            finalY = 15;
        }

        autoTable(doc, {
            head: [[{ content: category, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 20 } }]],
            body: [
                ['File Number', 'Subject', 'Assigned To', 'Current Status'],
                ...fileList.map(file => [file.fileNumber, file.subject, file.assignedTo || 'N/A', file.currentStatus])
            ],
            startY: finalY + 5,
            theme: 'grid',
        });
    });

    doc.save(`file-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
   const handleExportCSV = () => {
    if (!reportData) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `File Status Report\n`;
    csvContent += `Period,${reportData.period}\n`;
    csvContent += `Filter,${reportData.categoryFilter}\n\n`;

    csvContent += 'Category Summary\n';
    csvContent += 'Category,Total Files,In Progress,Completed\n';
    Object.entries(reportData.summary).forEach(([category, data]) => {
      csvContent += `"${category}",${data.total},${data.inProgress},${data.completed}\n`;
    });

    csvContent += '\n\n';

    if (reportData.judgmentDebtSummary.totalCases > 0) {
        csvContent += 'Judgment Debt Breakdown\n';
        csvContent += 'File Number,Subject,Assigned To,Amount (GHS),Amount (USD)\n';
        reportData.judgmentDebtSummary.cases.forEach(c => {
            csvContent += `"${c.fileNumber}","${c.subject.replace(/"/g, '""')}","${c.assignedTo || 'N/A'}",${c.amountGHC || c.amountInvolved},${c.amountUSD}\n`;
        });
        csvContent += `TOTAL,${reportData.judgmentDebtSummary.totalCases} cases,,${reportData.judgmentDebtSummary.totalAmountGHC},${reportData.judgmentDebtSummary.totalAmountUSD}\n\n`;
    }

    csvContent += 'Detailed File List\n';
    csvContent += 'Category,File Number,Subject,Assigned To,Current Status\n';
    Object.entries(reportData.details).forEach(([category, fileList]) => {
      fileList.forEach(file => {
        const row = [
          category,
          file.fileNumber,
          `"${file.subject.replace(/"/g, '""')}"`, 
          file.assignedTo || 'N/A',
          `"${file.currentStatus.replace(/"/g, '""')}"` 
        ].join(',');
        csvContent += row + '\n';
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `file-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const yearOptions = Array.from({ length: 10 }, (_, i) => getYear(new Date()) - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: new Date(0, i).toLocaleString('default', { month: 'long' }) }));
  const quarterOptions = [
    { value: '1', label: 'Quarter 1 (Jan-Mar)' },
    { value: '2', label: 'Quarter 2 (Apr-Jun)' },
    { value: '3', label: 'Quarter 3 (Jul-Sep)' },
    { value: '4', label: 'Quarter 4 (Oct-Dec)' },
  ];

  const chartData = React.useMemo(() => {
    if (!reportData) return [];
    return Object.entries(reportData.attorneyWorkload)
        .filter(([, data]) => data.total > 0)
        .map(([name, data]) => ({
            name,
            inProgress: data.inProgress,
            completed: data.completed,
        }));
  }, [reportData]);

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8">
      <div className="container mx-auto">
        {isLoading && !files ? <div>Loading report data...</div> : (
        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>
              Analyze file statuses, categories, and attorney workload. Use the "Judgment Debt" filter for financial reporting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="space-y-2">
                    <Label>Report Period</Label>
                    <RadioGroup
                        value={reportType}
                        onOpenChange={(value) => setReportType(value as any)}
                        className="flex flex-col sm:flex-row flex-wrap gap-4"
                    >
                        <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="r1" />
                        <Label htmlFor="r1">All Time</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                        <RadioGroupItem value="annually" id="r4" />
                        <Label htmlFor="r4">Annually</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                        <RadioGroupItem value="monthly" id="r2" />
                        <Label htmlFor="r2">Monthly</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                        <RadioGroupItem value="quarterly" id="r3" />
                        <Label htmlFor="r3">Quarterly</Label>
                        </div>
                    </RadioGroup>
                    </div>

                    {(reportType !== 'all') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/50">
                            <div className="flex flex-col space-y-2">
                            <Label htmlFor="year-select">Year</Label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger id="year-select">
                                        <SelectValue placeholder="Select year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map(year => (
                                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                            </Select>
                            </div>
                            {reportType === 'monthly' && (
                                <div className="flex flex-col space-y-2">
                                <Label htmlFor="month-select">Month</Label>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger id="month-select">
                                            <SelectValue placeholder="Select month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions.map(month => (
                                                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                </Select>
                                </div>
                            )}
                            {reportType === 'quarterly' && (
                                <div className="flex flex-col space-y-2">
                                <Label htmlFor="quarter-select">Quarter</Label>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger id="quarter-select">
                                            <SelectValue placeholder="Select quarter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {quarterOptions.map(q => (
                                                <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                </Select>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="category-filter">Category Filter</Label>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger id="category-filter">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Select "Judgment Debt Cases Only" to view monetary claim analytics.</p>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t">
                <Button onClick={handleGenerateReport} size="lg" disabled={isLoading}>Generate Report</Button>
            </div>
            
            {reportData && (
                 <div className="mt-8">
                     <Card>
                         <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>File Status Report</CardTitle>
                                    <CardDescription>
                                        {reportData.period} • {reportData.categoryFilter}
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                                    <Download className="mr-2 h-4 w-4" />
                                    CSV
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                                    <Download className="mr-2 h-4 w-4" />
                                    PDF
                                  </Button>
                                </div>
                            </div>
                         </CardHeader>
                         <CardContent className="space-y-12">
                             
                             {/* Financial Summary: Judgment Debt */}
                             {reportData.judgmentDebtSummary.totalCases > 0 && (
                                <div className="bg-red-50 border border-red-100 rounded-xl p-6 shadow-sm">
                                    <h3 className="text-sm font-bold flex items-center gap-2 text-red-800 uppercase tracking-widest mb-4">
                                        <Banknote className="h-5 w-5" />
                                        Judgment Debt Financial Summary
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div className="bg-white p-4 rounded-lg border shadow-inner">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Exposure (GHC)</p>
                                            <p className="text-2xl font-black text-red-600 tabular-nums">
                                                {formatCurrency(reportData.judgmentDebtSummary.totalAmountGHC, 'GHS')}
                                            </p>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border shadow-inner">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Exposure (USD)</p>
                                            <p className="text-2xl font-black text-blue-600 tabular-nums">
                                                {formatCurrency(reportData.judgmentDebtSummary.totalAmountUSD, 'USD')}
                                            </p>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border shadow-inner">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cases Identified</p>
                                            <p className="text-2xl font-black text-slate-800 tabular-nums">
                                                {reportData.judgmentDebtSummary.totalCases}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-6 space-y-2">
                                        <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest">Debt Breakdown by Case:</p>
                                        <div className="rounded-md border bg-white overflow-hidden">
                                            <Table>
                                                <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[9px] uppercase">File No.</TableHead><TableHead className="text-[9px] uppercase">Amount (GHC)</TableHead><TableHead className="text-[9px] uppercase">Amount (USD)</TableHead><TableHead className="text-right text-[9px] uppercase">Assignee</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {reportData.judgmentDebtSummary.cases.map(c => (
                                                        <TableRow key={c.id}>
                                                            <TableCell className="text-xs font-bold font-mono">{c.fileNumber}</TableCell>
                                                            <TableCell className="text-xs font-bold text-red-700">{formatCurrency(c.amountGHC || c.amountInvolved, 'GHS')}</TableCell>
                                                            <TableCell className="text-xs font-bold text-blue-700">{formatCurrency(c.amountUSD, 'USD')}</TableCell>
                                                            <TableCell className="text-right text-xs text-muted-foreground">{c.assignedTo || 'Unassigned'}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                             )}

                             <div>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <FileIcon className="h-5 w-5 text-primary" />
                                    Summary by Category
                                </h3>
                                {Object.keys(reportData.summary).length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Category</TableHead>
                                                <TableHead className="text-right">Total Files</TableHead>
                                                <TableHead className="text-right">In Progress</TableHead>
                                                <TableHead className="text-right">Completed</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Object.entries(reportData.summary).map(([category, summary]) => (
                                                <TableRow key={category}>
                                                    <TableCell className="capitalize font-medium">{category}</TableCell>
                                                    <TableCell className="text-right">{summary.total}</TableCell>
                                                    <TableCell className="text-right">{summary.inProgress}</TableCell>
                                                    <TableCell className="text-right">{summary.completed}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                   <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
                                       <p className="text-muted-foreground">No data available for this criteria.</p>
                                   </div>
                                )}
                             </div>

                             <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Users className="h-5 w-5 text-primary" />
                                        Attorney Workload Analysis (Dashboard Only)
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                    <div className="rounded-md border p-4 bg-muted/30">
                                        {chartData.length > 0 ? (
                                            <ChartContainer config={workloadChartConfig} className="min-h-[300px] w-full">
                                                <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
                                                    <CartesianGrid horizontal={false} />
                                                    <XAxis type="number" hide />
                                                    <YAxis 
                                                        dataKey="name" 
                                                        type="category" 
                                                        tickLine={false} 
                                                        tickMargin={10} 
                                                        axisLine={false} 
                                                        width={100}
                                                        style={{ fontSize: '10px' }}
                                                    />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <ChartLegend content={<ChartLegendContent />} />
                                                    <Bar dataKey="inProgress" stackId="a" fill="var(--color-inProgress)" radius={[0, 0, 0, 0]} />
                                                    <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ChartContainer>
                                        ) : (
                                            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                                                No active assignments to chart.
                                            </div>
                                        )}
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead>Attorney</TableHead>
                                                    <TableHead className="text-center">Active</TableHead>
                                                    <TableHead className="text-center">Done</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {Object.entries(reportData.attorneyWorkload)
                                                    .sort(([,a], [,b]) => b.total - a.total)
                                                    .map(([name, data]) => (
                                                    <TableRow key={name} className={data.total === 0 ? "opacity-50" : ""}>
                                                        <TableCell className="font-medium text-xs">{name}</TableCell>
                                                        <TableCell className="text-center text-xs">{data.inProgress}</TableCell>
                                                        <TableCell className="text-center text-xs">{data.completed}</TableCell>
                                                        <TableCell className="text-right font-bold text-xs">{data.total}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                             </div>
                             
                             <div>
                                <h3 className="text-lg font-semibold mb-4">Detailed File List</h3>
                                {Object.keys(reportData.details).length > 0 ? (
                                <Accordion type="single" collapsible className="w-full">
                                    {Object.entries(reportData.details).map(([category, fileList]) => (
                                        <AccordionItem value={category} key={category}>
                                            <AccordionTrigger className="text-md font-medium capitalize">{category} ({fileList.length} files)</AccordionTrigger>
                                            <AccordionContent>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>File Number</TableHead>
                                                            <TableHead>Subject</TableHead>
                                                            <TableHead>Assigned To</TableHead>
                                                            <TableHead>Current Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {fileList.map(file => (
                                                            <TableRow key={file.id}>
                                                                <TableCell className="font-medium">{file.fileNumber}</TableCell>
                                                                <TableCell className="max-w-[200px] truncate">{file.subject}</TableCell>
                                                                <TableCell>{file.assignedTo || 'N/A'}</TableCell>
                                                                <TableCell>{file.currentStatus}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>

                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
                                       <FileIcon className="h-12 w-12 text-muted-foreground" />
                                       <h3 className="mt-4 text-lg font-semibold">No Files Found</h3>
                                        <p className="text-muted-foreground">No files match the selected criteria.</p>
                                    </div>
                                )}
                             </div>
                         </CardContent>
                     </Card>
                 </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </main>
  );
}
