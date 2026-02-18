'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
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
import { Combobox } from './ui/combobox';
import { assignToFile } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { CorrespondenceFile, Letter } from '@/lib/types';
import { useUser } from '@/firebase';
import { useAuthAction } from '@/hooks/use-auth-action';

const FormSchema = z.object({
  letterId: z.string(),
  fileNumber: z.string().min(1, 'You must select a file.'),
  correspondenceType: z.enum(['Incoming', 'Court Process']),
  userEmail: z.string().email(),
});

type FormData = z.infer<typeof FormSchema>;

interface AssignFileDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    letter: Letter | null;
    files: CorrespondenceFile[];
    onAssignSuccess: (letterId: string, fileNumber: string) => void;
}

export function AssignFileDialog({ isOpen, onOpenChange, letter, files, onAssignSuccess }: AssignFileDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const handleSuccess = (result: any) => {
    if (result && result.message.includes('Success')) {
      const fileNumber = form.getValues('fileNumber');
      toast({
        title: 'Assigned to File',
        description: `The item has been successfully assigned to file ${fileNumber}.`,
      });
      onAssignSuccess(letter!.id, fileNumber);
      onOpenChange(false);
      handleReset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result?.message || 'Failed to assign to file.',
      });
    }
  };

  const { exec: authAssignToFile, isLoading } = useAuthAction(assignToFile, {
    onSuccess: handleSuccess,
    onError: (error) => {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'Failed to assign to file.',
        });
    }
  });

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
        userEmail: user?.email || '',
    }
  });

  React.useEffect(() => {
    if (letter) {
        form.setValue('letterId', letter.id);
        form.setValue('correspondenceType', letter.type as 'Incoming' | 'Court Process');
        form.setValue('userEmail', user?.email || '');
    }
  }, [letter, form, isOpen, user]);

  const fileOptions = React.useMemo(() => files.map(f => ({
      label: `${f.fileNumber} - ${f.subject}`,
      value: f.fileNumber
  })), [files]);

  const handleReset = () => {
    form.reset({
        letterId: '',
        fileNumber: '',
        userEmail: user?.email || '',
        correspondenceType: 'Incoming',
    });
  };

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    await authAssignToFile(formData);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) handleReset();
    }}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-6 overflow-visible">
        <DialogHeader>
          <DialogTitle>Assign Item to File</DialogTitle>
          <DialogDescription>
            Select a file to assign this piece of correspondence to.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 [&_*]:min-w-0 overflow-visible">
            <input type="hidden" {...form.register('userEmail')} />
            
            <div className="space-y-1 w-full min-w-0 overflow-visible">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Item Subject:</p>
              <div className="w-full min-w-0 overflow-visible">
                <p
                  className="block w-full min-w-0 truncate bg-muted/30 p-3 rounded border border-dashed text-sm font-medium leading-relaxed"
                  title={letter?.subject}
                >
                  {letter?.subject}
                </p>
              </div>
            </div>

             <FormField
                control={form.control}
                name="fileNumber"
                render={({ field }) => (
                    <FormItem className="flex flex-col min-w-0 space-y-2 overflow-visible">
                        <FormLabel>Select Target Case File</FormLabel>
                        <div className="min-w-0 w-full overflow-visible">
                            <Combobox
                                options={fileOptions}
                                value={field.value}
                                onChange={field.onChange}
                                searchPlaceholder="Search by file number or subject..."
                                notFoundMessage="No files found."
                            />
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <DialogFooter className="pt-4 border-t flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto h-11 px-8 gap-2 order-1 sm:order-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Assign to File
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto h-11 px-8 order-2 sm:order-1">
                    Cancel
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
