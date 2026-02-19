'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Archive, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createArchiveRecord, updateArchiveRecord } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import type { ArchiveRecord } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from './ui/calendar';
import { useUser } from '@/firebase';
import { useAuthAction } from '@/hooks/use-auth-action';

const FormSchema = z.object({
  id: z.string().optional(),
  boxNumber: z.string().min(1, 'Box number is required.'),
  fileNumber: z.string().min(1, 'File number is required.'),
  suitNumber: z.string().optional(),
  title: z.string().min(1, 'Title is required.'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.string().min(1, 'Status is required.'),
  userEmail: z.string().email(),
});

type FormData = z.infer<typeof FormSchema>;

const MandatoryLabel = ({ children }: { children: React.ReactNode }) => (
    <FormLabel>
      {children}
      <span className="text-red-500">*</span>
    </FormLabel>
);

interface NewArchiveDialogProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  record?: ArchiveRecord | null;
}

export function NewArchiveDialog({ isOpen: controlledIsOpen, onOpenChange: controlledOnOpenChange, record }: NewArchiveDialogProps) {
  const { user } = useUser();
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = React.useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = React.useState(false);
  
  const isControlled = controlledIsOpen !== undefined && controlledOnOpenChange !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange : setInternalIsOpen;
  
  const isUpdateMode = !!record;
  const { toast } = useToast();

  const handleSuccess = (result: any) => {
    if (result && result.message.includes('Success')) {
      toast({
        title: isUpdateMode ? 'Record Updated' : `Record Created`,
        description: isUpdateMode 
          ? `The archive record has been successfully updated.`
          : `The new archive record has been successfully created.`,
      });
      setIsOpen(false);
      if(!isUpdateMode) handleReset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result?.message,
      });
    }
  };

  const { exec: authCreate, isLoading: isCreating } = useAuthAction(createArchiveRecord, { onSuccess: handleSuccess });
  const { exec: authUpdate, isLoading: isUpdating } = useAuthAction(updateArchiveRecord, { onSuccess: handleSuccess });
  const isLoading = isCreating || isUpdating;

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      boxNumber: '',
      fileNumber: '',
      suitNumber: '',
      title: '',
      status: '',
      userEmail: user?.email || '',
    },
  });

  React.useEffect(() => {
    if (isUpdateMode && record) {
      form.reset({
        id: record.id,
        boxNumber: record.boxNumber,
        fileNumber: record.fileNumber,
        suitNumber: record.suitNumber || '',
        title: record.title,
        startDate: record.startDate ? new Date(record.startDate) : undefined,
        endDate: record.endDate ? new Date(record.endDate) : undefined,
        status: record.status,
        userEmail: user?.email || '',
      });
    } else {
      form.reset({
        boxNumber: '',
        fileNumber: '',
        suitNumber: '',
        title: '',
        status: '',
        startDate: undefined,
        endDate: undefined,
        userEmail: user?.email || '',
      });
    }
  }, [record, isUpdateMode, form, isOpen, user]);


  const handleReset = () => {
    form.reset({
        boxNumber: '',
        fileNumber: '',
        suitNumber: '',
        title: '',
        status: '',
        startDate: undefined,
        endDate: undefined,
        userEmail: user?.email || '',
    });
  };

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
          formData.append(key, value instanceof Date ? format(value, 'yyyy-MM-dd') : String(value));
      }
    });

    const action = isUpdateMode ? authUpdate : authCreate;
    await action(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) handleReset();
    }}>
      {!isUpdateMode && (
        <DialogTrigger asChild>
          <Button>
            <Archive className="mr-2 h-4 w-4" />
            New Archive
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isUpdateMode ? 'Edit Archive Record' : 'Create New Archive Record'}</DialogTitle>
          <DialogDescription>
             {isUpdateMode 
                ? 'Edit the details for the existing archive record.'
                : 'Enter the details for the new archive record.'}{' '}
             Fields with <span className="text-red-500">*</span> are mandatory.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('userEmail')} />
            <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                    <MandatoryLabel>Title/Subject</MandatoryLabel>
                    <FormControl>
                        <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="boxNumber"
                render={({ field }) => (
                  <FormItem>
                    <MandatoryLabel>Box Number</MandatoryLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="fileNumber"
                render={({ field }) => (
                  <FormItem>
                    <MandatoryLabel>File Number</MandatoryLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="suitNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suit Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <MandatoryLabel>Status</MandatoryLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                 <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Covering Date (Start)</FormLabel>
                        <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={'outline'}
                                className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                                )}
                            >
                                {field.value ? (
                                format(field.value, 'PPP')
                                ) : (
                                <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                captionLayout="dropdown-buttons"
                                fromYear={1950}
                                toYear={new Date().getFullYear()}
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                    field.onChange(date);
                                    setIsStartDatePopoverOpen(false);
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Covering Date (End)</FormLabel>
                        <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={'outline'}
                                className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                                )}
                            >
                                {field.value ? (
                                format(field.value, 'PPP')
                                ) : (
                                <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                captionLayout="dropdown-buttons"
                                fromYear={1950}
                                toYear={new Date().getFullYear()}
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                    field.onChange(date);
                                    setIsEndDatePopoverOpen(false);
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isUpdateMode ? 'Save Changes' : 'Create Record'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
