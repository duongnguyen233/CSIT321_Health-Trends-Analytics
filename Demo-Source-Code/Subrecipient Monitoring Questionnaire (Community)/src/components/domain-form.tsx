import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { QualityQuestionField } from "./quality-question-field";

interface DomainFormProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function DomainForm({ title, description, children }: DomainFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
      </CardContent>
    </Card>
  );
}