import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, ExternalLink, Heart, Users, Building2, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function FAQs() {
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
          <h1 className="text-2xl font-bold">Frequently Asked Questions</h1>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>General Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="q1">
                  <AccordionTrigger>What is Foli?</AccordionTrigger>
                  <AccordionContent>
                    Foli is a comprehensive fertility tracking application designed specifically for women going
                    through IVF and fertility treatments in Australia. It helps you track cycles, medications,
                    symptoms, appointments, and provides community support and AI-powered assistance throughout
                    your fertility journey.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q2">
                  <AccordionTrigger>Is my data secure?</AccordionTrigger>
                  <AccordionContent>
                    Yes, your data is securely stored and encrypted. We use industry-standard security measures
                    to protect your personal health information. Your data is never shared with third parties
                    without your explicit consent. For more details, please review our Privacy Policy.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q3">
                  <AccordionTrigger>Can I use Foli for free?</AccordionTrigger>
                  <AccordionContent>
                    Yes, Foli offers a free tier with core tracking features. Premium features may be available
                    in the future for additional functionality. Check the app for current pricing and feature
                    availability.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tracking Features</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="q4">
                  <AccordionTrigger>What types of cycles can I track?</AccordionTrigger>
                  <AccordionContent>
                    Foli supports tracking for IVF (In Vitro Fertilization), IUI (Intrauterine Insemination),
                    FET (Frozen Embryo Transfer), and Egg Freezing cycles. You can track multiple cycles and
                    view your complete treatment history.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q5">
                  <AccordionTrigger>How do medication reminders work?</AccordionTrigger>
                  <AccordionContent>
                    When you add a medication and enable reminders, Foli will send you notifications at the
                    specified times to remind you to take your medication. You can customize reminder times
                    and frequency based on your medication schedule.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q6">
                  <AccordionTrigger>Can I export my data?</AccordionTrigger>
                  <AccordionContent>
                    Data export features are coming soon. This will allow you to download your tracking data
                    in various formats to share with your healthcare provider or for your own records.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Assistant</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="q7">
                  <AccordionTrigger>What can the AI assistant help with?</AccordionTrigger>
                  <AccordionContent>
                    The AI assistant can provide information about fertility treatments, answer general questions
                    about the IVF process, offer emotional support, and help you understand your tracking data.
                    However, it should not be used as a substitute for professional medical advice.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q8">
                  <AccordionTrigger>Is the AI assistant a replacement for my doctor?</AccordionTrigger>
                  <AccordionContent>
                    No, the AI assistant is for informational and support purposes only. It should never replace
                    consultation with your healthcare provider. Always consult your doctor or fertility specialist
                    for medical advice, diagnosis, or treatment recommendations.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="q9">
                  <AccordionTrigger>How does the community feature work?</AccordionTrigger>
                  <AccordionContent>
                    The community feature allows you to connect with other women going through similar fertility
                    journeys. You can share experiences, ask questions, and offer support. You have the option
                    to post anonymously if you prefer to keep your identity private.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="q10">
                  <AccordionTrigger>Can I post anonymously?</AccordionTrigger>
                  <AccordionContent>
                    Yes, when creating a post or comment in the community, you can choose to post anonymously.
                    This allows you to share your experiences and seek support while maintaining your privacy.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Resources & Support Organizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Fertility Counsellors */}
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    Fertility Counsellors
                  </h3>
                  <div className="space-y-2 pl-6">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">
                        Australian and New Zealand Infertility Counsellors Association (ANZICA)
                      </p>
                      <p className="text-gray-600">
                        A professional association for infertility counsellors that strives to promote a high standard of counselling for individuals affected by infertility issues.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Consumer Organisations */}
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    Consumer Organisations
                  </h3>
                  <div className="space-y-3 pl-6">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">Your Fertility</p>
                      <p className="text-gray-600 mb-2">
                        A website providing information about fertility options funded by the Australian Government Department of Health and the Victorian Government Department of Health and Human Services.
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">Healthy Male</p>
                      <p className="text-gray-600 mb-2">
                        A national organisation that provides easy access to the latest scientific and medical research on male reproductive and sexual health.
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">Fertility Matters</p>
                      <p className="text-gray-600 mb-2">
                        A national campaign developed by a group of "IVF-lings" (the first generation of ART-conceived babies, now adults) that aims to raise awareness and education of fertility, particularly in schools and with young people.
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">Surrogacy Australia</p>
                      <p className="text-gray-600 mb-2">
                        A national organisation that aims to enhance the understanding of, and access to, best practice surrogacy arrangements through education, support and advocacy.
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">Rainbow Families</p>
                      <p className="text-gray-600 mb-2">
                        A charity that has a mission to support, celebrate, empower and advocate for Rainbow Families at every stage of their lives.
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">Raising Children Network – the Australian Parenting website</p>
                      <p className="text-gray-600 mb-2">
                        A website that has links to national, state and territory support services and resources for LGBTIQ+ parents, their children and their family and friends.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Professional Bodies */}
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    Professional Bodies
                  </h3>
                  <div className="space-y-3 pl-6">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">
                        Fertility Society of Australia and New Zealand
                      </p>
                      <p className="text-gray-600 mb-2">
                        The peak professional body representing scientists, doctors, researchers, nurses, consumers and counsellors in reproductive medicine in Australia & New Zealand.
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">
                        Australian and New Zealand Assisted Reproduction Database (ANZARD)
                      </p>
                      <p className="text-gray-600 mb-2">
                        A Clinical Quality Registry comprising information on all assisted reproductive technology (ART) treatment cycles performed in Australian and New Zealand fertility clinics. The ANZARD Annual Report is published each year and is available on the National Perinatal Epidemiology and Statistics Unit's website.
                      </p>
                    </div>
                  </div>
                </div>

                {/* State Government Authorities */}
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-500" />
                    State Government Authorities
                  </h3>
                  <div className="space-y-2 pl-6">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">
                        Western Australia Reproductive Technology Council
                      </p>
                      <p className="text-gray-600">
                        A statutory authority established by the WA Government to provide advice, review the industry Code of Practice, encourage and facilitate research and promote informed public debate on reproductive technologies.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Still Have Questions?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                If you didn't find the answer you're looking for, please contact our support team:
              </p>
              <Button
                variant="default"
                className="w-full"
                onClick={() => window.open("mailto:foli.ivf@gmail.com")}
                data-testid="button-contact-support"
              >
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
