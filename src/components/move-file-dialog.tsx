'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Users, Briefcase, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { moveFile, batchMoveFiles } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { CorrespondenceFile, Attorney } from '@/lib/types';
import { Textarea } from './ui/textarea';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuthAction } from '@/hooks/use-auth-action';
import { Combobox } from './ui/combobox';
import { collection, query, orderBy } from 'firebase/firestore';
import { Separator } from './ui/separator';

const FormSchema = z.object({
  fileNumber: z.string().optional(),
  date: z.date({ required_error: 'A date is required.' }),
  movedTo: z.string().min(1, 'This field is required.'),
  status: z.string().min(1, 'Status is required.'),
  assignedTo: z.string().optional(),
  group: z.string().optional(),
  userEmail: z.string().email(),
});

type FormData = z.infer<typeof FormSchema>;

interface MoveFileDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    files: CorrespondenceFile[]; 
}

export function MoveFileDialog({ isOpen, onOpenChange, files }: MoveFileDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const { toast } = useToast();

  const isBatch = files.length > 1;

  const attorneysQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'attorneys'), orderBy('fullName', 'asc'));
    },
    [firestore]
  );
  const { data: attorneys } = useCollection<Attorney>(attorneysQuery);

  const attorneyOptions = React.useMemo(() => {
    const list = (attorneys || []).map(a => ({
        label: a.fullName,
        value: a.fullName
    }));
    if (!list.some(o => o.value === 'Registry')) {
        list.unshift({ label: 'Registry', value: 'Registry' });
    }
    return list;
  }, [attorneys]);

  const groupOptions = React.useMemo(() => {
    const groups = new Set<string>();
    attorneys?.forEach(a => { if (a.group) groups.add(a.group); });
    return Array.from(groups).map(g => ({ label: g, value: g }));
  }, [attorneys]);
  
  const handleSuccess = (result: any) => {
    if (result && result.message.includes('Success')) {
      const label = isBatch ? `${files.length} files` : `File "${files[0]?.fileNumber}"`;
      toast({ title: `Action Successful`, description: `${label} updated.` });
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result?.message || 'Failed to update.' });
    }
  };
  
  const { exec: authMoveSingle, isLoading: isMovingSingle } = useAuthAction(moveFile, { onSuccess: handleSuccess });
  const { exec: authMoveBatch, isLoading: isMovingBatch } = useAuthAction(batchMoveFiles, { onSuccess: handleSuccess });

  const isLoading = isMovingSingle || isMovingBatch;

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fileNumber: '',
      date: new Date(),
      movedTo: '',
      status: '',
      assignedTo: '',
      group: '',
      userEmail: user?.email || '',
    },
  });

  React.useEffect(() => {
    if (isOpen && files.length > 0) {
        form.reset({
            fileNumber: isBatch ? undefined : files[0].fileNumber,
            date: new Date(),
            movedTo: '',
            status: '',
            assignedTo: '',
            group: '',
            userEmail: user?.email || '',
        });
    }
  }, [files, form, isOpen, user, isBatch]);

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    
    let dateToSubmit = data.date;
    const now = new Date();
    if (
        dateToSubmit.getDate() === now.getDate() &&
        dateToSubmit.getMonth() === now.getMonth() &&
        dateToSubmit.getFullYear() === now.getFullYear() &&
        dateToSubmit.getHours() === 0 && dateToSubmit.getMinutes() === 0
    ) {
        dateToSubmit = now;
    }

    if (isBatch) {
        formData.append('fileNumbers', files.map(f => f.fileNumber).join(','));
        formData.append('date', dateToSubmit.toISOString());
        formData.append('movedTo', data.movedTo);
        formData.append('status', data.status);
        if (data.group) formData.append('group', data.group);
        if (data.assignedTo) formData.append('assignedTo', data.assignedTo);
        await authMoveBatch(formData);
    } else {
        formData.append('fileNumber', files[0].fileNumber);
        formData.append('date', dateToSubmit.toISOString());
        formData.append('movedTo', data.movedTo);
        formData.append('status', data.status);
        await authMoveSingle(formData);
    }
  };

  const dialogTitle = isBatch ? `Batch Move & Assign: ${files.length} Files` : `Move File: ${files[0]?.fileNumber}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(640px,95vw)] max-h-[90vh] overflow-visible">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="truncate">
            {isBatch 
                ? `Update location and ownership for ${files.length} records.`
                : 'Log the physical movement of this file to an attorney or office.'
            }
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 [&_*]:min-w-0 overflow-visible">
            <input type="hidden" {...form.register('userEmail')} />
            
            {isBatch && (
                <div className="space-y-4 bg-muted/30 p-4 rounded-lg border border-primary/10 overflow-visible">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" /> Batch Assignment (Optional)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
                        <FormField
                            control={form.control}
                            name="group"
                            render={({ field }) => (
                                <FormItem className="flex flex-col overflow-visible">
                                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Assigned Group</FormLabel>
                                    <div className="min-w-0">
                                        <Combobox
                                            options={groupOptions}
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select group..."
                                        />
                                    </div>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="assignedTo"
                            render={({ field }) => (
                                <FormItem className="flex flex-col overflow-visible">
                                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Lead Practitioner</FormLabel>
                                    <div className="min-w-0">
                                        <Combobox
                                            options={attorneyOptions.filter(o => o.value !== 'Registry')}
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select lead..."
                                        />
                                    </div>
                                </FormItem>
                            )}
                        />
                    </div>
                    <p className="text-[9px] text-muted-foreground italic flex items-start gap-1.5">
                        <Info className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                        Setting a group links these files to that Group Head's executive oversight dashboard.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 overflow-visible">
               <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Movement <span className="text-red-500">*</span></FormLabel>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={'outline'} className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={(date) => { if (date) field.onChange(date); setIsCalendarOpen(false); }} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="movedTo"
                render={({ field }) => (
                  <FormItem className="flex flex-col min-w-0 overflow-visible">
                    <FormLabel>Moving To <span className="text-red-500">*</span></FormLabel>
                    <div className="min-w-0">
                        <Combobox
                            options={attorneyOptions}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select destination..."
                            searchPlaceholder="Search registry..."
                        />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Status / Instructions <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Textarea placeholder="e.g. For Legal Advice, For Filing..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto h-11 px-8">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isBatch ? 'Update All Files' : 'Log Movement'}
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto h-11">
                    Cancel
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
