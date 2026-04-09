
'use client';

import * as React from 'react';
import type { CorrespondenceFile, Letter, ArchiveRecord, CensusRecord } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, FileText, Mail, Scale, Archive, ClipboardList, Folder, CheckCircle2, Truck, Clock, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { performGlobalSearch } from '@/app/actions';
import { useAuthAction } from '@/hooks/use-auth-action';

type SearchResults = {
  files: CorrespondenceFile[];
  incomingMail: Letter[];
  courtProcesses: Letter[];
  archives: ArchiveRecord[];
  censusRecords: CensusRecord[];
};

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value instanceof Date) return value;
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
    return null;
};

export function GlobalSearchPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const { exec: authSearch, isLoading: isSearching } = useAuthAction(performGlobalSearch);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    const data = await authSearch(searchTerm);
    if (data) setResults(data);
  };
  
  const totalResults = results 
    ? Object.values(results).reduce((sum, array) => sum + (array?.length || 0), 0)
    : 0;

  const ResultSection = ({ title, count, icon: Icon, children, link }: { title: string, count: number, icon: React.ElementType, children: React.ReactNode, link: string }) => {
    if (count === 0) return null;
    return (
        <Card className="shadow-sm">
            <CardHeader className="py-4">
                <div className='flex justify-between items-center'>
                    <CardTitle className='flex items-center gap-2 text-lg'>
                        <Icon className="h-5 w-5 text-primary" />
                        {title} ({count})
                    </CardTitle>
                    <Button variant="link" size="sm" asChild>
                        <Link href={link}>View All</Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    );
  };

  return (
    <div className="container mx-auto space-y-6">
      <Card className="shadow-md border-primary/10">
        <CardHeader>
          <CardTitle>Global Search</CardTitle>
          <CardDescription>Search files, mail, and archives by reference number or subject description.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-grow h-12 text-lg"
              placeholder="Enter file number, doc no, or subject keywords..."
            />
            <Button onClick={handleSearch} disabled={isSearching} className="h-12 px-8 min-w-[140px]">
              {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            Note: System searches across multiple collections. Results are limited to the top matches.
          </p>
        </CardContent>
      </Card>
      
      {results && (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500'>
            <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold">Search Results <span className="text-muted-foreground font-normal ml-2">({totalResults} items found)</span></h2>
            </div>
            
            {totalResults === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-32 text-center bg-background shadow-inner">
                    <AlertCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No records matched your search query.</p>
                    <p className="text-sm text-muted-foreground">Try a broader term or check for typos.</p>
                </div>
            ) : (
                <>
                    <ResultSection title="Files" count={results.files.length} icon={Folder} link="/files">
                        <div className="w-full overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader><TableRow className="bg-muted/30"><TableHead>File Number</TableHead><TableHead>Subject</TableHead><TableHead>Category</TableHead><TableHead>Location</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {results.files.map(file => {
                                      const latest = [...(file.movements || [])].sort((a,b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0))[0];
                                      return (
                                        <TableRow key={file.id}>
                                            <TableCell className="font-bold whitespace-nowrap">{file.fileNumber}</TableCell>
                                            <TableCell className="max-w-[300px] truncate">{file.subject}</TableCell>
                                            <TableCell className="text-xs uppercase font-medium">{file.category}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10">
                                                    {latest?.movedTo || 'Registry'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </ResultSection>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ResultSection title="Incoming Mail" count={results.incomingMail.length} icon={Mail} link="/incoming-mail">
                             <div className="w-full overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader><TableRow className="bg-muted/30"><TableHead>Doc No.</TableHead><TableHead>Subject</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {results.incomingMail.map(letter => (
                                            <TableRow key={letter.id}>
                                                <TableCell className="font-mono text-xs whitespace-nowrap font-bold">{letter.documentNo}</TableCell>
                                                <TableCell className="max-w-[200px] truncate text-xs">{letter.subject}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </div>
                        </ResultSection>

                        <ResultSection title="Court Processes" count={results.courtProcesses.length} icon={Scale} link="/court-processes">
                             <div className="w-full overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader><TableRow className="bg-muted/30"><TableHead>Doc No.</TableHead><TableHead>Subject</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {results.courtProcesses.map(letter => (
                                            <TableRow key={letter.id}>
                                                <TableCell className="font-mono text-xs whitespace-nowrap font-bold">{letter.documentNo}</TableCell>
                                                <TableCell className="max-w-[200px] truncate text-xs">{letter.subject}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </div>
                        </ResultSection>
                    </div>

                    <ResultSection title="Archives" count={results.archives.length} icon={Archive} link="/archives">
                        <div className="w-full overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader><TableRow className="bg-muted/30"><TableHead>Box</TableHead><TableHead>File Number</TableHead><TableHead>Title</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {results.archives.map(record => (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-bold">{record.boxNumber}</TableCell>
                                            <TableCell className="font-mono text-xs">{record.fileNumber}</TableCell>
                                            <TableCell className="max-w-[400px] truncate">{record.title}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </ResultSection>
                </>
            )}
        </div>
      )}
    </div>
  );
}
