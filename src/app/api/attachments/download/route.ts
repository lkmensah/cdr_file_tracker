import { NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdmin } from '@/firebase/admin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const accessId = searchParams.get('accessId');

    if (!path) {
        return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    try {
        const adminApp = initializeAdmin();
        const firestore = getFirestore(adminApp);
        const adminAuth = getAuth(adminApp);
        
        // Cryptographic Verification: Verify ID Token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        let isAuthorized = false;

        // 1. Check for Admin/Staff Claim
        if (decodedToken.role === 'admin' || decodedToken.role === 'staff') {
            isAuthorized = true;
        } else {
            // Fallback: Check Firestore if custom claims aren't yet synced
            const userSnap = await firestore.collection('users').doc(decodedToken.uid).get();
            if (userSnap.exists) {
                const userData = userSnap.data();
                if (userData?.role === 'admin' || userData?.role === 'staff') {
                    isAuthorized = true;
                }
            }
        }

        // 2. Check for Attorney Identity Binding (for anonymous portal users)
        if (!isAuthorized && accessId) {
            const attorneySnap = await firestore.collection('attorneys').where('accessId', '==', accessId).limit(1).get();
            if (!attorneySnap.empty) {
                const attData = attorneySnap.docs[0].data();
                if (attData.boundUid === decodedToken.uid) {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Access denied by security policy' }, { status: 403 });
        }

        const storage = getStorage(adminApp);
        const bucket = storage.bucket();
        const file = bucket.file(path);

        const [exists] = await file.exists();
        if (!exists) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Smart Disposition: Use 'inline' for PDFs/Images, 'attachment' for Word
        const extension = path.split('.').pop()?.toLowerCase();
        const renderableExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt'];
        const isRenderable = extension && renderableExtensions.includes(extension);

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 mins
            responseDisposition: isRenderable ? 'inline' : 'attachment',
        });

        return NextResponse.json({ url });
    } catch (error: any) {
        console.error('Download Security Error:', error);
        return NextResponse.json({ error: 'Unauthorized access attempt logged' }, { status: 401 });
    }
}
