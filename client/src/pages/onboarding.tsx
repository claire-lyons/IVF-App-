import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [treatmentType, setTreatmentType] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const [, setLocationPath] = useLocation();

  // Fetch treatment types from API
  const { data: treatmentTypes = [], isLoading: isLoadingTreatmentTypes, error: treatmentTypesError } = useQuery({
    queryKey: ["/api/reference/treatment-types"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/reference/treatment-types");
      if (!response.ok) {
        throw new Error("Failed to fetch treatment types");
      }
      return response.json();
    },
    retry: 2,
  });

  // Fetch clinics from API
  const { data: clinics = [], isLoading: isLoadingClinics, error: clinicsError } = useQuery({
    queryKey: ["/api/reference/clinics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/reference/clinics");
      if (!response.ok) {
        throw new Error("Failed to fetch clinics");
      }
      return response.json();
    },
    retry: 2,
  });

  // Set default treatment type when data loads
  useEffect(() => {
    if (treatmentTypes.length > 0 && !treatmentType) {
      setTreatmentType(treatmentTypes[0].id);
    }
  }, [treatmentTypes, treatmentType]);

  const handleContinue = () => {
    if (step === 1 && treatmentType) {
      setStep(2);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      const { data: { user }, error } = await supabase.auth.updateUser({
        data: {
          treatment_type: treatmentType,
          clinic_name: clinicName || null,
          onboarding_completed: true,
        },
      });

      if (error) throw error;

      toast({
        title: "Profile complete!",
        description: "Welcome to Foli. Let's get started!",
      });
      
      setLocationPath("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="max-w-sm mx-auto min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pt-12">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-card shadow-sm"
          data-testid="button-back"
        >
          <ArrowLeft className="text-foreground" size={20} />
        </Button>
        <h1 className="font-semibold" data-testid="title-profile-setup">Profile Setup</h1>
        <div className="w-10"></div>
      </div>
      
      {/* Progress */}
      <div className="px-6 mb-8">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span data-testid="text-step">Step {step} of 2</span>
          <span data-testid="text-progress">{Math.round((step / 2) * 100)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(step / 2) * 100}%` }}
          ></div>
        </div>
      </div>
      
      {/* Step Content */}
      <div className="px-6 space-y-3">
        {step === 1 && (
          <div>
            <Label className="block text-sm font-medium text-foreground mb-3" data-testid="label-treatment-type">
              What Type Of Treatment Are You Undergoing?
            </Label>
            {isLoadingTreatmentTypes ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : treatmentTypesError ? (
              <div className="text-sm text-destructive py-4">
                Failed to load treatment types. Please refresh the page.
              </div>
            ) : treatmentTypes.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">
                No treatment types available.
              </div>
            ) : (
              <RadioGroup value={treatmentType} onValueChange={setTreatmentType} className="space-y-3">
                {treatmentTypes.map((option: any) => (
                  <Card 
                    key={option.id}
                    className={`rounded-2xl p-4 border-2 shadow-sm cursor-pointer transition-colors ${
                      treatmentType === option.id ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center">
                      <RadioGroupItem value={option.id} id={option.id} className="text-primary" />
                      <Label htmlFor={option.id} className="ml-3 flex-1 cursor-pointer">
                        <div className="font-medium text-card-foreground" data-testid={`option-${option.id}-label`}>
                          {option.label}
                        </div>
                        {option.description && (
                          <div className="text-sm text-muted-foreground" data-testid={`option-${option.id}-description`}>
                            {option.description}
                          </div>
                        )}
                      </Label>
                    </div>
                  </Card>
                ))}
              </RadioGroup>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <Label className="block text-sm font-medium text-foreground mb-3" data-testid="label-clinic">
              Current Clinic (Optional)
            </Label>
            {isLoadingClinics ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : clinicsError ? (
              <div className="text-sm text-destructive py-4">
                Failed to load clinics. Please refresh the page.
              </div>
            ) : clinics.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">
                No clinics available.
              </div>
            ) : (
              <Select value={clinicName} onValueChange={setClinicName}>
                <SelectTrigger className="w-full bg-input border border-border rounded-xl p-3" data-testid="select-clinic">
                  <SelectValue placeholder="Select your clinic" />
                </SelectTrigger>
                <SelectContent>
                  {clinics.map((clinic: any) => (
                    <SelectItem key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground mt-2" data-testid="text-clinic-help">
              This helps us provide more personalized insights and connect you with relevant resources.
            </p>
          </div>
        )}
      </div>
      
      {/* Continue Button */}
      <div className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto p-6 bg-background">
        <Button 
          onClick={step === 2 ? handleComplete : handleContinue}
          disabled={
            (step === 1 && !treatmentType) ||
            isLoading
          }
          className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold shadow-sm h-auto"
          data-testid="button-continue"
        >
          {isLoading ? "Completing..." : step === 2 ? "Complete Setup" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
