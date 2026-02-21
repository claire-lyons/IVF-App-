import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function Privacy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/about")} data-testid="button-back-privacy">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Privacy Policy</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Privacy Matters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground text-sm leading-relaxed">
            <p>
              We collect only the information needed to provide and improve Foli. This includes account details, health logs
              you choose to store, and technical data used to keep the app secure and reliable.
            </p>
            <p>
              Your data is never sold. We use it to deliver core features such as cycle tracking, medication reminders, and
              secure messaging. You can request export or deletion of your data at any time by contacting support.
            </p>
            <p>
              We protect your information with encryption in transit and at rest. Access is restricted to authorized systems
              required to operate the service.
            </p>
            <p>
              For questions or to exercise your privacy rights, email us at{" "}
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

