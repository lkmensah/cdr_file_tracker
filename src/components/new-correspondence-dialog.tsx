'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { addCorrespondence } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { CorrespondenceFile, CorrespondenceType } from '@/lib/types';
import { useUser } from '@/firebase';
import { useAuthAction } from '@/hooks/use-auth-action';

const FormSchema = z.object({
  date: z.date({ required_error: 'A date is required.' }),
  dateOnLetter: z.date().optional(),
  type: z.enum(['Incoming', 'Outgoing', 'Filing', 'Court Process', 'Memo'], {
    required_error: 'You need to select a correspondence type.',
  }),
  fileNumber: z.string().optional(),
  suitNumber: z.string().optional(),
  subject: z.string().min(1, 'Subject is required.'),
  recipient: z.string().min(1, 'This field is required.'),
  signedBy: z.string().optional(),
  documentNo: z.string().optional(),
  remarks: z.string().optional(),
  processType: z.string().optional(),
  serviceAddress: z.string().optional(),
  userEmail: z.string().email(),
}).refine(data => {
    if ((data.type === 'Incoming' || data.type === 'Court Process') && !data.documentNo) {
        return false;
    }
    return true;
}, {
    message: 'Document number is required.',
    path: ['documentNo'],
}).refine(data => {
    if ((data.type === 'Outgoing' || data.type === 'Filing' || data.type === 'Memo') && !data.fileNumber) {
        return false;
    }
    return true;
}, {
    message: 'File number is required for this correspondence type.',
    path: ['fileNumber'],
}).refine(data => {
    if (data.type === 'Court Process' && !data.dateOnLetter) {
        return true;
    }
    return true;
}, {
    message: 'Hearing date is required.',
    path: ['dateOnLetter'],
});


type FormData = z.infer<typeof FormSchema>;

const MandatoryLabel = ({ children }: { children: React.ReactNode }) => (
    <FormLabel>
      {children}
      <span className="text-red-500">*</span>
    </FormLabel>
  );

interface NewCorrespondenceDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    existingFile: CorrespondenceFile | null;
}

