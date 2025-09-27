import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { CheckCircle, Circle, AlertCircle } from "lucide-react";

interface Domain {
  id: number;
  name: string;
  shortName: string;
}

interface DomainTabsProps {
  currentDomain: number;
  onDomainChange: (domain: number) => void;
  completedDomains: number[];
  domainsWithErrors: number[];
}

const domains: Domain[] = [
  { id: 1, name: "Pressure Injuries", shortName: "Pressure Injuries" },
  { id: 2, name: "Restrictive Practices", shortName: "Restrictive Practices" },
  { id: 3, name: "Unplanned Weight Loss – Significant", shortName: "Weight Loss (Sig.)" },
  { id: 4, name: "Unplanned Weight Loss – Consecutive", shortName: "Weight Loss (Cons.)" },
  { id: 5, name: "Falls and Major Injury", shortName: "Falls & Injury" },
  { id: 6, name: "Medication – Polypharmacy", shortName: "Polypharmacy" },
  { id: 7, name: "Medication – Antipsychotics", shortName: "Antipsychotics" },
  { id: 8, name: "Activities of Daily Living (ADLs)", shortName: "ADLs" },
  { id: 9, name: "Incontinence Care (IAD)", shortName: "Incontinence Care" },
  { id: 10, name: "Hospitalisation", shortName: "Hospitalisation" },
  { id: 11, name: "Workforce", shortName: "Workforce" },
  { id: 12, name: "Consumer Experience (QCE-ACC)", shortName: "Consumer Exp." },
  { id: 13, name: "Quality of Life (QOL-ACC)", shortName: "Quality of Life" }
];

export function DomainTabs({ 
  currentDomain, 
  onDomainChange, 
  completedDomains, 
  domainsWithErrors 
}: DomainTabsProps) {
  const getTabIcon = (domainId: number) => {
    if (domainsWithErrors.includes(domainId)) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    } else if (completedDomains.includes(domainId)) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else {
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTabVariant = (domainId: number) => {
    if (currentDomain === domainId) {
      return "default";
    } else if (domainsWithErrors.includes(domainId)) {
      return "destructive";
    } else if (completedDomains.includes(domainId)) {
      return "secondary";
    } else {
      return "outline";
    }
  };

  return (
    <div className="border-b border-border bg-card">
      <ScrollArea className="w-full">
        <div className="flex min-w-max p-2 gap-1">
          {domains.map((domain) => (
            <Button
              key={domain.id}
              variant={getTabVariant(domain.id)}
              size="sm"
              onClick={() => onDomainChange(domain.id)}
              className="flex items-center gap-2 min-w-max px-3 py-2 h-auto whitespace-nowrap"
            >
              {getTabIcon(domain.id)}
              <span className="hidden sm:inline">{domain.name}</span>
              <span className="sm:hidden">{domain.shortName}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}