
'use client';
import { useAuth, useUser } from '@/firebase';
import { Button } from './ui/button';
import { Icons } from './icons';
import { SidebarTrigger } from './ui/sidebar';
import { useRouter } from 'next/navigation';

export function AppHeader({ isUpdateMode, userFullName }: { isUpdateMode?: boolean, userFullName?: string | null }) {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
    }
    // The provider will handle redirecting to /login
  };
  
  const getFirstName = () => {
    // Prioritize user.displayName from the auth object, which is more reliable.
    const nameToUse = user?.displayName || userFullName;
    if (nameToUse) {
        return nameToUse.split(' ')[0];
    }
    return 'User';
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-card/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center gap-2">
        <SidebarTrigger />
        <div className="hidden items-center gap-3 md:flex">
          <Icons.logo className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">File Tracker</h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {user && <span className="text-sm text-muted-foreground hidden sm:inline">Logged in as {getFirstName()}</span>}
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