export function NewCorrespondenceDialog({ isOpen, onOpenChange, existingFile }: NewCorrespondenceDialogProps) {
  const { user } = useUser();
  const [isDatePopoverOpen, setIsDatePopoverOpen] = React.useState(false);
  const [isDateOnLetterPopoverOpen, setIsDateOnLetterPopoverOpen] = React.useState(false);
  const { toast } = useToast();
  
  const handleSuccess = (result: any) => {
    if (result && result.message.includes('Success')) {
      const data = form.getValues();
      toast({
        title: `Correspondence Added`,
        description: `The new correspondence "${data.subject}" has been successfully saved.`,
      });
      onOpenChange(false);
      handleReset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result?.error,
      });
    }
  };

  const { exec: authAddCorrespondence, isLoading } = useAuthAction(addCorrespondence, { onSuccess: handleSuccess });


  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      date: new Date(),
      type: 'Incoming',
      subject: '',
      fileNumber: '',
      suitNumber: '',
      recipient: '',
      signedBy: '',
      documentNo: '',
      remarks: '',
      processType: '',
      serviceAddress: '',
      userEmail: user?.email || '',
    },
  });

  React.useEffect(() => {
    if (existingFile) {
        form.setValue('fileNumber', existingFile.fileNumber);
        form.setValue('suitNumber', existingFile.suitNumber);
    }
    form.setValue('userEmail', user?.email || '');
  }, [existingFile, form, isOpen, user]);


  const correspondenceType = form.watch('type');

  const getDynamicRecipientProps = () => {
    switch (correspondenceType) {
      case 'Outgoing':
        return { label: 'Addressee' };
      case 'Filing':
      case 'Court Process':
        return { label: 'Court' };
      case 'Memo':
        return { label: 'To' };
      default: // Incoming
        return { label: 'Sender' };
    }
  };

  const { label: dynamicRecipientLabel } = getDynamicRecipientProps();

  const getDynamicDateLabel = () => {
    switch (correspondenceType) {
      case 'Outgoing':
        return 'Date Dispatched';
      case 'Filing':
        return 'Date Filed';
      case 'Court Process':
        return 'Date Received';
       case 'Memo':
        return 'Date';
      default: // Incoming
        return 'Date Received';
    }
  };
  const dynamicDateLabel = getDynamicDateLabel();


  const handleReset = () => {
    form.reset({
        date: new Date(),
        type: 'Incoming',
        subject: '',
        fileNumber: existingFile?.fileNumber ?? '',
        suitNumber: existingFile?.suitNumber ?? '',
        recipient: '',
        signedBy: '',
        documentNo: '',
        remarks: '',
        processType: '',
        serviceAddress: '',
        userEmail: user?.email || '',
    });
  };

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
          if (key === 'processType' && correspondenceType !== 'Filing' && correspondenceType !== 'Court Process') {
            return;
          }
           if (key === 'dateOnLetter' && correspondenceType !== 'Incoming' && correspondenceType !== 'Outgoing' && correspondenceType !== 'Court Process') {
            return;
          }
           if (key === 'signedBy' && correspondenceType !== 'Outgoing' && correspondenceType !== 'Memo') {
            return;
          }
          if (key === 'serviceAddress' && correspondenceType !== 'Filing') {
            return;
          }
          formData.append(key, value instanceof Date ? format(value, 'yyyy-MM-dd') : String(value));
      }
    });

    await authAddCorrespondence(formData);
  };

  const dialogTitle = `Add Correspondence to File: ${existingFile?.fileNumber}`;
  const dialogDescription = `Enter the metadata for the new letter, document, or court process. Fields with * are mandatory.`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) handleReset();
    }}>
      <DialogContent className="w-[min(640px,95vw)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
             {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 [&_*]:min-w-0">
            <input type="hidden" {...form.register('userEmail')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
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
                name="type"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <MandatoryLabel>Type of Correspondence</MandatoryLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Incoming">Incoming Mail</SelectItem>
                        <SelectItem value="Outgoing">Outgoing Mail</SelectItem>
                        <SelectItem value="Filing">Filing Process</SelectItem>
                        <SelectItem value="Court Process">Court Process</SelectItem>
                        <SelectItem value="Memo">Memo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <MandatoryLabel>{dynamicDateLabel}</MandatoryLabel>
                    <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
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
                            setIsDatePopoverOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(correspondenceType === 'Incoming' || correspondenceType === 'Outgoing' || correspondenceType === 'Court Process') && (
                <FormField
                  control={form.control}
                  name="dateOnLetter"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      {correspondenceType === 'Court Process' ? <FormLabel>Hearing Date</FormLabel> : <FormLabel>Date on Letter</FormLabel>}
                      <Popover open={isDateOnLetterPopoverOpen} onOpenChange={setIsDateOnLetterPopoverOpen}>
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
                                field.onChange(date);
                                setIsDateOnLetterPopoverOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {(correspondenceType === 'Incoming' || correspondenceType === 'Court Process') && (
                <FormField
                  control={form.control}
                  name="documentNo"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <MandatoryLabel>Document No.</MandatoryLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
               )}
              <FormField
                control={form.control}
                name="recipient"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <MandatoryLabel>{dynamicRecipientLabel}</MandatoryLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {correspondenceType === 'Memo' && (
                <FormField
                  control={form.control}
                  name="signedBy"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>From</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {correspondenceType === 'Outgoing' && (
                <FormField
                  control={form.control}
                  name="signedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signed By</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
               {correspondenceType === 'Filing' && (
                <FormField
                  control={form.control}
                  name="processType"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Type of Process</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {correspondenceType === 'Court Process' && (
                <FormField
                  control={form.control}
                  name="processType"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Type of Process</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
               {correspondenceType === 'Filing' && (
                  <FormField
                    control={form.control}
                    name="serviceAddress"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Service Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
               )}
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Correspondence
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
