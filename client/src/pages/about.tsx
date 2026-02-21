import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function About() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">About Foli</h1>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Version Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">App Version</span>
                  <span className="font-medium" data-testid="text-app-version">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">October 2025</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About the App</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Foli is a comprehensive fertility tracking application designed to support women
                going through IVF and fertility treatments in Australia. The app provides tools for
                tracking treatment cycles, medications, symptoms, and appointments, alongside
                community features and AI-powered support.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Legal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setLocation("/privacy")}
                data-testid="button-privacy-policy"
              >
                Privacy Policy
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setLocation("/terms")}
                data-testid="button-terms-of-service"
              >
                Terms of Service
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                For questions or support, please contact us at:
              </p>
              <a
                href="mailto:foli.ivf@gmail.com"
                className="text-primary hover:underline"
                data-testid="link-support-email"
              >
                foli.ivf@gmail.com
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
