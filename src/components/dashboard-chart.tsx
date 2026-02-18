"use client"

import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart"
import type { CorrespondenceFile } from "@/lib/types"
import { useMemo } from "react"
import { getYear } from "date-fns"

const chartConfig = {
  "civil cases (local)": {
    label: "Civil Cases (Local)",
    color: "hsl(var(--chart-1))",
  },
  "civil cases (int'l)": {
    label: "Civil Cases (Int'l)",
    color: "hsl(var(--chart-2))",
  },
  "garnishee": {
    label: "Garnishee",
    color: "hsl(var(--chart-3))",
  },
  "notice of intention": {
    label: "Notice of Intention",
    color: "hsl(var(--chart-4))",
  },
  "petition": {
    label: "Petition",
    color: "hsl(var(--chart-5))",
  },
  "mou": {
    label: "MOU",
    color: "hsl(var(--chart-2))",
  },
  "contract/agreement": {
    label: "Contract/Agreement",
    color: "hsl(var(--chart-3))",
  },
  "legal advice/opinion": {
    label: "Legal Advice/Opinion",
    color: "hsl(var(--chart-4))",
  },
  "arbitration (int'l)": {
    label: "Arbitration (Int'l)",
    color: "hsl(var(--chart-5))",
  },
  "arbitration (local)": {
    label: "Arbitration (Local)",
    color: "hsl(var(--chart-1))",
  },
  "international organisations/associations": {
    label: "Int'l Organisations/Associations",
    color: "hsl(var(--chart-2))",
  },
  "miscellaneous": {
    label: "Miscellaneous",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    if (!isNaN(new Date(value).getTime())) return new Date(value);
    return null;
};

export function DashboardChart({ files }: { files: CorrespondenceFile[] }) {

  const chartData = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    const currentYear = getYear(new Date());

    files.forEach(file => {
        const fileDate = toDate(file.dateCreated);
        if (!fileDate || getYear(fileDate) !== currentYear) {
            return;
        }

        const category = file.category?.toLowerCase();
        if (category && category in chartConfig) {
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
    });

    return Object.entries(categoryCounts)
        .map(([name, value]) => ({
            name,
            value,
            fill: chartConfig[name as keyof typeof chartConfig]?.color || "hsl(var(--chart-1))"
        }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

  }, [files]);


  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Files Distribution - {new Date().getFullYear()}</CardTitle>
        <CardDescription>Breakdown of new files by category</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {chartData.length > 0 ? (
            <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[350px]"
            >
            <PieChart>
                <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                strokeWidth={5}
                >
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} className="-translate-y-2 flex-wrap" />
            </PieChart>
            </ChartContainer>
        ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm italic">
                No files recorded for the current year.
            </div>
        )}
      </CardContent>
    </Card>
  )
}
