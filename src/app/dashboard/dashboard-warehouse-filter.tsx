"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

export function DashboardWarehouseFilter({
  warehouses,
  currentId
}: {
  warehouses: { id: string; name: string; code: string }[];
  currentId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Select
      value={currentId || "all"}
      onValueChange={(v) => {
        const p = new URLSearchParams(searchParams.toString());
        if (v === "all") p.delete("warehouse_id");
        else p.set("warehouse_id", v);
        router.push(`/dashboard?${p.toString()}`);
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="All warehouses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All warehouses</SelectItem>
        {warehouses.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
