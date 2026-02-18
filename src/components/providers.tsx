
'use client';

import { AuthProvider } from '@/components/auth-provider';
import { FirebaseClientProvider } from '@/firebase';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <FirebaseClientProvider>
            <AuthProvider>
                {children}
            </AuthProvider>
        </FirebaseClientProvider>
    );
}
