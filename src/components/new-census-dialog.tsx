
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardList, Loader2, Calendar as CalendarIcon } from 'lucide-react';
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
import { createCensusRecord, updateCensusRecord } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import type { CensusRecord, CorrespondenceFile } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from './ui/calendar';
import { useUser } from '@/firebase';
import { useAuthAction } from '@/hooks/use-auth-action';

const FormSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: 'Date is required.' }),
  fileNumber: z.string().min(1, 'File number is required.'),
  suitNumber: z.string().optional(),
  subject: z.string().min(1, 'Subject is required.'),
  attorney: z.string().min(1, 'Attorney is required.'),
  userEmail: z.string().email(),
});

type FormData = z.infer<typeof FormSchema>;

const MandatoryLabel = ({ children }: { children: React.ReactNode }) => (
    <FormLabel>
      {children}
      <span className="text-red-500">*</span>
    </FormLabel>
);

interface NewCensusDialogProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  record?: CensusRecord | null;
  files: CorrespondenceFile[];
}

export function NewCensusDialog({ isOpen: controlledIsOpen, onOpenChange: controlledOnOpenChange, record, files }: NewCensusDialogProps) {
  const { user } = useUser();
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

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
          ? `The census record has been successfully updated.`
          : `The new census record has been successfully created.`,
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
  
  const { exec: authCreate, isLoading: isCreating } = useAuthAction(createCensusRecord, { onSuccess: handleSuccess });
  const { exec: authUpdate, isLoading: isUpdating } = useAuthAction(updateCensusRecord, { onSuccess: handleSuccess });
  const isLoading = isCreating || isUpdating;

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fileNumber: '',
      suitNumber: '',
      subject: '',
      attorney: '',
      userEmail: user?.email || '',
    },
  });

  React.useEffect(() => {
    if (isUpdateMode && record) {
      form.reset({
        id: record.id,
        date: new Date(record.date),
        fileNumber: record.fileNumber,
        suitNumber: record.suitNumber || '',
        subject: record.subject,
        attorney: record.attorney,
        userEmail: user?.email || '',
      });
    } else {
      form.reset({
        date: new Date(),
        fileNumber: '',
        suitNumber: '',
        subject: '',
        attorney: '',
        userEmail: user?.email || '',
      });
    }
  }, [record, isUpdateMode, form, isOpen, user]);

  const handleReset = () => {
    form.reset({
        date: new Date(),
        fileNumber: '',
        suitNumber: '',
        subject: '',
        attorney: '',
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
            <ClipboardList className="mr-2 h-4 w-4" />
            New Record
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isUpdateMode ? 'Edit Census Record' : 'Create New Census Record'}</DialogTitle>
          <DialogDescription>
             {isUpdateMode 
                ? 'Edit the details for the existing census record.'
                : 'Enter the details for the new census record.'}{' '}
             Fields with <span className="text-red-500">*</span> are mandatory.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('userEmail')} />
             <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <MandatoryLabel>Date</MandatoryLabel>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
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
                            fromYear={2000}
                            toYear={new Date().getFullYear()}
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                if (date) field.onChange(date);
                                setIsCalendarOpen(false);
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            </div>
            <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                    <FormItem>
                    <MandatoryLabel>Subject</MandatoryLabel>
                    <FormControl>
                        <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="attorney"
                render={({ field }) => (
                <FormItem>
                    <MandatoryLabel>Attorney</MandatoryLabel>
                    <FormControl>
                    <Input {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
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
