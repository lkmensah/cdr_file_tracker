'use client';

import * as React from 'react';
import type { CorrespondenceFile, Letter, ArchiveRecord, CensusRecord } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, FileText, Mail, Scale, Archive, ClipboardList, Folder, CheckCircle2, Truck, Clock } from 'lucide-react';
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

export type AllData = {
  files: CorrespondenceFile[];
  incomingMail: Letter[];
  courtProcesses: Letter[];
  archives: ArchiveRecord[];
  censusRecords: CensusRecord[];
};

type SearchResults = {
  files: CorrespondenceFile[];
  incomingMail: Letter[];
  courtProcesses: Letter[];
  archives: ArchiveRecord[];
  censusRecords: CensusRecord[];
};

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
    return null;
};

export function GlobalSearchPage({ allData }: { allData: AllData }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setResults(null);
      return;
    }
    setIsSearching(true);
    const lowercasedTerm = searchTerm.toLowerCase();

    const filteredFiles = allData.files.filter(file =>
      Object.values(file).some(value => 
        String(value).toLowerCase().includes(lowercasedTerm)
      ) || file.letters.some(l => Object.values(l).some(v => String(v).toLowerCase().includes(lowercasedTerm)))
        || (file.movements && file.movements.some(m => Object.values(m).some(v => String(v).toLowerCase().includes(lowercasedTerm))))
    );

    const filteredIncomingMail = allData.incomingMail.filter(letter =>
      Object.values(letter).some(value => String(value).toLowerCase().includes(lowercasedTerm))
    );

    const filteredCourtProcesses = allData.courtProcesses.filter(letter =>
      Object.values(letter).some(value => String(value).toLowerCase().includes(lowercasedTerm))
    );

    const filteredArchives = allData.archives.filter(record =>
      Object.values(record).some(value => String(value).toLowerCase().includes(lowercasedTerm))
    );

    const filteredCensusRecords = allData.censusRecords.filter(record =>
      Object.values(record).some(value => String(value).toLowerCase().includes(lowercasedTerm))
    );

    setResults({
      files: filteredFiles,
      incomingMail: filteredIncomingMail,
      courtProcesses: filteredCourtProcesses,
      archives: filteredArchives,
      censusRecords: filteredCensusRecords,
    });
    setIsSearching(false);
  };
  
  const totalResults = results 
    ? Object.values(results).reduce((sum, array) => sum + array.length, 0)
    : 0;

  const ResultSection = ({ title, count, icon: Icon, children, link }: { title: string, count: number, icon: React.ElementType, children: React.ReactNode, link: string }) => {
    if (count === 0) return null;
    return (
        <Card>
            <CardHeader>
                <div className='flex justify-between items-center'>
                    <CardTitle className='flex items-center gap-2'>
                        <Icon className="h-6 w-6" />
                        {title} ({count})
                    </CardTitle>
                    <Button variant="link" asChild>
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
      <Card>
        <CardHeader>
          <CardTitle>Global Search</CardTitle>
          <CardDescription>Search across all records in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-grow"
              placeholder="Search by file number, subject, attorney..."
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              <Search className="mr-2 h-4 w-4" />
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {results && (
        <Card>
            <CardHeader>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>Found {totalResults} results for "{searchTerm}"</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
                {totalResults === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
                        <p className="text-muted-foreground">No results found.</p>
                    </div>
                ) : (
                    <>
                        <ResultSection title="Files" count={results.files.length} icon={Folder} link="/files">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[120px]">File Number</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead className="w-[150px]">Category</TableHead>
                                        <TableHead className="w-[180px]">Current Location</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.files.map(file => {
                                      const latestMovement = [...(file.movements || [])].sort((a, b) => {
                                          const timeA = toDate(a.date)?.getTime() || 0;
                                          const timeB = toDate(b.date)?.getTime() || 0;
                                          if (timeB !== timeA) return timeB - timeA;
                                          return b.id.localeCompare(a.id);
                                      })[0];
                                      return (
                                        <TableRow key={file.id}>
                                            <TableCell className="font-medium whitespace-nowrap">{file.fileNumber}</TableCell>
                                            <TableCell className="max-w-0">
                                                <p className="truncate" title={file.subject}>{file.subject}</p>
                                            </TableCell>
                                            <TableCell className="text-sm truncate max-w-[140px]" title={file.category}>{file.category}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 py-1">
                                                    <span className="font-semibold text-sm truncate max-w-[150px]" title={latestMovement?.movedTo ?? 'Registry'}>
                                                        {latestMovement?.movedTo ?? 'Registry'}
                                                    </span>
                                                    {latestMovement && (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                <span className="whitespace-nowrap">Moved: {format(toDate(latestMovement.date)!, 'MMM d, p')}</span>
                                                            </div>
                                                            {latestMovement.receivedAt ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 px-1.5 py-0 text-[10px] w-fit gap-1 font-medium">
                                                                        <CheckCircle2 className="h-2.5 w-2.5" /> Received
                                                                    </Badge>
                                                                    <span className="text-[10px] text-green-700 font-medium whitespace-nowrap ml-1">
                                                                        At: {format(toDate(latestMovement.receivedAt)!, 'MMM d, p')}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 px-1.5 py-0 text-[10px] w-fit gap-1 font-medium italic">
                                                                    <Truck className="h-2.5 w-2.5" /> In Transit
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                </TableBody>
                            </Table>
                        </ResultSection>

                        <ResultSection title="Incoming Mail" count={results.incomingMail.length} icon={Mail} link="/incoming-mail">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Date</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead className="w-[150px]">Document No</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.incomingMail.map(letter => (
                                        <TableRow key={letter.id}>
                                            <TableCell className="whitespace-nowrap">{format(toDate(letter.date)!, 'PPP')}</TableCell>
                                            <TableCell className="max-w-0">
                                                <p className="truncate" title={letter.subject}>{letter.subject}</p>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">{letter.documentNo}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                             </Table>
                        </ResultSection>

                        <ResultSection title="Court Processes" count={results.courtProcesses.length} icon={Scale} link="/court-processes">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Date</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead className="w-[150px]">Document No</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.courtProcesses.map(letter => (
                                        <TableRow key={letter.id}>
                                            <TableCell className="whitespace-nowrap">{format(toDate(letter.date)!, 'PPP')}</TableCell>
                                            <TableCell className="max-w-0">
                                                <p className="truncate" title={letter.subject}>{letter.subject}</p>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">{letter.documentNo}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                             </Table>
                        </ResultSection>

                        <ResultSection title="Archives" count={results.archives.length} icon={Archive} link="/archives">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">Box</TableHead>
                                        <TableHead className="w-[120px]">File Number</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead className="w-[120px]">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.archives.map(record => (
                                        <TableRow key={record.id}>
                                            <TableCell>{record.boxNumber}</TableCell>
                                            <TableCell className="whitespace-nowrap">{record.fileNumber}</TableCell>
                                            <TableCell className="max-w-0">
                                                <p className="truncate" title={record.title}>{record.title}</p>
                                            </TableCell>
                                            <TableCell className="truncate max-w-[110px]">{record.status}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ResultSection>
                        
                        <ResultSection title="Census Records" count={results.censusRecords.length} icon={ClipboardList} link="/census">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[120px]">File Number</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead className="w-[150px]">Attorney</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.censusRecords.map(record => (
                                        <TableRow key={record.id}>
                                            <TableCell className="whitespace-nowrap">{record.fileNumber}</TableCell>
                                            <TableCell className="max-w-0">
                                                <p className="truncate" title={record.subject}>{record.subject}</p>
                                            </TableCell>
                                            <TableCell className="truncate max-w-[140px]">{record.attorney}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ResultSection>
                    </>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
