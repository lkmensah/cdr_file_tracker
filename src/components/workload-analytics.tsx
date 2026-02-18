
'use client';

import * as React from 'react';
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
import { Users, AlertCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";

type AttorneySummary = {
  total: number;
  inProgress: number;
  completed: number;
};

const workloadChartConfig = {
  inProgress: {
    label: "In Progress",
    color: "hsl(var(--chart-1))",
  },
  completed: {
    label: "Completed (2025)",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
}

export function WorkloadAnalytics({ 
    files, 
    attorneys 
}: { 
    files: CorrespondenceFile[], 
    attorneys: Attorney[] 
}) {
  
  const analytics = React.useMemo(() => {
    const workload: Record<string, AttorneySummary> = {};
    const currentYear = new Date().getFullYear();

    // Initialize with all registered attorneys
    attorneys.forEach(attorney => {
        workload[attorney.fullName] = { total: 0, inProgress: 0, completed: 0 };
    });

    files.forEach(file => {
        if (!file.assignedTo) return;

        const assignedName = file.assignedTo.trim();
        const lowerName = assignedName.toLowerCase();
        
        // Skip registry totals for personal workload
        if (lowerName === 'registry') return;

        // Find exact case-sensitive name from registry if possible
        const matchingAttorney = attorneys.find(a => a.fullName.toLowerCase() === lowerName);
        const displayName = matchingAttorney ? matchingAttorney.fullName : assignedName;

        if (!workload[displayName]) {
            workload[displayName] = { total: 0, inProgress: 0, completed: 0 };
        }

        const isCompleted = file.status === 'Completed';
        const completionDate = toDate(file.completedAt);
        const completedThisYear = completionDate && completionDate.getFullYear() === currentYear;

        if (isCompleted) {
            // Only count completed if it happened in the current year for dashboard relevance
            if (completedThisYear) {
                workload[displayName].completed++;
                workload[displayName].total++;
            }
        } else {
            // Always count active files (All Time) as they represent current workload
            workload[displayName].inProgress++;
            workload[displayName].total++;
        }
    });

    const chartData = Object.entries(workload)
        .filter(([, data]) => data.total > 0)
        .map(([name, data]) => ({
            name,
            inProgress: data.inProgress,
            completed: data.completed,
        }))
        .sort((a, b) => (b.inProgress + b.completed) - (a.inProgress + a.completed));

    return { workload, chartData };
  }, [files, attorneys]);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Attorney Workload
                </CardTitle>
                <CardDescription>Active burden (All Time) vs. Resolved ({new Date().getFullYear()})</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-6">
        {analytics.chartData.length > 0 ? (
            <>
                <div className="rounded-md border p-4 bg-muted/10">
                    <ChartContainer config={workloadChartConfig} className="min-h-[250px] w-full">
                        <BarChart data={analytics.chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
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
                </div>
                <div className="rounded-md border overflow-hidden max-h-[200px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 sticky top-0 z-10">
                                <TableHead className="text-xs">Attorney</TableHead>
                                <TableHead className="text-center text-xs">Active</TableHead>
                                <TableHead className="text-center text-xs">Done ({new Date().getFullYear()})</TableHead>
                                <TableHead className="text-right text-xs">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(analytics.workload)
                                .filter(([, data]) => data.total > 0)
                                .sort(([,a], [,b]) => b.inProgress - a.inProgress)
                                .map(([name, data]) => (
                                <TableRow key={name}>
                                    <TableCell className="font-medium text-xs py-2">{name}</TableCell>
                                    <TableCell className="text-center text-xs py-2">{data.inProgress}</TableCell>
                                    <TableCell className="text-center text-xs py-2">{data.completed}</TableCell>
                                    <TableCell className="text-right font-bold text-xs py-2">{data.total}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
                <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground italic">No active file assignments found.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
