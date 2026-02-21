import { Button } from "@/components/ui/button";
import { Home, TrendingUp, Stethoscope, Users, Bot } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function BottomNavigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "Dashboard", testId: "nav-home" },
    { path: "/tracking", icon: TrendingUp, label: "Log", testId: "nav-tracking" },
    { path: "/doctors", icon: Stethoscope, label: "Doctors", testId: "nav-doctors" },
    { path: "/community", icon: Users, label: "Support", testId: "nav-community" },
    { path: "/chat", icon: Bot, label: "Chat", testId: "nav-chat" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto bg-card border-t border-border z-50">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ path, icon: Icon, label, testId }) => {
          const isActive = location === path;
          
          return (
            <Link key={path} href={path}>
              <Button
                variant="ghost"
                className={`flex flex-col items-center py-2 px-3 h-auto space-y-1 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                } hover:text-primary transition-colors`}
                data-testid={testId}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
