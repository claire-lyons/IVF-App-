import { useState } from "react";
import { Menu, Settings, HelpCircle, Info, LogOut, FileText, Mail, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

interface HamburgerMenuProps {
  className?: string;
}

export default function HamburgerMenu({ className = "fixed top-4 right-4 z-50" }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [location, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      setIsOpen(false);
      setShowLogoutDialog(false);
      
      // Clear query cache first to stop any pending requests
      const { queryClient } = await import("@/lib/queryClient");
      queryClient.clear();
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear any cached data
      localStorage.clear();
      sessionStorage.clear();
      
      // Small delay to ensure auth state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to login
      setLocation("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      // Still redirect even if there's an error
      setLocation("/login");
    }
  };

  const MenuItem = ({ icon: Icon, label, onClick, isDanger = false, path = "" }: any) => {
    const isActive = location === path;
    
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-accent rounded-lg transition-colors ${
          isDanger ? "text-destructive hover:text-destructive" : isActive ? "bg-accent text-foreground font-semibold" : "text-foreground"
        }`}
        data-testid={`menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-medium">{label}</span>
        </div>
        {isActive && <div className="h-2 w-2 rounded-full bg-primary"></div>}
        {!isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
      </button>
    );
  };

  const MenuSection = ({ title, children }: any) => (
    <div className="space-y-1">
      <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={className}
            data-testid="button-hamburger-menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Menu</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Settings Section */}
            <MenuSection title="Settings & Account">
              <MenuItem
                icon={Settings}
                label="Manage Account"
                path="/settings"
                onClick={() => {
                  setIsOpen(false);
                  setLocation("/settings");
                }}
              />
            </MenuSection>

            <Separator />

            {/* Tracking Section */}
            <MenuSection title="Tracking & Journal">
              <MenuItem
                icon={Calendar}
                label="Event Log"
                path="/events"
                onClick={() => {
                  setIsOpen(false);
                  setLocation("/events");
                }}
              />
            </MenuSection>

            <Separator />

            {/* Support & Help Section */}
            <MenuSection title="Support & Help">
              <MenuItem
                icon={FileText}
                label="Help Documentation"
                path="/help"
                onClick={() => {
                  setIsOpen(false);
                  setLocation("/help");
                }}
              />
              <MenuItem
                icon={Mail}
                label="Contact Support"
                onClick={() => {
                  window.open("mailto:foli.ivf@gmail.com", "_blank");
                  setIsOpen(false);
                }}
              />
              <MenuItem
                icon={HelpCircle}
                label="FAQs"
                path="/faqs"
                onClick={() => {
                  setIsOpen(false);
                  setLocation("/faqs");
                }}
              />
            </MenuSection>

            <Separator />

            {/* About Section */}
            <MenuSection title="About">
              <MenuItem
                icon={Info}
                label="About Foli"
                path="/about"
                onClick={() => {
                  setIsOpen(false);
                  setLocation("/about");
                }}
              />
            </MenuSection>

            <Separator />

            {/* Logout Button */}
            <div className="pt-4">
              <Button
                variant="destructive"
                className="w-full justify-start gap-3"
                onClick={() => setShowLogoutDialog(true)}
                data-testid="button-logout"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Log Out</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to log in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-logout">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-logout"
            >
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
