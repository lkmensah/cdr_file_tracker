
'use client';

import { PortalProvider } from '@/components/portal-provider';
import { Toaster } from '@/components/ui/toaster';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <PortalProvider>
            {children}
            <Toaster />
        </PortalProvider>
    );
}
