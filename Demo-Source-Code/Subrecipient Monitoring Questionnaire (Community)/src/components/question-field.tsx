import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";

interface QuestionFieldProps {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'select' | 'yes-no';
  options?: string[];
  value?: any;
  onChange: (value: any) => void;
  error?: string;
}

export function QuestionField({
  id,
  label,
  description,
  required = false,
  type,
  options = [],
  value,
  onChange,
  error
}: QuestionFieldProps) {
  const renderField = () => {
    switch (type) {
      case 'text':
        return (
          <Input
            id={id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-destructive' : ''}
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            id={id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className={error ? 'border-destructive' : ''}
          />
        );
      
      case 'yes-no':
        return (
          <RadioGroup value={value} onValueChange={onChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`${id}-yes`} />
              <Label htmlFor={`${id}-yes`}>Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`${id}-no`} />
              <Label htmlFor={`${id}-no`}>No</Label>
            </div>
          </RadioGroup>
        );
      
      case 'radio':
        return (
          <RadioGroup value={value} onValueChange={onChange}>
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${id}-${index}`} />
                <Label htmlFor={`${id}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      
      case 'select':
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={error ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`${id}-${index}`}
                  checked={(value || []).includes(option)}
                  onCheckedChange={(checked) => {
                    const currentValue = value || [];
                    if (checked) {
                      onChange([...currentValue, option]);
                    } else {
                      onChange(currentValue.filter((v: string) => v !== option));
                    }
                  }}
                />
                <Label htmlFor={`${id}-${index}`}>{option}</Label>
              </div>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <Badge variant="destructive" className="text-xs px-1 py-0">Required</Badge>}
        </Label>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {renderField()}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}