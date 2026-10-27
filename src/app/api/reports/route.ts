import { NextResponse } from "next/server";
import { globalStore } from "@/lib/store";

export async function GET() {
  const store = globalStore.getSelectedStore();
  const footfallTotal = globalStore.footfall.reduce((acc, curr) => acc + curr.inCount, 0);
  const kpis = globalStore.getOverviewKpis();
  const alertStats = {
    total: globalStore.alerts.length,
    open: globalStore.alerts.filter((a) => a.status === "open").length,
    resolved: globalStore.alerts.filter((a) => a.status === "resolved").length,
  };

  const storeComparison = globalStore.stores.map((s) => ({
    storeId: s.id,
    storeName: s.name,
    code: s.code,
    footfall: s.id === "str-104" ? footfallTotal : Math.round(footfallTotal * (s.id === "str-208" ? 1.25 : 0.85)),
    stockHealth: s.id === "str-104" ? kpis.stockHealthPercent : s.id === "str-208" ? 96 : 91,
    avgWaitMin: s.id === "str-104" ? kpis.avgWaitMin : s.id === "str-208" ? "2.4" : "4.1",
    activeAlerts: s.id === "str-104" ? kpis.openAlertsCount : s.id === "str-208" ? 1 : 4,
  }));

  return NextResponse.json({
    reportDate: new Date().toLocaleDateString("en-GB"),
    store,
    kpis,
    alertStats,
    storeComparison,
    dailyInventory: globalStore.inventoryMetrics,
  });
}
