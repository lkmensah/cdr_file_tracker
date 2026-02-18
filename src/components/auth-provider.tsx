
'use client';

import { useUser, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, createContext, useContext } from 'react';
import { 
    SidebarProvider, 
    Sidebar, 
    SidebarContent, 
    SidebarHeader, 
    SidebarMenu, 
    SidebarMenuItem, 
    SidebarMenuButton, 
    SidebarInset, 
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel
} from '@/components/ui/sidebar';
import { AppHeader } from '@/components/app-header';
import { Home, Mail, Scale, Archive, ClipboardList, Folder, FileText, Search, BookUser, UserCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

interface AuthContextType {
    profile: UserProfile | null;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ profile: null, isAdmin: false });

export const useProfile = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Define route types for bypass logic
  const isPortalRoute = pathname.startsWith('/portal');
  const isAuthRoute = pathname === '/login' || pathname === '/change-password';
  const isBypassRoute = isPortalRoute || isAuthRoute;

  useEffect(() => {
    // Portal routes handle their own session logic independently
    if (isUserLoading || isPortalRoute) return;

    // Treat anonymous users (from the portal) as "logged out" for the admin app
    const adminUser = user && !user.isAnonymous ? user : null;

    if (!adminUser) {
        setProfile(null);
        setIsLoadingProfile(false);
        // Only redirect to login if we aren't already there
        if (pathname !== '/login') {
            router.push('/login');
        }
        return;
    }

    // We have a real user session. Check for a corresponding Firestore profile.
    if (!firestore) return;

    const userDocRef = doc(firestore, 'users', adminUser.uid);
    getDoc(userDocRef).then(docSnap => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as UserProfile;
        setProfile(userData);
        
        // Handle mandatory password changes
        if (userData.passwordChangeRequired) {
            if (pathname !== '/change-password') {
                router.push('/change-password');
            }
        } else if (isAuthRoute) {
            // Logged in, profile valid, no change required -> proceed to dashboard
            router.push('/');
        }
      } else {
        // User is authenticated in Auth but has no Firestore profile (e.g. account deleted or not yet initialized)
        setProfile(null);
        if (pathname !== '/login') {
            router.push('/login');
        }
      }
      setIsLoadingProfile(false);
    });

  }, [user, isUserLoading, router, pathname, firestore, isPortalRoute, isAuthRoute]);

  const isAdmin = profile?.role === 'admin';
  const isAdminOnlyRoute = pathname === '/report' || pathname === '/audit-log';

  // Protect admin-only pages from standard staff users
  useEffect(() => {
    if (!isLoadingProfile && !isPortalRoute && isAdminOnlyRoute && !isAdmin) {
        router.push('/');
    }
  }, [isLoadingProfile, isAdminOnlyRoute, isAdmin, router, isPortalRoute]);

  if (isUserLoading || (isLoadingProfile && !isBypassRoute)) {
    return <div className="flex h-screen items-center justify-center"><div>Loading session...</div></div>;
  }
  
  if (isBypassRoute) return <>{children}</>;
  
  // If we reach here, we are on an admin route and the user is verified
  if (!user || user.isAnonymous) return <div className="flex h-screen items-center justify-center"><div>Redirecting to login...</div></div>;

  return (
    <AuthContext.Provider value={{ profile, isAdmin }}>
     <SidebarProvider>
            <Sidebar collapsible="icon">
                <SidebarContent>
                    <SidebarHeader />
                    
                    <SidebarGroup>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/'}>
                                    <Link href="/"><Home /><span>Dashboard</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/files'}>
                                    <Link href="/files"><Folder /><span>Files</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/search'}>
                                    <Link href="/search"><Search /><span>Global Search</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>

                    <SidebarGroup>
                        <SidebarGroupLabel>Correspondence</SidebarGroupLabel>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/incoming-mail'}>
                                    <Link href="/incoming-mail"><Mail /><span>Incoming Mail</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/court-processes'}>
                                    <Link href="/court-processes"><Scale /><span>Court Processes</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>

                    <SidebarGroup>
                        <SidebarGroupLabel>Registry</SidebarGroupLabel>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/archives'}>
                                    <Link href="/archives"><Archive /><span>Archives</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/census'}>
                                    <Link href="/census"><ClipboardList /><span>Census</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>

                    <SidebarGroup>
                        <SidebarGroupLabel>Administration</SidebarGroupLabel>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/attorneys'}>
                                    <Link href="/attorneys"><Users /><span>Attorneys</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/profile'}>
                                    <Link href="/profile"><UserCircle /><span>My Profile</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {isAdmin && (
                                <>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild isActive={pathname === '/report'}>
                                            <Link href="/report"><FileText /><span>Reports</span></Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild isActive={pathname === '/audit-log'}>
                                            <Link href="/audit-log"><BookUser /><span>Audit Log</span></Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </>
                            )}
                        </SidebarMenu>
                    </SidebarGroup>

                    <SidebarFooter />
                </SidebarContent>
            </Sidebar>
             <SidebarInset>
                <AppHeader userFullName={profile?.fullName} />
                {children}
            </SidebarInset>
        </SidebarProvider>
    </AuthContext.Provider>
  );
}
