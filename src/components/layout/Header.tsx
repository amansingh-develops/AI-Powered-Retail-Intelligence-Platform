"use client";

import React, { useEffect, useState } from "react";
import { MOCK_STORES } from "@/lib/mockData";
import { Store } from "@/lib/types";
import { Store as StoreIcon, ShieldCheck, RefreshCw } from "lucide-react";

interface HeaderProps {
  currentStoreId?: string;
  onStoreChange?: (store: Store) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStoreId = "str-104",
  onStoreChange,
}) => {
  const [selectedStore, setSelectedStore] = useState<Store>(
    MOCK_STORES.find((s) => s.id === currentStoreId) || MOCK_STORES[0]
  );
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " IST"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStoreSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const store = MOCK_STORES.find((s) => s.id === e.target.value);
    if (store) {
      setSelectedStore(store);
      if (onStoreChange) onStoreChange(store);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-[#E3E1DC] px-5 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Store Selector with code */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[5px] bg-[#EDEAF2] text-[#3B3358] flex items-center justify-center shrink-0">
          <StoreIcon className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedStore.id}
            onChange={handleStoreSelect}
            className="text-sm font-semibold text-[#1B1B1F] bg-transparent border-0 pr-6 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#3B3358] rounded"
          >
            {MOCK_STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="text-xs font-mono-data text-[#6B6B72] px-1.5 py-0.5 bg-[#F6F5F2] border border-[#E3E1DC] rounded">
            {selectedStore.code}
          </span>
        </div>
      </div>

      {/* Right: Edge status, Live Clock, Master User */}
      <div className="flex items-center gap-4">
        {/* Edge Gateway Status */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-[#F6F5F2] border border-[#E3E1DC] rounded-[5px]">
          <span className="w-2 h-2 rounded-full bg-[#2E7D4F] animate-pulse" />
          <span className="text-xs text-[#1B1B1F] font-medium">Edge Pi Fleet:</span>
          <span className="text-xs font-mono-data text-[#6B6B72]">5/6 Online</span>
        </div>

        {/* Live Clock (IBM Plex Mono) */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#6B6B72] font-mono-data px-2 py-1 bg-white border border-[#E3E1DC] rounded">
          <RefreshCw className="w-3 h-3 text-[#3B3358] animate-spin [animation-duration:8s]" />
          <span>{timeString || "15:44:00 IST"}</span>
        </div>

        {/* Master User Profile */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-[#E3E1DC]">
          <div className="w-7 h-7 rounded-full bg-[#3B3358] text-[#EDEAF2] flex items-center justify-center text-xs font-semibold">
            MO
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-medium text-[#1B1B1F] leading-tight">Master Operator</div>
            <div className="text-[10px] text-[#6B6B72] font-mono-data flex items-center gap-1">
              <ShieldCheck className="w-2.5 h-2.5 text-[#2E7D4F]" /> Full System Access
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
