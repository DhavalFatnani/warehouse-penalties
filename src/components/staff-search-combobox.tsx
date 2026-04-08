"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";

export type StaffSearchOption = {
  id: string;
  full_name: string;
  employee_code: string;
};

type StaffSearchComboboxProps = {
  staff: StaffSearchOption[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function StaffSearchCombobox({
  staff,
  value,
  onValueChange,
  placeholder = "Search and select staff…",
  emptyText = "No staff match your search.",
  disabled,
  id,
  className
}: StaffSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = staff.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate text-left">
            {selected ? (
              <>
                <span className="font-medium">{selected.full_name}</span>
                <span className="ml-2 text-xs font-mono text-muted-foreground">
                  {selected.employee_code}
                </span>
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,24rem)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Type name or employee ID…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {staff.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.full_name} ${s.employee_code} ${s.id}`}
                  onSelect={() => {
                    onValueChange(s.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === s.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-medium">{s.full_name}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {s.employee_code}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
