"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

export default function EmailVerified() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-4">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
        <h1 className="text-3xl font-bold">Email Verified!</h1>
        <p className="text-gray-600">
          Your account has been successfully verified. You can now sign in and start investing.
        </p>
        <Button 
          onClick={() => router.push("/sign-in")} 
          className="yellow-btn w-full"
        >
          Continue to Sign In
        </Button>
      </div>
    </div>
  );
}