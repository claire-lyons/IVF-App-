import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Heart, Eye, EyeOff } from "lucide-react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Call backend proxy endpoint to avoid CORS issues
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Set the session in Supabase client for subsequent authenticated requests
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) {
          throw new Error(sessionError.message || 'Failed to set session');
        }
        // Wait for auth state change event to fire
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (data.user) {
        toast({
          title: "Welcome back!",
          description: "You've successfully logged in",
        });
        // Force a full page reload to ensure auth state is properly initialized
        window.location.href = "/";
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto min-h-screen bg-background">
      <div className="gradient-bg min-h-screen flex flex-col">
        <div className="pt-12 pb-8 text-center">
          <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            <Heart className="text-primary-foreground text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="title-login">
            Welcome to Foli
          </h1>
          <p className="text-muted-foreground px-6" data-testid="text-subtitle">
            Sign in to continue your fertility journey
          </p>
        </div>

        <div className="flex-1 px-6">
          <Card className="rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="label-email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                  data-testid="input-email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" data-testid="label-password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl pr-10"
                    data-testid="input-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-password"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <Link href="/forgot-password">
                  <span className="text-sm text-primary hover:underline cursor-pointer" data-testid="link-forgot-password">
                    Forgot Password?
                  </span>
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold h-auto"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground" data-testid="text-signup-prompt">
              Don't have an account?{" "}
              <Link href="/signup">
                <span className="text-primary font-semibold hover:underline cursor-pointer" data-testid="link-create-account">
                  Create Account
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
