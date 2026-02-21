import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Heart, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Email sent!",
        description: "Check your inbox for password reset instructions",
      });
    } catch (error: any) {
      toast({
        title: "Failed to send email",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto min-h-screen bg-background">
      <div className="gradient-bg min-h-screen flex flex-col">
        <div className="pt-12 pb-8">
          <Link href="/login">
            <Button 
              variant="ghost" 
              size="icon"
              className="ml-6 w-10 h-10 rounded-full bg-card shadow-sm"
              data-testid="button-back"
            >
              <ArrowLeft className="text-foreground" size={20} />
            </Button>
          </Link>
          
          <div className="text-center mt-6">
            <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
              <Heart className="text-primary-foreground text-3xl" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="title-forgot-password">
              Forgot Password?
            </h1>
            <p className="text-muted-foreground px-6" data-testid="text-subtitle">
              {emailSent 
                ? "We've sent you a password reset link" 
                : "Enter your email to receive a password reset link"}
            </p>
          </div>
        </div>

        <div className="flex-1 px-6">
          {!emailSent ? (
            <Card className="rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleResetPassword} className="space-y-4">
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

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold h-auto"
                  disabled={isLoading}
                  data-testid="button-reset-password"
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="rounded-2xl p-6 shadow-sm text-center">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground" data-testid="text-email-sent">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Button
                  onClick={() => setEmailSent(false)}
                  variant="outline"
                  className="w-full rounded-xl"
                  data-testid="button-try-again"
                >
                  Try Again
                </Button>
              </div>
            </Card>
          )}

          <div className="mt-6 text-center">
            <Link href="/login">
              <span className="text-sm text-primary hover:underline cursor-pointer" data-testid="link-back-to-login">
                Back to Sign In
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
