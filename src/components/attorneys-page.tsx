
'use client';

import type { Attorney } from '@/lib/types';
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Activity, Users, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AttorneysTable } from './attorneys-table';
import { NewAttorneyDialog } from './new-attorney-dialog';
import { differenceInMinutes } from 'date-fns';
import { Badge } from './ui/badge';

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
};

export function AttorneysPage({
  initialAttorneys,
}: {
  initialAttorneys: Attorney[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [attorneyToEdit, setAttorneyToEdit] = useState<Attorney | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredAttorneys = useMemo(() => {
    if (!searchTerm) return initialAttorneys;
    const term = searchTerm.toLowerCase();
    return initialAttorneys.filter(a =>
      a.fullName.toLowerCase().includes(term) ||
      (a.rank && a.rank.toLowerCase().includes(term)) ||
      (a.group && a.group.toLowerCase().includes(term)) ||
      (a.email && a.email.toLowerCase().includes(term))
    );
  }, [searchTerm, initialAttorneys]);

  const activeNowCount = useMemo(() => {
    return initialAttorneys.filter(a => {
        const lastActive = toDate(a.lastActiveAt);
        return lastActive && differenceInMinutes(new Date(), lastActive) < 10 && !a.isBlocked;
    }).length;
  }, [initialAttorneys]);

  const blockedCount = useMemo(() => {
    return initialAttorneys.filter(a => a.isBlocked).length;
  }, [initialAttorneys]);

  const handleEdit = (attorney: Attorney) => {
    setAttorneyToEdit(attorney);
    setIsDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setAttorneyToEdit(null);
  };

  return (
    <div className="container mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-sm border-primary/10">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Registry</p>
                        <p className="text-xl font-bold">{initialAttorneys.length}</p>
                    </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm border-primary/10">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-full">
                        <Activity className="h-5 w-5 text-green-600 animate-pulse" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Live Monitor</p>
                        <div className="flex items-center gap-2">
                            <p className="text-xl font-bold text-green-700">{activeNowCount}</p>
                            <Badge variant="secondary" className="bg-green-50 text-green-700 text-[8px] h-4">Online</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm border-primary/10">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-destructive/10 p-3 rounded-full">
                        <ShieldAlert className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Blocked Access</p>
                        <p className="text-xl font-bold text-destructive">{blockedCount}</p>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className='space-y-1'>
                        <CardTitle>Attorneys</CardTitle>
                        <CardDescription>A master registry of all legal practitioners and their workspace status.</CardDescription>
                    </div>
                    <div className="flex-shrink-0">
                        <NewAttorneyDialog 
                            isOpen={isDialogOpen && !attorneyToEdit}
                            onOpenChange={handleOpenChange}
                        />
                    </div>
                </div>
                <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, rank, group..."
                        className="w-full pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <AttorneysTable attorneys={filteredAttorneys} onEdit={handleEdit} />
            </CardContent>
        </Card>
        {isDialogOpen && attorneyToEdit && (
            <NewAttorneyDialog
                isOpen={isDialogOpen}
                onOpenChange={handleOpenChange}
                attorney={attorneyToEdit}
            />
        )}
    </div>
  );
}
