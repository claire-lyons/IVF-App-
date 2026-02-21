import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Book, MessageCircle, Mail } from "lucide-react";
import { useLocation } from "wouter";

export default function Help() {
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
          <h1 className="text-2xl font-bold">Help & Support</h1>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Get help quickly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => setLocation("/faqs")}
                data-testid="button-faqs"
              >
                <Book className="h-5 w-5" />
                Frequently Asked Questions
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => setLocation("/chat")}
                data-testid="button-ai-support"
              >
                <MessageCircle className="h-5 w-5" />
                Chat with AI Assistant
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => window.open("mailto:foli.ivf@gmail.com")}
                data-testid="button-contact-support"
              >
                <Mail className="h-5 w-5" />
                Contact Support
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I start tracking my cycle?</AccordionTrigger>
                  <AccordionContent>
                    Navigate to the Tracking page using the bottom navigation bar. Click the "Start New Cycle"
                    button and fill in your cycle details including type (IVF, IUI, etc.), start date, and clinic
                    information.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>How do I add medications?</AccordionTrigger>
                  <AccordionContent>
                    From the Tracking page, navigate to the Medications tab. Click "Add Medication" and enter
                    the medication name, dosage, frequency, and timing. You can also set reminders to help you
                    remember to take your medications.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>How do I track symptoms?</AccordionTrigger>
                  <AccordionContent>
                    Go to the Tracking page and select the Symptoms tab. Click "Log Symptom" and select the
                    symptom type, severity, and any notes. This helps you monitor your treatment progress and
                    share information with your healthcare provider.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I use the AI chat assistant?</AccordionTrigger>
                  <AccordionContent>
                    Navigate to the Chat page using the bottom navigation. You can ask the AI assistant questions
                    about your fertility journey, treatment options, or general support. Remember, the AI is for
                    informational purposes only and should not replace medical advice from your healthcare provider.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need More Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                If you can't find what you're looking for, please contact our support team:
              </p>
              <Button
                variant="default"
                className="w-full"
                onClick={() => window.open("mailto:foli.ivf@gmail.com")}
                data-testid="button-email-support"
              >
                Email Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
