'use client';

import type { AuditLog } from '@/lib/types';
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, BookUser } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (!isNaN(new Date(value).getTime())) return new Date(value);
    return null;
};

export function AuditLogPage({ initialLogs }: { initialLogs: AuditLog[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
    if (!searchTerm) {
      return initialLogs;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return initialLogs.filter(
      (log) =>
        (log.userName && log.userName.toLowerCase().includes(lowercasedTerm)) ||
        log.action.toLowerCase().includes(lowercasedTerm) ||
        log.details.toLowerCase().includes(lowercasedTerm)
    );
  }, [searchTerm, initialLogs]);

  return (
    <div className="container mx-auto">
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>A record of all user activities within the system.</CardDescription>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, action, or details..."
              className="w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const timestamp = toDate(log.timestamp);
                    return (
                    <TableRow key={log.id}>
                      <TableCell>{timestamp ? format(timestamp, 'Pp') : 'N/A'}</TableCell>
                      <TableCell>{log.userName}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{log.action}</span>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{log.details}</TableCell>
                    </TableRow>
                  )})
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <BookUser className="h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">No Logs Found</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          There are no audit log entries matching your search.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
