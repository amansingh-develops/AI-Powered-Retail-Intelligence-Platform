"use client";

import React, { useState } from "react";
import { CounterQueue } from "@/lib/types";
import { Users, AlertTriangle, CheckCircle, Power } from "lucide-react";
import { Button } from "../ui/Button";

interface LiveQueueDisplayProps {
  queues: CounterQueue[];
  onToggleCounter?: (counterId: string) => void;
}

export const LiveQueueDisplay: React.FC<LiveQueueDisplayProps> = ({
  queues: initialQueues,
  onToggleCounter,
}) => {
  const [queues, setQueues] = useState<CounterQueue[]>(initialQueues);

  // Check if any counter has severe congestion (>= 7 people)
  const congestedCounter = queues.find((q) => q.queueLength >= 7 && q.status !== "closed");
  const closedCounter = queues.find((q) => q.status === "closed");

  const handleToggle = (counterId: string) => {
    if (onToggleCounter) {
      onToggleCounter(counterId);
    }
    setQueues((prev) =>
      prev.map((c) => {
        if (c.id === counterId) {
          if (c.status === "closed") {
            return {
              ...c,
              status: "open",
              operatorName: "Support Staff (Assigned)",
              queueLength: 1,
              avgWaitSec: 45,
            };
          } else {
            return {
              ...c,
              status: "closed",
              operatorName: "Unassigned",
              queueLength: 0,
              avgWaitSec: 0,
            };
          }
        }
        return c;
      })
    );
  };

  return (
    <div className="bg-white border border-[#E3E1DC] rounded-[6px] p-4 flex flex-col">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E3E1DC] mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#3B3358]" />
          <h3 className="text-sm font-semibold text-[#1B1B1F]">
            Checkout Queues — Live Status
          </h3>
        </div>
        <span className="text-xs font-mono-data text-[#6B6B72]">
          Camera 3 CV Stream • Ingested via Host App
        </span>
      </div>

      {/* Counter Departure-Board Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {queues.map((counter) => {
          const isClosed = counter.status === "closed";
          const isCongested = counter.queueLength >= 7;

          return (
            <div
              key={counter.id}
              className={`p-3 rounded-[5px] border transition-colors flex flex-col justify-between ${
                isClosed
                  ? "bg-[#F6F5F2] border-[#E3E1DC] opacity-75"
                  : isCongested
                  ? "bg-white border-[#B07A1E] shadow-sm"
                  : "bg-white border-[#E3E1DC]"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#6B6B72]">
                <span className="uppercase tracking-wider">COUNTER {counter.counterNumber}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isClosed
                      ? "bg-[#8B8B92]"
                      : isCongested
                      ? "bg-[#B07A1E] animate-pulse"
                      : "bg-[#2E7D4F]"
                  }`}
                />
              </div>

              <div className="my-2">
                <div className="text-xl font-mono-data font-medium text-[#1B1B1F]">
                  {isClosed ? "Closed" : `${counter.queueLength} ${counter.queueLength === 1 ? "person" : "people"}`}
                </div>
                <div className="text-xs font-mono-data text-[#6B6B72] mt-0.5">
                  {isClosed ? "—" : `~${(counter.avgWaitSec / 60).toFixed(1)} min wait`}
                </div>
              </div>

              <div className="pt-2 border-t border-[#E3E1DC] flex items-center justify-between text-[11px]">
                <span className="text-[#6B6B72] truncate max-w-[90px]">
                  {counter.operatorName}
                </span>
                <button
                  onClick={() => handleToggle(counter.id)}
                  title={isClosed ? "Open Counter" : "Close Counter"}
                  className="text-[10px] font-mono-data px-1.5 py-0.5 rounded border border-[#E3E1DC] hover:bg-[#EDEAF2] hover:text-[#3B3358] transition-colors"
                >
                  {isClosed ? "Open" : "Close"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Decision-Ready Recommendation Banner */}
      {congestedCounter && closedCounter && (
        <div className="flex items-center gap-3 p-2.5 rounded-[5px] bg-[#F6F5F2] border border-[#E3E1DC] relative overflow-hidden">
          {/* 3px severity bar per design spec */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#B07A1E]" />
          <AlertTriangle className="w-4 h-4 text-[#B07A1E] shrink-0 ml-2" />
          <div className="flex-1 text-xs text-[#1B1B1F]">
            <span className="font-semibold text-[#B07A1E]">Recommend opening Counter {closedCounter.counterNumber}</span>
            <span className="text-[#6B6B72] ml-1">
              — Counter {congestedCounter.counterNumber} has {congestedCounter.queueLength} people waiting (projected 7.5 min wait in 10 min).
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => handleToggle(closedCounter.id)}
            className="shrink-0 text-xs"
          >
            Open Counter {closedCounter.counterNumber}
          </Button>
        </div>
      )}
    </div>
  );
};
