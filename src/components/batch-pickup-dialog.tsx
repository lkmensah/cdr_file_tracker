'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, CheckCircle2, User, FileText, Loader2 } from 'lucide-react';
import { useAuthAction } from '@/hooks/use-auth-action';
import { batchPickupFiles } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

interface BatchPickupDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    fileNumbers: string[];
}

export function BatchPickupDialog({ isOpen, onOpenChange, fileNumbers }: BatchPickupDialogProps) {
    const { toast } = useToast();
    const [summary, setSummary] = React.useState<any[] | null>(null);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const { exec: authPickup, isLoading } = useAuthAction(batchPickupFiles);

    const handleConfirmPickup = async () => {
        setIsProcessing(true);
        const formData = new FormData();
        formData.append('fileNumbers', fileNumbers.join(','));
        
        try {
            const result = await authPickup(formData);
            if (result && result.message.includes('Success')) {
                setSummary(result.summary || []);
                toast({ title: "Pickup Recorded", description: "Files marked as returned to Registry." });
            } else {
                toast({ variant: 'destructive', title: "Error", description: result?.message || "Failed to process pickup." });
                onOpenChange(false);
            }
        } catch (e) {
            onOpenChange(false);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendWhatsApp = (attorney: any) => {
        const fileList = attorney.files.map((f: any, i: number) => `${i + 1}. ${f.fileNumber} - ${f.subject}`).join('\n');
        const message = encodeURIComponent(
            `Hello ${attorney.fullName},\n\nThe Registry has physically picked up the following ${attorney.files.length} file(s) from your office:\n\n${fileList}\n\nThese have been marked as 'Received' by the Registry in the tracking system. Please verify physical transfer.\n\nThank you.`
        );
        window.open(`https://wa.me/${attorney.phoneNumber.replace(/\D/g, '')}?text=${message}`, '_blank');
        
        // Automatically close the dialog after triggering notification
        handleClose();
    };

    const handleClose = () => {
        setSummary(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Batch Pickup Handover</DialogTitle>
                    <DialogDescription>
                        Confirming physical collection of {fileNumbers.length} file(s) and returning them to Registry possession.
                    </DialogDescription>
                </DialogHeader>

                {!summary ? (
                    <div className="py-8 text-center space-y-4">
                        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                            <FileText className="h-8 w-8 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This will automatically mark all {fileNumbers.length} files as <strong>Received by Registry</strong> and clear any pending requests.
                        </p>
                        <Button size="lg" className="w-full" onClick={handleConfirmPickup} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirm Physical Pickup
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 border border-green-100 rounded-lg">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="text-sm font-semibold">Success! Possession updated. Now notify the practitioners:</span>
                        </div>

                        {summary.length > 0 ? summary.map((att, idx) => (
                            <Card key={idx} className="border-primary/10 overflow-hidden">
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-muted p-1.5 rounded-full">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{att.fullName}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">{att.files.length} Files Collected</span>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-8 gap-2 border-green-200 hover:bg-green-50 hover:text-green-700"
                                            onClick={() => handleSendWhatsApp(att)}
                                        >
                                            <MessageCircle className="h-3.5 w-3.5" />
                                            Notify via WhatsApp
                                        </Button>
                                    </div>
                                    <div className="space-y-1.5 pl-9">
                                        {att.files.map((f: any) => (
                                            <div key={f.fileNumber} className="flex items-start gap-2 text-xs">
                                                <Badge variant="outline" className="font-mono h-4 px-1 py-0 text-[10px]">{f.fileNumber}</Badge>
                                                <span className="text-muted-foreground truncate">{f.subject}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )) : (
                            <p className="text-center text-sm text-muted-foreground italic py-10">
                                Files were already in Registry possession or previous holders are not registered as Attorneys.
                            </p>
                        )}
                        
                        <Button variant="ghost" className="w-full" onClick={handleClose}>Close Summary</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
