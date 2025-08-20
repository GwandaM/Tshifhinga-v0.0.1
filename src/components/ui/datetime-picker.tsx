import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  min?: Date;
  max?: Date;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = "Select date and time",
  disabled = false,
  className,
  required = false,
  min,
  max,
}) => {
  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [inputValue, setInputValue] = useState(() => {
    if (value) {
      return formatDateTimeLocal(value);
    }
    return "";
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (newValue) {
      const date = new Date(newValue);
      if (!isNaN(date.getTime())) {
        onChange(date);
      }
    } else {
      onChange(undefined);
    }
  };

  React.useEffect(() => {
    if (value) {
      setInputValue(formatDateTimeLocal(value));
    } else {
      setInputValue("");
    }
  }, [value]);

  const minString = min ? formatDateTimeLocal(min) : undefined;
  const maxString = max ? formatDateTimeLocal(max) : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={`datetime-${label}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id={`datetime-${label}`}
        type="datetime-local"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={minString}
        max={maxString}
        className="w-full"
      />
    </div>
  );
};

export default DateTimePicker;