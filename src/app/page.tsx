"use client";

import { useState } from "react";
import { MainApp } from "@/components/main-app";
import { AuthForm } from "@/components/auth-form";
import { AvatarDropdown } from "@/components/avatar-dropdown";
import { useAuth } from "@/contexts/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
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
    <div className="min-h-screen bg-gray-50 relative">
      <div className="absolute top-4 right-4 z-50">
        <AvatarDropdown />
      </div>
      <MainApp />
    </div>
  );
}
