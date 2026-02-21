import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Heart } from "lucide-react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    let mounted = true;
    let authListener: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    const handlePasswordRecovery = async () => {
      try {
        // First, check if we already have a session (user might be redirected here)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (mounted) setHasToken(true);
          return;
        }

        // Check for code in query parameters (PKCE flow)
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) throw error;
          
          if (mounted && data.session) {
            setHasToken(true);
            // Clear the code from URL
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }
        }

        // Check for tokens in hash fragment (implicit flow)
        if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const type = hashParams.get('type');
          
          if (type === 'recovery' && accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) throw error;
            
            if (mounted && data.session) {
              setHasToken(true);
              // Clear the hash from URL
              window.history.replaceState(null, '', window.location.pathname);
              return;
            }
          }
        }

        // Set up auth state change listener for cases where Supabase handles the redirect
        authListener = supabase.auth.onAuthStateChange((event, session) => {
          if (mounted && (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session))) {
            setHasToken(true);
            // Clear any hash or query params
            window.history.replaceState(null, '', window.location.pathname);
          }
        });

        // Give it a moment to see if auth state change fires
        // Supabase might take a moment to process the redirect
        setTimeout(async () => {
          if (mounted) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              setHasToken(true);
            } else {
              // Check one more time after a longer delay
              setTimeout(async () => {
                if (mounted) {
                  const { data: { session: retrySession } } = await supabase.auth.getSession();
                  if (retrySession) {
                    setHasToken(true);
                  } else {
                    // Only show error if we still don't have a token after waiting
                    console.warn('No session found after password recovery attempt');
                    toast({
                      title: "Invalid reset link",
                      description: "This password reset link is invalid or has expired. Please request a new one.",
                      variant: "destructive",
                    });
                    setTimeout(() => {
                      if (mounted) setLocation("/login");
                    }, 2000);
                  }
                }
              }, 1000);
            }
          }
        }, 2000);
      } catch (error: any) {
        if (mounted) {
          console.error('Password recovery error:', error);
          // Don't show error immediately - wait a bit to see if auth state change fires
          setTimeout(() => {
            if (mounted) {
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                  setHasToken(true);
                } else {
                  toast({
                    title: "Invalid reset link",
                    description: error.message || "This password reset link is invalid or has expired. Please request a new one.",
                    variant: "destructive",
                  });
                  setTimeout(() => {
                    if (mounted) setLocation("/login");
                  }, 2000);
                }
              });
            }
          }, 1000);
        }
      }
    };

    handlePasswordRecovery();

    return () => {
      mounted = false;
      if (authListener?.data?.subscription) {
        authListener.data.subscription.unsubscribe();
      }
    };
  }, [toast, setLocation]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please enter and confirm your new password",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are the same",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: "Password updated!",
        description: "Your password has been successfully reset. Please log in with your new password.",
      });

      // Sign out the user after successful password reset
      try {
        // Clear query cache first to stop any pending requests
        queryClient.clear();
        
        // Sign out from Supabase
        await supabase.auth.signOut();
        
        // Clear any cached data
        localStorage.clear();
        sessionStorage.clear();
        
        // Small delay to ensure auth state updates
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (signOutError) {
        console.error("Error signing out after password reset:", signOutError);
        // Continue with redirect even if sign out fails
        queryClient.clear();
        localStorage.clear();
        sessionStorage.clear();
      }

      // Redirect to login page
      setTimeout(() => {
        setLocation("/login");
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Failed to reset password",
        description: error.message || "Please try again or request a new reset link",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasToken) {
    return (
      <div className="max-w-sm mx-auto min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen bg-background">
      <div className="gradient-bg min-h-screen flex flex-col">
        <div className="pt-12 pb-8 text-center">
          <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            <Heart className="text-primary-foreground text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="title-reset-password">
            Reset Your Password
          </h1>
          <p className="text-muted-foreground px-6" data-testid="text-subtitle">
            Enter your new password below
          </p>
        </div>

        <div className="flex-1 px-6">
          <Card className="rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" data-testid="label-password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl"
                  data-testid="input-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" data-testid="label-confirm-password">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rounded-xl"
                  data-testid="input-confirm-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold h-auto mt-2"
                disabled={isLoading}
                data-testid="button-reset-password"
              >
                {isLoading ? "Resetting Password..." : "Reset Password"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
