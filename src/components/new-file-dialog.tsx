
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FolderPlus, Loader2, Calendar as CalendarIcon, Building2, Info, Users, Briefcase, Banknote } from 'lucide-react';
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
import { createFile, updateFile } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from './ui/combobox';
import { Textarea } from './ui/textarea';
import type { CorrespondenceFile, Attorney } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from './ui/calendar';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuthAction } from '@/hooks/use-auth-action';
import { Checkbox } from './ui/checkbox';
import { collection, query, orderBy } from 'firebase/firestore';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

const FormSchema = z.object({
  id: z.string().optional(),
  fileNumber: z.string().min(1, 'File number is required.'),
  suitNumber: z.string(),
  category: z.string().min(1, 'Category is required.'),
  group: z.string().min(1, 'Group is required.'),
  subject: z.string().min(1, 'Subject is required.'),
  dateCreated: z.date({ required_error: 'Date created is required.' }),
  assignedTo: z.string().optional(),
  coAssignees: z.array(z.string()).default([]),
  userEmail: z.string().email(),
  treatAsNew: z.boolean().optional(),
  isJudgmentDebt: z.boolean().optional(),
  amountGHC: z.string().optional(),
  amountUSD: z.string().optional(),
});

type FormData = z.infer<typeof FormSchema>;

const MandatoryLabel = ({ children }: { children: React.ReactNode }) => (
    <FormLabel>
      {children}
      <span className="text-red-500">*</span>
    </FormLabel>
);

const categories = [
    { value: 'civil cases (local)', label: 'Civil Cases (Local)' },
    { value: 'civil cases (int\'l)', label: 'Civil Cases (Int\'l)' },
    { value: 'civil cases (regions)', label: 'Civil Cases (Regions)' },
    { value: 'garnishee', label: 'Garnishee' },
    { value: 'notice of intention', label: 'Notice of Intention' },
    { value: 'petition', label: 'Petition' },
    { value: 'mou', label: 'MOU' },
    { value: 'contract/agreement', label: 'Contract/Agreement' },
    { value: 'legal advice/opinion', label: 'Legal Advice/Opinion' },
    { value: 'arbitration (int\'l)', label: 'Arbitration (Int\'l)' },
    { value: 'arbitration (local)', label: 'Arbitration (Local)' },
    { value: 'international organisations/associations', label: 'International Organisations/Associations' },
    { value: 'miscellaneous', label: 'Miscellaneous' },
];

interface NewFileProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  file?: CorrespondenceFile | null;
}

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    if (!isNaN(new Date(value).getTime())) return new Date(value);
    return null;
};

