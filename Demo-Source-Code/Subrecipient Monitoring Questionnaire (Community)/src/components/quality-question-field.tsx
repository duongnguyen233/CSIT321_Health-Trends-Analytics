import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface QualityQuestionFieldProps {
  id: string;
  label: string;
  type: 'number' | 'date' | 'text' | 'comment';
  required?: boolean;
  value?: any;
  onChange: (value: any) => void;
  error?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export function QualityQuestionField({
  id,
  label,
  type,
  required = false,
  value,
  onChange,
  error,
  placeholder,
  min,
  max
}: QualityQuestionFieldProps) {
  const renderField = () => {
    switch (type) {
      case 'number':
        return (
          <Input
            id={id}
            type="number"
            value={value || ''}
            onChange={(e) => {
              const val = e.target.value;
              // Only allow numbers
              if (val === '' || /^\d+$/.test(val)) {
                const numVal = val === '' ? undefined : parseInt(val);
                if (min !== undefined && numVal !== undefined && numVal < min) return;
                if (max !== undefined && numVal !== undefined && numVal > max) return;
                onChange(numVal);
              }
            }}
            placeholder={placeholder}
            className={error ? 'border-destructive' : ''}
            min={min}
            max={max}
          />
        );
      
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${error ? 'border-destructive' : ''} ${!value ? 'text-muted-foreground' : ''}`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), "PPP") : placeholder || "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => onChange(date?.toISOString())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      
      case 'text':
        return (
          <Input
            id={id}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={error ? 'border-destructive' : ''}
          />
        );
      
      case 'comment':
        return (
          <Textarea
            id={id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Enter additional comments..."}
            rows={3}
            className={error ? 'border-destructive' : ''}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {renderField()}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {type === 'number' && (min !== undefined || max !== undefined) && (
        <p className="text-xs text-muted-foreground">
          {min !== undefined && max !== undefined 
            ? `Valid range: ${min} - ${max}`
            : min !== undefined 
            ? `Minimum: ${min}`
            : `Maximum: ${max}`
          }
        </p>
      )}
    </div>
  );
}