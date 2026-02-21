import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function Terms() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/about")} data-testid="button-back-terms">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Terms of Service</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Using Foli</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
            <p>
              Foli provides tools to track fertility treatments, symptoms, and appointments. You are responsible for the
              accuracy of information you enter and for consulting your healthcare provider for medical advice.
            </p>
            <p>
              By using Foli you agree not to misuse the service, attempt unauthorized access, or share content that violates
              applicable laws. We may update these terms to improve the service; continued use constitutes acceptance of
              changes.
            </p>
            <p>
              Foli is provided "as is" without warranties. To the extent permitted by law, Foli is not liable for indirect
              or consequential damages arising from use of the app.
            </p>
            <p>
              For questions about these terms, contact{" "}
              <a href="mailto:foli.ivf@gmail.com" className="text-primary hover:underline">
                foli.ivf@gmail.com
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