export function NewFile({ isOpen: controlledIsOpen, onOpenChange: controlledOnOpenChange, file }: NewFileProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  const isControlled = controlledIsOpen !== undefined && controlledOnOpenChange !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange : setInternalIsOpen;
  
  const isUpdateMode = !!file;
  const { toast } = useToast();

  const attorneysQuery = useMemoFirebase(
    () => {
        if (!firestore) return null;
        return query(collection(firestore, 'attorneys'), orderBy('fullName', 'asc'));
    },
    [firestore]
  );
  const { data: attorneys } = useCollection<Attorney>(attorneysQuery);

  const attorneyOptions = React.useMemo(() => {
    return (attorneys || []).map(a => ({
        label: a.fullName,
        value: a.fullName
    }));
  }, [attorneys]);

  const groupOptions = React.useMemo(() => {
    const groups = new Set<string>();
    attorneys?.forEach(a => {
        if (a.group) groups.add(a.group);
    });
    return Array.from(groups).map(g => ({ label: g, value: g }));
  }, [attorneys]);
  
  const handleActionSuccess = (result: any) => {
    if (result && result.message.includes('Success')) {
      toast({
        title: isUpdateMode ? 'File Updated' : `File Created`,
        description: isUpdateMode 
          ? `The file has been successfully updated.`
          : `The new file has been successfully created.`,
      });
      setIsOpen(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result?.message || 'Action failed.',
      });
    }
  };

  const { exec: authCreate, isLoading: isCreating } = useAuthAction(
    createFile,
    { onSuccess: handleActionSuccess }
  );
  const { exec: authUpdate, isLoading: isUpdating } = useAuthAction(
    updateFile,
    { onSuccess: handleActionSuccess }
  );

  const isLoading = isCreating || isUpdating;

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fileNumber: '',
      suitNumber: '',
      category: '',
      group: '',
      subject: '',
      assignedTo: '',
      coAssignees: [],
      userEmail: user?.email || '',
      treatAsNew: false,
      isJudgmentDebt: false,
      amountGHC: '',
      amountUSD: '',
    },
  });

  const selectedCategory = form.watch('category');
  const isJudgmentDebt = form.watch('isJudgmentDebt');
  const leadAssignee = form.watch('assignedTo');
  const coAssignees = form.watch('coAssignees');
  
  const showJudgmentDebtToggle = 
    selectedCategory === 'civil cases (local)' || 
    selectedCategory === 'civil cases (int\'l)' || 
    selectedCategory === 'civil cases (regions)';

  React.useEffect(() => {
    if (isOpen) {
      if (file) {
        form.reset({
          id: file.id,
          fileNumber: file.fileNumber,
          suitNumber: file.suitNumber,
          category: file.category,
          group: file.group || '',
          subject: file.subject,
          dateCreated: toDate(file.dateCreated) || new Date(),
          assignedTo: file.assignedTo || '',
          coAssignees: file.coAssignees || [],
          userEmail: user?.email || '',
          treatAsNew: false,
          isJudgmentDebt: file.isJudgmentDebt || false,
          amountGHC: file.amountGHC?.toString() || '',
          amountUSD: file.amountUSD?.toString() || '',
        });
      } else {
        form.reset({
          fileNumber: '',
          suitNumber: '',
          category: '',
          group: '',
          subject: '',
          dateCreated: new Date(),
          assignedTo: '',
          coAssignees: [],
          userEmail: user?.email || '',
          treatAsNew: false,
          isJudgmentDebt: false,
          amountGHC: '',
          amountUSD: '',
        });
      }
    }
  }, [file, isOpen, user, form]);

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
          if (key === 'treatAsNew' || key === 'isJudgmentDebt') {
            if (value === true) formData.append(key, 'on');
          } else if (key === 'coAssignees' && Array.isArray(value)) {
            formData.append(key, value.join(','));
          } else {
            formData.append(key, value instanceof Date ? format(value, 'yyyy-MM-dd') : String(value));
          }
      }
    });

    const action = isUpdateMode ? authUpdate : authCreate;
    await action(formData);
  };

  const handleToggleCoAssignee = (name: string) => {
    const current = form.getValues('coAssignees');
    if (current.includes(name)) {
        form.setValue('coAssignees', current.filter(n => n !== name));
    } else {
        form.setValue('coAssignees', [...current, name]);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isUpdateMode && (
        <DialogTrigger asChild>
          <Button>
            <FolderPlus className="mr-2 h-4 w-4" />
            New File
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isUpdateMode ? 'Edit File' : 'Create New File'}</DialogTitle>
          <DialogDescription>
             Update metadata, group ownership, or collaborative team assignments.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('userEmail')} />
            
            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-3 w-3" /> Case Metadata
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="dateCreated"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <MandatoryLabel>Date Created</MandatoryLabel>
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
                <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <MandatoryLabel>Category</MandatoryLabel>
                                <Combobox
                                    options={categories}
                                    value={field.value}
                                    onChange={(val) => {
                                        field.onChange(val);
                                        if (val !== 'civil cases (local)' && val !== 'civil cases (int\'l)' && val !== 'civil cases (regions)') {
                                            form.setValue('isJudgmentDebt', false);
                                            form.setValue('amountGHC', '');
                                            form.setValue('amountUSD', '');
                                        }
                                    }}
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {showJudgmentDebtToggle && (
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <FormField
                            control={form.control}
                            name="isJudgmentDebt"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between">
                                    <div className="space-y-0.5">
                                        <FormLabel className="flex items-center gap-2">
                                            <Banknote className="h-4 w-4 text-primary" />
                                            Judgment Debt Case
                                        </FormLabel>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Enable tracking for monetary claims against the state.</p>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {isJudgmentDebt && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95">
                                <FormField
                                    control={form.control}
                                    name="amountGHC"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Amount (GHC)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">GH₵</span>
                                                    <Input 
                                                        type="number" 
                                                        step="0.01" 
                                                        placeholder="0.00" 
                                                        className="pl-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                        onWheel={handleWheel}
                                                        {...field} 
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="amountUSD"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Amount (USD)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">$</span>
                                                    <Input 
                                                        type="number" 
                                                        step="0.01" 
                                                        placeholder="0.00" 
                                                        className="pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                        onWheel={handleWheel}
                                                        {...field} 
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </div>
                )}

                <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                    <FormItem>
                        <MandatoryLabel>Subject</MandatoryLabel>
                        <FormControl>
                        <Textarea {...field} className="min-h-[100px]" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <Separator />

            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Users className="h-3 w-3" /> Team Assignment & Oversight
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="group"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <MandatoryLabel>Assigned Group</MandatoryLabel>
                                <Combobox
                                    options={groupOptions}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Select group..."
                                    searchPlaceholder="Search groups..."
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="assignedTo"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Lead Practitioner</FormLabel>
                                <Combobox
                                    options={attorneyOptions}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Select lead..."
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Collaborative Team (Co-Assignees)</Label>
                    <div className="rounded-md border p-4 bg-muted/10 space-y-4">
                        <div className="flex flex-wrap gap-2 mb-2 min-h-8">
                            {coAssignees.length > 0 ? coAssignees.map(name => (
                                <Badge key={name} variant="secondary" className="gap-1 px-2 py-1 bg-primary/10 text-primary border-primary/20">
                                    {name}
                                    <button type="button" onClick={() => handleToggleCoAssignee(name)} className="hover:text-destructive">×</button>
                                </Badge>
                            )) : (
                                <span className="text-[10px] text-muted-foreground italic uppercase">No co-assignees selected</span>
                            )}
                        </div>
                        <ScrollArea className="h-48 rounded border bg-background">
                            <div className="p-2 space-y-1">
                                {(attorneys || []).filter(a => a.fullName !== leadAssignee).map(a => (
                                    <div key={a.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md transition-colors">
                                        <Checkbox 
                                            id={`co-${a.id}`} 
                                            checked={coAssignees.includes(a.fullName)}
                                            onCheckedChange={() => handleToggleCoAssignee(a.fullName)}
                                        />
                                        <label htmlFor={`co-${a.id}`} className="text-sm font-medium leading-none cursor-pointer flex-1">
                                            {a.fullName}
                                            <span className="text-[10px] text-muted-foreground ml-2 uppercase font-bold">{a.rank}</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>

            {isUpdateMode && (
                 <FormField
                    control={form.control}
                    name="treatAsNew"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-muted/30">
                             <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="text-xs font-bold">
                                    Flag as New Activity
                                </FormLabel>
                                <p className="text-[10px] text-muted-foreground">
                                   Update the reportable date to include this file in the current month's workload reports.
                                </p>
                            </div>
                        </FormItem>
                    )}
                />
            )}
            <DialogFooter className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto h-11 px-8 order-1 sm:order-2">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isUpdateMode ? 'Save Changes' : 'Create File'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto h-11 px-8 order-2 sm:order-1">
                    Cancel
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
