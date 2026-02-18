'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Loader2, UserCircle, ShieldCheck } from 'lucide-react';
import { updateUserProfile } from '@/app/actions/user';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters.'),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format. Use international format (e.g. +233...)').or(z.literal('')),
  rank: z.string().optional(),
  group: z.string().optional(),
});

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, startTransition] = useTransition();
  const { toast } = useToast();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userRef);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      phoneNumber: '',
      rank: '',
      group: '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.fullName || '',
        phoneNumber: profile.phoneNumber || '',
        rank: profile.rank || '',
        group: profile.group || '',
      });
    }
  }, [profile, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append('userId', user.uid);
      formData.append('fullName', values.fullName);
      formData.append('phoneNumber', values.phoneNumber);
      formData.append('rank', values.rank || '');
      formData.append('group', values.group || '');
      
      const result = await updateUserProfile(formData);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Your profile has been updated.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
    });
  };

  if (isUserLoading || isProfileLoading) {
      return <main className="flex-1 p-4 flex items-center justify-center">Loading profile...</main>;
  }

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <UserCircle className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <CardTitle>My Profile</CardTitle>
                        <CardDescription>Manage your personal information and contact details.</CardDescription>
                    </div>
                </div>
                {profile?.role && (
                    <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="gap-1 px-3 py-1">
                        <ShieldCheck className="h-3 w-3" />
                        {profile.role.toUpperCase()}
                    </Badge>
                )}
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                            <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="rank"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Rank</FormLabel>
                        <FormControl>
                            <Input placeholder="State Attorney" {...field} />
                        </FormControl>
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
                        <FormControl>
                            <Input placeholder="Civil Division" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                        <FormLabel>WhatsApp Phone Number</FormLabel>
                        <FormControl>
                            <Input placeholder="+233..." {...field} />
                        </FormControl>
                        <FormDescription>
                            Used for delivery notifications. Include country code (e.g., +233 for Ghana).
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                
                <div className="pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
