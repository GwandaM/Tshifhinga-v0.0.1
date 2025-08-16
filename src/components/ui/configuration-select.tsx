import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Plus, Loader2 } from "lucide-react";

interface ConfigurationItem {
  code: string;
  name: string;
}

interface ConfigurationSelectProps {
  items: ConfigurationItem[];
  value?: string;
  onValueChange?: (value: string) => void;
  onAddItem?: (name: string, description?: string) => Promise<string>;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export const ConfigurationSelect: React.FC<ConfigurationSelectProps> = ({
  items = [],
  value = "",
  onValueChange,
  onAddItem,
  placeholder = "Select item...",
  label,
  disabled = false,
  className,
  allowEmpty = false,
  emptyLabel = "None",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");

  // Filter items based on search term
  const filteredItems = items.filter(item =>
    item && item.name && item.code &&
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Check if we should show "Add new" option
  const showAddNew = searchTerm.trim() !== "" && 
    !filteredItems.some(item => 
      item && item.name && item.code &&
      (item.name.toLowerCase() === searchTerm.toLowerCase() ||
      item.code.toLowerCase() === searchTerm.toLowerCase())
    ) && onAddItem;

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

  const handleAddNew = async () => {
    const trimmedTerm = searchTerm.trim();
    if (trimmedTerm && onAddItem) {
      setIsCreating(true);
      try {
        const newCode = await onAddItem(trimmedTerm, description);
        onValueChange?.(newCode);
        setIsOpen(false);
        setSearchTerm("");
        setDescription("");
      } catch (error) {
        console.error('Failed to create new item:', error);
        // You might want to show a toast error here
      } finally {
        setIsCreating(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems.length === 1) {
        handleSelect(filteredItems[0].code);
      } else if (showAddNew && !isCreating) {
        handleAddNew();
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // Focus management for arrow keys could be added here
    }
  };

  // Get display value
  const selectedItem = items && items.find(item => item && item.code === value);
  const displayValue = selectedItem && selectedItem.name ? selectedItem.name : "";
  const hasValue = value && selectedItem;

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
            disabled={isCreating}
          />
        </div>
        
        <div className="max-h-60 overflow-auto">
          {allowEmpty && (
            <button
              onClick={() => handleSelect("")}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                "flex items-center justify-between border-b border-border",
                value === "" && "bg-accent text-accent-foreground"
              )}
            >
              <span className="truncate text-muted-foreground italic">{emptyLabel}</span>
              {value === "" && <Check className="h-4 w-4 shrink-0" />}
            </button>
          )}

          {filteredItems.length === 0 && !showAddNew && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchTerm ? `No items found for "${searchTerm}"` : "No items found."}
            </div>
          )}
          
          {filteredItems.map((item) => (
            <button
              key={item.code}
              onClick={() => handleSelect(item.code)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                "flex items-center justify-between",
                value === item.code && "bg-accent text-accent-foreground"
              )}
              disabled={isCreating}
            >
              <span className="truncate">{item.name}</span>
              {value === item.code && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
          
          {showAddNew && (
            <div className="border-t border-border p-2">
              <Input
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mb-2"
              />
              <button
                onClick={handleAddNew}
                disabled={isCreating}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0" />
                )}
                <span>{isCreating ? "Creating..." : `Add "${searchTerm}"`}</span>
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};