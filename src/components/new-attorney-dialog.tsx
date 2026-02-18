
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Loader2, ShieldCheck, Crown } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { createAttorney, updateAttorney } from '@/app/actions/attorney';
import { useToast } from '@/hooks/use-toast';
import type { Attorney } from '@/lib/types';
import { useAuthAction } from '@/hooks/use-auth-action';

const FormSchema = z.object({
  fullName: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email.').optional().or(z.literal('')),
  phoneNumber: z.string().min(1, 'Phone number is required.'),
  rank: z.string().optional(),
  group: z.string().optional(),
  isGroupHead: z.boolean().default(false),
  isSG: z.boolean().default(false),
});

type FormData = z.infer<typeof FormSchema>;

export function NewAttorneyDialog({ isOpen, onOpenChange, attorney }: { isOpen: boolean, onOpenChange: (open: boolean) => void, attorney?: Attorney | null }) {
  const { toast } = useToast();
  const isUpdateMode = !!attorney;

  const handleSuccess = (result: any) => {
    if (result && result.message.includes('Success')) {
      toast({ title: isUpdateMode ? 'Attorney Updated' : 'Attorney Added', description: result.message });
      onOpenChange(false);
      form.reset();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
  };

  const { exec: authCreate, isLoading: isCreating } = useAuthAction(createAttorney, { onSuccess: handleSuccess });
  const { exec: authUpdate, isLoading: isUpdating } = useAuthAction(updateAttorney, { onSuccess: handleSuccess });

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      rank: '',
      group: '',
      isGroupHead: false,
      isSG: false,
    },
  });

  React.useEffect(() => {
    if (attorney && isOpen) {
      form.reset({
        fullName: attorney.fullName,
        email: attorney.email || '',
        phoneNumber: attorney.phoneNumber,
        rank: attorney.rank || '',
        group: attorney.group || '',
        isGroupHead: attorney.isGroupHead || false,
        isSG: attorney.isSG || false,
      });
    } else if (!isUpdateMode && isOpen) {
      form.reset({ fullName: '', email: '', phoneNumber: '', rank: '', group: '', isGroupHead: false, isSG: false });
    }
  }, [attorney, isOpen, isUpdateMode, form]);

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
        formData.append(key, String(val));
    });
    
    if (isUpdateMode) {
        formData.append('id', attorney!.id);
        await authUpdate(formData);
    } else {
        await authCreate(formData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {!isUpdateMode && (
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Attorney
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isUpdateMode ? 'Edit Attorney' : 'Add New Attorney'}</DialogTitle>
          <DialogDescription>Enter the attorney's details for the registry.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input placeholder="email@example.com (Optional)" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>WhatsApp Number <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="+233..." {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="rank"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Rank</FormLabel>
                    <FormControl><Input placeholder="State Attorney" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="group"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Group</FormLabel>
                    <FormControl><Input placeholder="Civil Division" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <div className="grid gap-4">
                <FormField
                    control={form.control}
                    name="isSG"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-yellow-50/50 border-yellow-200">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="flex items-center gap-2 text-yellow-800">
                                    <Crown className="h-4 w-4 text-yellow-600" />
                                    Designate as Solicitor General
                                </FormLabel>
                                <p className="text-[10px] text-yellow-700 uppercase tracking-tighter">
                                    Executive access to all files and system analytics.
                                </p>
                            </div>
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="isGroupHead"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-primary/5 border-primary/10">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={form.watch('isSG')}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    Designate as Group Head
                                </FormLabel>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                                    Grants oversight of all files within their specific group.
                                </p>
                            </div>
                        </FormItem>
                    )}
                />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {(isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isUpdateMode ? 'Save Changes' : 'Add Attorney'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
