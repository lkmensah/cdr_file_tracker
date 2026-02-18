
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';

export async function POST() {
  try {
    // Clear the cookie
    const cookieStore = await cookies();
    cookieStore.set('firebaseIdToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: -1, // Expire the cookie immediately
    });

    return new NextResponse(JSON.stringify({status: 'success'}), {
      status: 200,
    });
  } catch (error) {
    console.error('Logout API Error:', error);
    return new NextResponse(JSON.stringify({error: 'Internal Server Error'}), {
      status: 500,
    });
  }
}
