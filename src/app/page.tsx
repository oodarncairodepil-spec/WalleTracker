"use client";

import { useState } from "react";
import { ExpenseTracker } from "@/components/expense-tracker";
import { AuthForm } from "@/components/auth-form";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <AuthForm 
          mode={authMode} 
          onToggleMode={() => setAuthMode(authMode === "signin" ? "signup" : "signin")} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="absolute top-4 right-4">
        <Button variant="outline" onClick={signOut}>
          Sign Out
        </Button>
      </div>
      <ExpenseTracker />
    </div>
  );
}
