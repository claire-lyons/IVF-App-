import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, Calendar, UserCheck, Brain } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="max-w-sm mx-auto min-h-screen bg-background relative">
      <div className="gradient-bg min-h-screen flex flex-col">
        {/* Header */}
        <div className="pt-12 pb-8 text-center">
          <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            <Heart className="text-primary-foreground text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="title-welcome">
            Welcome to Foli
          </h1>
          <p className="text-muted-foreground px-6" data-testid="text-subtitle">
            Your supportive companion through your fertility journey
          </p>
        </div>
        
        {/* Feature Cards */}
        <div className="flex-1 px-6 space-y-6">
          <Card className="rounded-2xl p-6 shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="text-accent-foreground" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground mb-1" data-testid="feature-track-title">
                  Track Your Journey
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="feature-track-description">
                  Monitor cycles, medications, symptoms, and appointments in one place
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="rounded-2xl p-6 shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center flex-shrink-0">
                <UserCheck className="text-accent-foreground" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground mb-1" data-testid="feature-support-title">
                  Find Support
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="feature-support-description">
                  Connect with doctors, clinics, and a supportive community
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="rounded-2xl p-6 shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center flex-shrink-0">
                <Brain className="text-accent-foreground" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground mb-1" data-testid="feature-insights-title">
                  Get Insights
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="feature-insights-description">
                  Receive personalized insights and educational resources
                </p>
              </div>
            </div>
          </Card>
        </div>
        
        {/* CTA Section */}
        <div className="px-6 pb-8 pt-4">
          <Button 
            onClick={handleLogin}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold shadow-sm h-auto"
            data-testid="button-get-started"
          >
            Get Started
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-4" data-testid="text-terms">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
