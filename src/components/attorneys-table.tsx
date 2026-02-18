
'use client';

import * as React from 'react';
import type { Attorney } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Phone, Mail, MoreHorizontal, Pencil, MessageCircle, ShieldCheck, Crown } from 'lucide-react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/dropdown-menu';

export function AttorneysTable({ attorneys, onEdit }: { attorneys: Attorney[], onEdit: (a: Attorney) => void }) {

  const handleWhatsApp = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned) {
        window.open(`https://wa.me/${cleaned}`, '_blank');
    }
  };

  if (attorneys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No Attorneys Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">The registry is currently empty.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Full Name</TableHead>
            <TableHead>Access ID</TableHead>
            <TableHead>Rank</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Contact Info</TableHead>
            <TableHead className="w-[50px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attorneys.map(attorney => (
            <TableRow key={attorney.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                    {attorney.fullName}
                    {attorney.isSG && (
                        <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-600 gap-1 h-5 px-1.5 py-0">
                            <Crown className="h-3 w-3" />
                            <span className="text-[9px] uppercase font-bold">Solicitor General</span>
                        </Badge>
                    )}
                    {attorney.isGroupHead && !attorney.isSG && (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 gap-1 h-5 px-1.5 py-0">
                            <ShieldCheck className="h-3 w-3" />
                            <span className="text-[9px] uppercase font-bold">Group Head</span>
                        </Badge>
                    )}
                </div>
              </TableCell>
              <TableCell>
                {attorney.accessId ? (
                    <code className="bg-primary/5 text-primary px-2 py-1 rounded text-xs font-bold border border-primary/10">
                        {attorney.accessId}
                    </code>
                ) : (
                    <span className="text-muted-foreground text-[10px] italic">Needs Setup</span>
                )}
              </TableCell>
              <TableCell>
                {attorney.rank ? (
                    <Badge variant="outline" className="font-normal">{attorney.rank}</Badge>
                ) : (
                    <span className="text-muted-foreground text-xs italic">Not Set</span>
                )}
              </TableCell>
              <TableCell>
                {attorney.group ? (
                    <span className="text-sm">{attorney.group}</span>
                ) : (
                    <span className="text-muted-foreground text-xs italic">Not Set</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{attorney.email}</span>
                    </div>
                    {attorney.phoneNumber && (
                        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{attorney.phoneNumber}</span>
                        </div>
                    )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(attorney)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Details
                        </DropdownMenuItem>
                        {attorney.phoneNumber && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleWhatsApp(attorney.phoneNumber)}>
                                    <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                                    Message on WhatsApp
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
