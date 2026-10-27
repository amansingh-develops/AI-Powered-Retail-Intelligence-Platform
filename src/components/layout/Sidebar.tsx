"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  Package,
  Users,
  Server,
  FileBarChart,
  Settings,
  Sparkles,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeType?: "warn" | "neutral";
}

export const Sidebar: React.FC<{ openAlertsCount?: number }> = ({
  openAlertsCount = 2,
}) => {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      name: "Overview",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Alerts Center",
      href: "/alerts",
      icon: Bell,
      badge: openAlertsCount,
      badgeType: openAlertsCount > 0 ? "warn" : "neutral",
    },
    {
      name: "Inventory & Shelves",
      href: "/inventory",
      icon: Package,
    },
    {
      name: "Queue Intelligence",
      href: "/queue",
      icon: Users,
    },
    {
      name: "Device & Fleet Health",
      href: "/fleet",
      icon: Server,
    },
    {
      name: "Reports & Export",
      href: "/reports",
      icon: FileBarChart,
    },
    {
      name: "Settings & Setup",
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-60 bg-white border-r border-[#E3E1DC] flex flex-col justify-between shrink-0 h-[calc(100vh-3.5rem)] sticky top-14">
      <div className="flex flex-col flex-1 py-4 overflow-y-auto">
        {/* Brand App Header */}
        <div className="px-5 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#3B3358] text-white flex items-center justify-center font-bold text-xs tracking-tighter">
              RP
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-[#1B1B1F] leading-tight">
                RetailPulse
              </div>
              <div className="text-[11px] text-[#6B6B72] font-mono-data">v2.0 • Edge CV</div>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="space-y-0.5 px-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center justify-between px-3 py-2 text-[13px] font-medium rounded-[5px] transition-colors ${
                  isActive
                    ? "bg-[#3B3358] text-[#EDEAF2]"
                    : "text-[#1B1B1F] hover:bg-[#EDEAF2] hover:text-[#3B3358]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-[#EDEAF2]" : "text-[#6B6B72] group-hover:text-[#3B3358]"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] font-mono-data px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? "bg-[#EDEAF2] text-[#3B3358]"
                        : item.badgeType === "warn"
                        ? "bg-[#B07A1E]/15 text-[#B07A1E] font-semibold"
                        : "bg-[#E3E1DC] text-[#6B6B72]"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Edge Architecture Footnote */}
      <div className="p-4 border-t border-[#E3E1DC] bg-[#F6F5F2]/60">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#1B1B1F] mb-1">
          <Sparkles className="w-3.5 h-3.5 text-[#3B3358]" />
          <span>Edge-First Engine</span>
        </div>
        <p className="text-[11px] text-[#6B6B72] leading-normal">
          On-device CV on Raspberry Pi with local SQLite buffer. REST push & config poll.
        </p>
      </div>
    </aside>
  );
};
