import { auth } from "@/lib/better-auth/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/sign-up?error=missing-token", request.url));
  }

  try {
    await auth.api.verifyEmail({
      query: { token },
    });

    return NextResponse.redirect(new URL("/email-verified", request.url));
  } catch (error) {
    console.error("Email verification failed:", error);
    return NextResponse.redirect(
      new URL("/sign-up?error=verification-failed", request.url)
    );
  }
}