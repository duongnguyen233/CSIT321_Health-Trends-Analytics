import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";

interface ProgressTrackerProps {
  currentSection: number;
  totalSections: number;
  completedSections: number;
}

export function ProgressTracker({ 
  currentSection, 
  totalSections, 
  completedSections 
}: ProgressTrackerProps) {
  const progressPercentage = (completedSections / totalSections) * 100;

  return (
    <div className="mb-6 p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">Questionnaire Progress</h3>
        <Badge variant="outline">
          Section {currentSection} of {totalSections}
        </Badge>
      </div>
      <Progress value={progressPercentage} className="mb-2" />
      <p className="text-sm text-muted-foreground">
        {completedSections} of {totalSections} sections completed ({Math.round(progressPercentage)}%)
      </p>
    </div>
  );
}