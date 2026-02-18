
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Get the token from the cookie
  const token = request.cookies.get('firebaseIdToken')?.value;

  if (token) {
    // Add the token to the request headers
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  // Return a new response with the updated headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // Match all request paths except for the ones starting with:
  // - api (API routes)
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
