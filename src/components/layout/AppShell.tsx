"use client";

import React, { useState, useEffect } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { globalStore } from "@/lib/store";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [openAlertsCount, setOpenAlertsCount] = useState(
    globalStore.alerts.filter((a) => a.status === "open").length
  );

  useEffect(() => {
    // Check open alerts periodically
    const interval = setInterval(() => {
      const count = globalStore.alerts.filter((a) => a.status === "open").length;
      setOpenAlertsCount(count);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header />
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        <Sidebar openAlertsCount={openAlertsCount} />
        <main className="flex-1 min-w-0 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
