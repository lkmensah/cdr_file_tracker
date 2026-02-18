
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {token} = body;

    if (!token) {
      return new NextResponse(JSON.stringify({error: 'Token is required'}), {
        status: 400,
      });
    }

    // Set the cookie
    const cookieStore = await cookies();
    cookieStore.set('firebaseIdToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return new NextResponse(JSON.stringify({status: 'success'}), {
      status: 200,
    });
  } catch (error) {
    console.error('Login API Error:', error);
    return new NextResponse(JSON.stringify({error: 'Internal Server Error'}), {
      status: 500,
    });
  }
}
