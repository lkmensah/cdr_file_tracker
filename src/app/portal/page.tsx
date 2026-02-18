
'use client';

import * as React from 'react';
import { usePortal } from '@/components/portal-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { Loader2, Key } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PortalEntry() {
    const { login, isAuthorized, isLoading } = usePortal();
    const [accessId, setAccessId] = React.useState('');
    const [error, setError] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        if (isAuthorized) {
            router.push('/portal/dashboard');
        }
    }, [isAuthorized, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        const result = await login(accessId);
        if (result.success) {
            router.push('/portal/dashboard');
        } else {
            setError(result.error || 'Failed to login.');
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-8">
                <Icons.logo className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">Attorney Workspace</h1>
            </div>
            
            <Card className="w-full max-w-md shadow-lg border-primary/10">
                <CardHeader className="text-center">
                    <CardTitle>Secure Access</CardTitle>
                    <CardDescription>Enter your assigned Access ID to view your caseload.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="accessId">Workspace Access ID</Label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="accessId"
                                    className="pl-10 h-12 text-lg font-mono uppercase tracking-widest"
                                    placeholder="AT-XXXXX"
                                    value={accessId}
                                    onChange={(e) => setAccessId(e.target.value)}
                                    disabled={isSubmitting}
                                    autoComplete="off"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground italic">Contact Registry for your unique alphanumeric ID.</p>
                        </div>
                        
                        {error && <p className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>}
                        
                        <Button type="submit" size="lg" className="w-full h-12" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Access My Workspace"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
            
            <p className="mt-8 text-sm text-muted-foreground">Internal legal system for authorized practitioners only.</p>
        </div>
    );
}
