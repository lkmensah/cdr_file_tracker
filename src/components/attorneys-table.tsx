
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
import { Users, Phone, Mail, MoreHorizontal, Pencil, MessageCircle, ShieldCheck, Crown, User, HandIcon, ShieldAlert, SmartphoneNfc, Loader2, Ban, Unlock, Activity } from 'lucide-react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/dropdown-menu';
import { useAuthAction } from '@/hooks/use-auth-action';
import { resetDeviceBinding, toggleAttorneyBlock } from '@/app/actions/attorney';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from './auth-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';
import { differenceInMinutes } from 'date-fns';

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
};

export function AttorneysTable({ attorneys, onEdit }: { attorneys: Attorney[], onEdit: (a: Attorney) => void }) {
  const { toast } = useToast();
  const { isAdmin } = useProfile();
  const [resetTarget, setResetTarget] = React.useState<Attorney | null>(null);
  const [blockTarget, setBlockTarget] = React.useState<Attorney | null>(null);

  const { exec: authReset, isLoading: isResetting } = useAuthAction(resetDeviceBinding, {
    onSuccess: (res) => {
        toast({ title: res.message });
        setResetTarget(null);
    }
  });

  const { exec: authToggleBlock, isLoading: isBlocking } = useAuthAction(toggleAttorneyBlock, {
    onSuccess: (res) => {
        toast({ title: res.message });
        setBlockTarget(null);
    }
  });

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
    <>
    <div className="w-full overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead>Access ID</TableHead>
            <TableHead>Rank</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Contact Info</TableHead>
            <TableHead className="w-[50px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attorneys.map(attorney => {
            const lastActive = toDate(attorney.lastActiveAt);
            const isOnline = lastActive && differenceInMinutes(new Date(), lastActive) < 5;
            
            return (
            <TableRow key={attorney.id} className={cn(attorney.isBlocked && "bg-destructive/5 opacity-80")}>
              <TableCell className="px-2 text-center">
                <div className="flex justify-center">
                    <div className={cn(
                        "h-2.5 w-2.5 rounded-full ring-2 ring-background transition-colors duration-500",
                        attorney.isBlocked ? "bg-destructive" : isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"
                    )} title={attorney.isBlocked ? "Blocked" : isOnline ? "Active Now" : "Offline"} />
                </div>
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(attorney.isBlocked && "line-through text-muted-foreground")}>{attorney.fullName}</span>
                    {attorney.isBlocked && (
                        <Badge variant="destructive" className="h-4 px-1.5 py-0 text-[8px] uppercase font-black tracking-widest">Blocked</Badge>
                    )}
                    {attorney.isSG && (
                        <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-600 gap-1 h-5 px-1.5 py-0">
                            <Crown className="h-3 w-3" />
                            <span className="text-[9px] uppercase font-bold">Solicitor General</span>
                        </Badge>
                    )}
                    {attorney.isActingSG && (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-600 border-amber-600 gap-1 h-5 px-1.5 py-0">
                            <HandIcon className="h-3 w-3" />
                            <span className="text-[9px] uppercase font-bold">Acting SG</span>
                        </Badge>
                    )}
                    {attorney.isGroupHead && !attorney.isSG && !attorney.isActingSG && (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 gap-1 h-5 px-1.5 py-0">
                            <ShieldCheck className="h-3 w-3" />
                            <span className="text-[9px] uppercase font-bold">Group Head</span>
                        </Badge>
                    )}
                    {attorney.isActingGroupHead && !attorney.isSG && !attorney.isActingSG && (
                        <Badge className="bg-blue-500 text-white hover:bg-blue-600 border-blue-600 gap-1 h-5 px-1.5 py-0">
                            <ShieldAlert className="h-3 w-3" />
                            <span className="text-[9px] uppercase font-bold">Acting GH</span>
                        </Badge>
                    )}
                </div>
              </TableCell>
              <TableCell>
                {attorney.accessId ? (
                    <div className="flex items-center gap-2">
                        <code className="bg-primary/5 text-primary px-2 py-1 rounded text-xs font-bold border border-primary/10">
                            {attorney.accessId}
                        </code>
                        {attorney.boundUid && (
                            <Badge variant="outline" className="h-4 px-1 py-0 border-blue-200 text-blue-600 bg-blue-50 text-[8px] uppercase font-black" title="Locked to a specific device/browser">Device Locked</Badge>
                        )}
                    </div>
                ) : (
                    <span className="text-muted-foreground text-[10px] italic">Needs Setup</span>
                )}
              </TableCell>
              <TableCell>
                {attorney.rank ? (
                    <Badge variant="outline" className="font-normal">{attorney.rank}</Badge>
                ) : (
                    <Badge variant="secondary" className="font-bold text-[10px] uppercase bg-muted text-muted-foreground">Practitioner</Badge>
                )}
              </TableCell>
              <TableCell>
                {attorney.group ? (
                    <span className="text-sm font-medium">{attorney.group}</span>
                ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground italic text-xs">
                        <User className="h-3 w-3" />
                        <span>no group yet</span>
                    </div>
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
                        
                        {isAdmin && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setBlockTarget(attorney)} className={cn(attorney.isBlocked ? "text-green-600" : "text-destructive")}>
                                    {attorney.isBlocked ? (
                                        <>
                                            <Unlock className="mr-2 h-4 w-4" /> Unblock Portal
                                        </>
                                    ) : (
                                        <>
                                            <Ban className="mr-2 h-4 w-4" /> Block Portal Access
                                        </>
                                    )}
                                </DropdownMenuItem>
                                {attorney.boundUid && (
                                    <DropdownMenuItem onClick={() => setResetTarget(attorney)} className="text-blue-600 focus:text-blue-700">
                                        <SmartphoneNfc className="mr-2 h-4 w-4" /> Reset Device Access
                                    </DropdownMenuItem>
                                )}
                            </>
                        )}

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
          )})}
        </TableBody>
      </Table>
    </div>

    <AlertDialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Reset Device Binding?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove the current security lock for <strong>{resetTarget?.fullName}</strong>. 
                    They will be able to log in to the portal from a different device, which will then become their new "locked" device.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => resetTarget && authReset(resetTarget.id)} disabled={isResetting} className="bg-blue-600 hover:bg-blue-700">
                    {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm Reset
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!blockTarget} onOpenChange={(open) => !open && setBlockTarget(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{blockTarget?.isBlocked ? 'Restore Access?' : 'Block Portal Access?'}</AlertDialogTitle>
                <AlertDialogDescription>
                    {blockTarget?.isBlocked 
                        ? `Restore workspace access for ${blockTarget?.fullName}. They will be able to log in immediately.`
                        : `This will immediately disconnect ${blockTarget?.fullName} from the portal and prevent any further logins until unblocked.`
                    }
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isBlocking}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={() => blockTarget && authToggleBlock(blockTarget.id, !blockTarget.isBlocked)} 
                    disabled={isBlocking} 
                    className={blockTarget?.isBlocked ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
                >
                    {isBlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {blockTarget?.isBlocked ? 'Unblock Access' : 'Confirm Block'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
