
'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { Attorney } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, useFirebase } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';

interface PortalContextType {
    attorney: Attorney | null;
    isAuthorized: boolean;
    isLoading: boolean;
    isSG: boolean;
    login: (accessId: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}

const PortalContext = React.createContext<PortalContextType | undefined>(undefined);

export const usePortal = () => {
    const context = React.useContext(PortalContext);
    if (!context) throw new Error('usePortal must be used within PortalProvider');
    return context;
};

export function PortalProvider({ children }: { children: React.ReactNode }) {
    const [attorney, setAttorney] = React.useState<Attorney | null>(null);
    const [isCheckingSession, setIsCheckingSession] = React.useState(true);
    const [authFailed, setAuthFailed] = React.useState(false);
    
    const router = useRouter();
    const pathname = usePathname();
    const firestore = useFirestore();
    const { auth, user, isUserLoading: isAuthLoading } = useFirebase();

    // Ensure anonymous session is active for all portal users
    React.useEffect(() => {
        if (!isAuthLoading && !user && auth) {
            signInAnonymously(auth).catch((error) => {
                console.warn("Portal Auth Warning:", error.code);
                if (error.code === 'auth/operation-not-allowed') setAuthFailed(true);
            });
        }
    }, [user, isAuthLoading, auth]);

    const attorneysQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'attorneys');
    }, [firestore, user]);

    const { data: allAttorneys } = useCollection<Attorney>(attorneysQuery);

    React.useEffect(() => {
        const savedAccessId = Cookies.get('portal_access_id');
        if (savedAccessId && allAttorneys) {
            const found = allAttorneys.find(a => a.accessId === savedAccessId);
            if (found) setAttorney(found);
            else Cookies.remove('portal_access_id');
            setIsCheckingSession(false);
        } else if (!savedAccessId) {
            setIsCheckingSession(false);
        }
    }, [allAttorneys]);

    const login = async (accessId: string) => {
        if (!allAttorneys || !user) return { success: false, error: 'Identity services initializing...' };
        
        const found = allAttorneys.find(a => a.accessId?.toUpperCase() === accessId.trim().toUpperCase());
        
        if (found) {
            // Identity Binding: Lock the Access ID to this specific anonymous UID
            if (found.boundUid && found.boundUid !== user.uid) {
                return { success: false, error: 'Access denied. This ID is bound to another device.' };
            }

            if (!found.boundUid) {
                // Permanently bind this UID to the attorney record
                const attRef = doc(firestore!, 'attorneys', found.id);
                await updateDoc(attRef, { boundUid: user.uid });
            }

            setAttorney(found);
            Cookies.set('portal_access_id', found.accessId, { expires: 7 });
            return { success: true };
        }
        return { success: false, error: 'Invalid Access ID.' };
    };

    const logout = () => {
        setAttorney(null);
        Cookies.remove('portal_access_id');
        router.push('/portal');
    };

    if (authFailed) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-5 w-5" />
                    <AlertTitle>Security Configuration Required</AlertTitle>
                    <AlertDescription>Enable Anonymous Auth in Firebase Console to use the Attorney Portal.</AlertDescription>
                </Alert>
            </div>
        );
    }

    const isLoading = isAuthLoading || isCheckingSession;
    if (isLoading && pathname.startsWith('/portal/')) return <div className="min-h-screen flex items-center justify-center">Verifying Identity...</div>;

    return (
        <PortalContext.Provider value={{ attorney, isAuthorized: !!attorney, isLoading, isSG: !!attorney?.isSG, login, logout }}>
            {children}
        </PortalContext.Provider>
    );
}
