import { Button } from "./ui/button";
import { Home, FileText, Database, Upload, LogIn, UserPlus } from "lucide-react";

export function GlobalNavigation() {
  return (
    <nav className="bg-card border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-1">
            <Button variant="ghost" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Home
            </Button>
            <Button variant="ghost" className="flex items-center gap-2 bg-accent text-accent-foreground">
              <FileText className="h-4 w-4" />
              Questionnaire Form
            </Button>
            <Button variant="ghost" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              My Data
            </Button>
            <Button variant="ghost" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              Login
            </Button>
            <Button size="sm" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}