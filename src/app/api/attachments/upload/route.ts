import { NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdmin } from '@/firebase/admin';
import { addFileAttachment } from '@/lib/data';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
    try {
        const adminApp = initializeAdmin();
        const adminAuth = getAuth(adminApp);
        const firestore = getFirestore(adminApp);

        // 1. Cryptographic Verification: Verify ID Token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing security token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const accessId = formData.get('accessId') as string;
        const fileNumber = formData.get('fileNumber') as string;

        if (!file || !accessId || !fileNumber) {
            return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File size exceeds 2MB limit' }, { status: 400 });
        }

        // 2. Identity Binding Verification: Ensure the UID matches the bound attorney
        const attorneySnap = await firestore.collection('attorneys').where('accessId', '==', accessId).limit(1).get();
        
        if (attorneySnap.empty) {
            return NextResponse.json({ error: 'Invalid workspace access' }, { status: 401 });
        }

        const attorneyData = attorneySnap.docs[0].data();
        
        // Ensure the anonymous UID matches the one bound to this Access ID
        if (attorneyData.boundUid && attorneyData.boundUid !== decodedToken.uid) {
            return NextResponse.json({ error: 'Unauthorized device detected' }, { status: 403 });
        }

        const storage = getStorage(adminApp);
        const bucket = storage.bucket();
        
        const timestamp = Date.now();
        const fileName = `att-${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `files/${fileNumber}/attachments/${fileName}`;
        
        const buffer = Buffer.from(await file.arrayBuffer());
        const storageFile = bucket.file(filePath);

        await storageFile.save(buffer, {
            metadata: { contentType: file.type || 'application/octet-stream' },
        });

        const attachmentMetadata = {
            id: `att-${timestamp}`,
            name: file.name,
            path: filePath,
            type: file.type,
            size: file.size,
            uploadedBy: attorneyData.fullName,
            uploadedAt: new Date(),
        };

        await addFileAttachment(fileNumber, attachmentMetadata);

        return NextResponse.json({ success: true, attachment: attachmentMetadata });
    } catch (error: any) {
        console.error('Upload Security Error:', error);
        return NextResponse.json({ error: 'Security verification failed' }, { status: 500 });
    }
}
