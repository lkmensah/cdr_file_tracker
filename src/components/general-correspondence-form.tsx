'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { addCorrespondence, updateUnassignedLetter, updateLetterInFile } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Letter, CorrespondenceType } from '@/lib/types';
import { useUser } from '@/firebase';
import { useAuthAction } from '@/hooks/use-auth-action';


const createFormSchema = (type: CorrespondenceType) => z.object({
  id: z.string().optional(),
  date: z.date({ required_error: 'A date is required.' }),
  dateOnLetter: z.date().optional(),
  hearingDate: z.date().optional(),
  type: z.literal(type),
  suitNumber: z.string().optional(),
  subject: z.string().min(1, 'Subject is required.'),
  recipient: z.string().min(1, 'This field is required.'),
  documentNo: z.string().min(1, 'Document number is required'),
  remarks: z.string().optional(),
  processType: z.string().optional(),
  scanUrl: z.string().optional(),
  userEmail: z.string().email(),
});

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

const MandatoryLabel = ({ children }: { children: React.ReactNode }) => (
    <FormLabel>
      {children}
      <span className="text-red-500">*</span>
    </FormLabel>
);

interface GeneralCorrespondenceFormProps {
    correspondenceType: 'Incoming' | 'Court Process';
    letterToEdit: Letter | null;
    onFormClose: () => void;
    fileNumber?: string; // Optional: if editing a letter ALREADY in a file
}

export function GeneralCorrespondenceForm({ correspondenceType, letterToEdit, onFormClose, fileNumber }: GeneralCorrespondenceFormProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const isUpdateMode = !!letterToEdit;
  
  const handleSuccess = (result: any) => {
     if (result && (result.letter || result.message?.includes('Success'))) {
      const data = form.getValues();
      toast({
        title: isUpdateMode ? `Item Updated` : `Item Logged`,
        description: `The item "${data.subject}" has been successfully ${isUpdateMode ? 'updated' : 'logged'}.`,
      });
      handleReset();
      onFormClose();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result?.error || result?.message || 'An unknown error occurred.',
      });
    }
  };
  
  const { exec: authAddCorrespondence, isLoading: isCreating } = useAuthAction(addCorrespondence, { onSuccess: handleSuccess });
  const { exec: authUpdateCorrespondence, isLoading: isUpdating } = useAuthAction(updateUnassignedLetter, { onSuccess: handleSuccess });
  
  const { exec: authUpdateInFile, isLoading: isUpdatingInFile } = useAuthAction(
    async (token, fileNum: string, letterId: string, data: FormData) => {
        const fd = new FormData();
        Object.entries(data).forEach(([k, v]) => {
            if (v !== undefined && v !== null) {
                fd.append(k, v instanceof Date ? format(v, 'yyyy-MM-dd') : String(v));
            }
        });
        return updateLetterInFile(token, fileNum, letterId, fd);
    }, 
    { onSuccess: handleSuccess }
  );

  const isLoading = isCreating || isUpdating || isUpdatingInFile;

  const [isDatePopoverOpen, setIsDatePopoverOpen] = React.useState(false);
  const [isDateOnLetterPopoverOpen, setIsDateOnLetterPopoverOpen] = React.useState(false);
  const [isHearingDatePopoverOpen, setIsHearingDatePopoverOpen] = React.useState(false);
  const formSchema = React.useMemo(() => createFormSchema(correspondenceType), [correspondenceType]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      type: correspondenceType,
      subject: '',
      suitNumber: '',
      recipient: '',
      documentNo: '',
      remarks: '',
      processType: '',
      scanUrl: '',
      userEmail: user?.email || '',
    },
  });

  const toDateSafe = (value: any) => {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }

  React.useEffect(() => {
    if (isUpdateMode && letterToEdit) {
        form.reset({
            id: letterToEdit.id,
            date: toDateSafe(letterToEdit.date) || new Date(),
            dateOnLetter: toDateSafe(letterToEdit.dateOnLetter),
            hearingDate: toDateSafe(letterToEdit.hearingDate),
            type: correspondenceType,
            subject: letterToEdit.subject,
            suitNumber: letterToEdit.suitNumber || '',
            recipient: letterToEdit.recipient,
            documentNo: letterToEdit.documentNo,
            remarks: letterToEdit.remarks || '',
            processType: letterToEdit.processType || '',
            scanUrl: letterToEdit.scanUrl || '',
            userEmail: user?.email || '',
        });
    } else {
        form.reset({
            id: undefined,
            date: new Date(),
            type: correspondenceType,
            subject: '',
            suitNumber: '',
            recipient: '',
            documentNo: '',
            remarks: '',
            processType: '',
            scanUrl: '',
            userEmail: user?.email || '',
        });
    }
  }, [correspondenceType, form, user, letterToEdit, isUpdateMode]);


  const dynamicRecipientLabel = correspondenceType === 'Incoming' ? 'Sender' : 'Court';

  const handleReset = () => {
    form.reset({
        id: undefined,
        type: correspondenceType,
        date: new Date(),
        dateOnLetter: undefined,
        hearingDate: undefined,
        subject: '',
        suitNumber: '',
        recipient: '',
        documentNo: '',
        remarks: '',
        processType: '',
        scanUrl: '',
        userEmail: user?.email || '',
    });
  };

  const onSubmit = async (data: FormData) => {
    if (fileNumber && isUpdateMode) {
        await authUpdateInFile(fileNumber, letterToEdit!.id, data);
        return;
    }

    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value instanceof Date ? format(value, 'yyyy-MM-dd') : String(value));
      }
    });

    if (isUpdateMode) {
        await authUpdateCorrespondence(formData);
    } else {
        await authAddCorrespondence(formData);
    }
  };

  return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col sm:col-span-2">
                    <MandatoryLabel>Date Received</MandatoryLabel>
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
                          fromYear={1950}
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
              {correspondenceType === 'Incoming' && (
                <FormField
                  control={form.control}
                  name="dateOnLetter"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:col-span-2">
                      <FormLabel>Date on Letter</FormLabel>
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
                            fromYear={1950}
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
              {correspondenceType === 'Court Process' && (
                <FormField
                  control={form.control}
                  name="hearingDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:col-span-2">
                      <FormLabel>Hearing Date</FormLabel>
                      <Popover open={isHearingDatePopoverOpen} onOpenChange={setIsHearingDatePopoverOpen}>
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
                            toYear={new Date().getFullYear() + 1}
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                field.onChange(date);
                                setIsHearingDatePopoverOpen(false);
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
                 <FormField
                  control={form.control}
                  name="suitNumber"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
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
                  name="documentNo"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <MandatoryLabel>Document No.</MandatoryLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <FormField
                control={form.control}
                name="scanUrl"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>SharePoint Scan Link</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription className="text-[10px]">
                        Link to the digital copy of the document.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            <div className="flex justify-end gap-2">
                {isUpdateMode && (
                    <Button type="button" variant="outline" onClick={() => { onFormClose(); handleReset(); }}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isUpdateMode ? 'Save Changes' : 'Log Item'}
                </Button>
            </div>
          </form>
        </Form>
  );
}
