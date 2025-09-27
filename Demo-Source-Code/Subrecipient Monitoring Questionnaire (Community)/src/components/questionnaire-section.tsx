import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle, Circle, AlertCircle } from "lucide-react";

interface QuestionnaireSectionProps {
  title: string;
  description: string;
  isComplete: boolean;
  hasErrors: boolean;
  children: React.ReactNode;
}

export function QuestionnaireSection({ 
  title, 
  description, 
  isComplete, 
  hasErrors, 
  children 
}: QuestionnaireSectionProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasErrors ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle>{title}</CardTitle>
          </div>
          <Badge variant={isComplete ? "default" : "secondary"}>
            {isComplete ? "Complete" : "Incomplete"}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}