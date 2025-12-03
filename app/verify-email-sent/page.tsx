"use client";

import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export default function VerifyEmailSent() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-4">
        <Mail className="w-20 h-20 text-blue-500 mx-auto" />
        <h1 className="text-3xl font-bold">Check Your Email</h1>
        <div className="space-y-2 text-gray-600">
          <p>We've sent a verification link to your email address.</p>
          <p>Click the link in the email to activate your account.</p>
          <p className="text-sm text-gray-500">
            Didn't receive the email? Check your spam folder.
          </p>
        </div>
        <Button 
          onClick={() => (window.location.href = "/sign-in")}
          variant="outline"
          className="w-full"
        >
          Back to Sign In
        </Button>
      </div>
    </div>
  );
}