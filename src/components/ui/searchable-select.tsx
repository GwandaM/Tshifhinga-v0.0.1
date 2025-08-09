import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Plus } from "lucide-react";

interface SearchableSelectProps {
  items: string[];
  value?: string;
  onValueChange?: (value: string) => void;
  onAddItem?: (newItem: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  items,
  value = "",
  onValueChange,
  onAddItem,
  placeholder = "Select item...",
  label,
  disabled = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter items based on search term
  const filteredItems = items.filter(item =>
    item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if we should show "Add new" option
  const showAddNew = searchTerm.trim() !== "" && 
    !filteredItems.some(item => item.toLowerCase() === searchTerm.toLowerCase());

  // Reset search when popover closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (selectedValue: string) => {
    onValueChange?.(selectedValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleAddNew = () => {
    const trimmedTerm = searchTerm.trim();
    if (trimmedTerm && onAddItem) {
      onAddItem(trimmedTerm);
      onValueChange?.(trimmedTerm);
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems.length === 1) {
        handleSelect(filteredItems[0]);
      } else if (showAddNew) {
        handleAddNew();
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // Focus management for arrow keys could be added here
    }
  };

  // Get display value
  const displayValue = value || "";
  const hasValue = value && items.includes(value);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-label={label}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !hasValue && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {hasValue ? displayValue : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="border-b border-border">
          <Input
            ref={inputRef}
            placeholder={`Search ${label?.toLowerCase() || 'items'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        
        <div className="max-h-60 overflow-auto">
          {filteredItems.length === 0 && !showAddNew && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchTerm ? `No items found for "${searchTerm}"` : "No items found."}
            </div>
          )}
          
          {filteredItems.map((item) => (
            <button
              key={item}
              onClick={() => handleSelect(item)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                "flex items-center justify-between",
                value === item && "bg-accent text-accent-foreground"
              )}
            >
              <span className="truncate">{item}</span>
              {value === item && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
          
          {showAddNew && (
            <button
              onClick={handleAddNew}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 border-t border-border"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Add "{searchTerm}"</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};