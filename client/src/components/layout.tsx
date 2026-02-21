import { ReactNode } from "react";
import BottomNavigation from "./bottom-navigation";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="max-w-sm mx-auto min-h-screen bg-background relative overflow-x-hidden w-full">
      <main className="pb-16 overflow-x-hidden w-full">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
