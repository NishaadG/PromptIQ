import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only (per the Next.js auth guide): bounce signed-out visitors away from the app
// shell before rendering. Real authorization happens in the Data Access Layer (lib/server/dal.ts).
export function proxy(request: NextRequest) {
  if (!request.cookies.has("piq_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
