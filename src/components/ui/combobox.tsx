'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ComboboxProps {
  options: { label: string; value: string }[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  notFoundMessage?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  notFoundMessage = 'No options found.',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const currentLabelRaw = options.find((option) => option.value === value)?.label;
  const currentLabel =
    currentLabelRaw && currentLabelRaw.length > 90
      ? currentLabelRaw.slice(0, 90) + '...'
      : currentLabelRaw;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-full justify-between text-left min-w-0 overflow-hidden px-3"
          title={value ? currentLabelRaw || value : placeholder}
        >
          <span className="truncate flex-1 min-w-0 mr-2">
            {value ? currentLabel || value : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[min(480px,95vw)] p-0" 
        align="start" 
        side="bottom" 
        avoidCollisions={false}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{notFoundMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.label}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="flex items-start py-3"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0 mt-0.5',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="flex-1 whitespace-normal leading-snug">
                    {option.label}
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
