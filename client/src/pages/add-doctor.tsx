import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, MapPin, Phone, Mail, Globe } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertDoctor } from "@shared/schema";

export default function AddDoctor() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    specialty: "",
    clinic: "",
    location: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    bulkBilling: false,
    bio: "",
    qualifications: ""
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertDoctor) => {
      await apiRequest("POST", "/api/doctors", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Doctor/clinic has been added successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      navigate("/doctors");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add doctor/clinic",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.specialty || !formData.location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Validate phone number if provided
    if (formData.phone && formData.phone.trim() !== "") {
      const digitsOnly = formData.phone.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        toast({
          title: "Invalid Phone Number",
          description: "Phone number must be 10-15 digits",
          variant: "destructive",
        });
        return;
      }
      // Update formData with digits-only phone number
      formData.phone = digitsOnly;
    }
    
    mutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const specialties = [
    "Reproductive Endocrinologist",
    "Fertility Specialist", 
    "Gynaecologist",
    "Obstetrician",
    "Andrologist",
    "Genetic Counsellor",
    "Other"
  ];

  const locations = [
    "Sydney CBD",
    "Bondi Junction", 
    "Parramatta",
    "North Sydney",
    "Chatswood",
    "Liverpool",
    "Blacktown",
    "Hornsby",
    "Other"
  ];

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="flex items-center p-6 pt-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/doctors")}
          className="w-10 h-10 rounded-full hover:bg-gray-100 mr-3"
          data-testid="button-back"
        >
          <ArrowLeft className="text-black" size={20} />
        </Button>
        <h1 className="text-xl font-semibold text-black" data-testid="title-add-doctor">
          Add Doctor or Clinic
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-3">
        {/* Basic Information */}
        <Card className="p-6 rounded-2xl border-2 border-gray-200">
          <h2 className="text-lg font-semibold text-black mb-4">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-black">
                Doctor Name or Clinic Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Dr. Sarah Smith or Sydney IVF Clinic"
                className="mt-1 bg-white border-2 border-gray-300 rounded-xl focus:border-black"
                data-testid="input-name"
              />
            </div>

            <div>
              <Label htmlFor="specialty" className="text-sm font-medium text-black">
                Specialty *
              </Label>
              <Select 
                value={formData.specialty} 
                onValueChange={(value) => handleInputChange("specialty", value)}
              >
                <SelectTrigger className="mt-1 bg-white border-2 border-gray-300 rounded-xl focus:border-black" data-testid="select-specialty">
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200">
                  {specialties.map(specialty => (
                    <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="clinic" className="text-sm font-medium text-black">
                Associated Clinic
              </Label>
              <Input
                id="clinic"
                value={formData.clinic}
                onChange={(e) => handleInputChange("clinic", e.target.value)}
                placeholder="Sydney IVF, Genea, etc."
                className="mt-1 bg-white border-2 border-gray-300 rounded-xl focus:border-black"
                data-testid="input-clinic"
              />
            </div>
          </div>
        </Card>

        {/* Location Information */}
        <Card className="p-6 rounded-2xl border-2 border-gray-200">
          <h2 className="text-lg font-semibold text-black mb-4">Location</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="location" className="text-sm font-medium text-black">
                Location *
              </Label>
              <Select 
                value={formData.location} 
                onValueChange={(value) => handleInputChange("location", value)}
              >
                <SelectTrigger className="mt-1 bg-white border-2 border-gray-300 rounded-xl focus:border-black" data-testid="select-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200">
                  {locations.map(location => (
                    <SelectItem key={location} value={location}>{location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="address" className="text-sm font-medium text-black">
                Full Address
              </Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="123 George Street, Sydney NSW 2000"
                  className="pl-10 bg-white border-2 border-gray-300 rounded-xl focus:border-black"
                  data-testid="input-address"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card className="p-6 rounded-2xl border-2 border-gray-200">
          <h2 className="text-lg font-semibold text-black mb-4">Contact Information</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-black">
                Phone Number
              </Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-3 text-gray-400" size={16} />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  maxLength={15}
                  onChange={(e) => {
                    // Only allow digits, max 15 characters
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 15) {
                      handleInputChange("phone", value);
                    }
                  }}
                  placeholder="Enter phone number (10-15 digits)"
                  className="pl-10 bg-white border-2 border-gray-300 rounded-xl focus:border-black"
                  data-testid="input-phone"
                />
              </div>
              {formData.phone && formData.phone.length > 0 && formData.phone.length < 10 && (
                <p className="text-xs text-muted-foreground mt-1">Phone number must be at least 10 digits</p>
              )}
              {formData.phone && formData.phone.length > 15 && (
                <p className="text-xs text-destructive mt-1">Phone number must be 15 digits or less</p>
              )}
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-black">
                Email Address
              </Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="contact@clinic.com.au"
                  className="pl-10 bg-white border-2 border-gray-300 rounded-xl focus:border-black"
                  data-testid="input-email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="website" className="text-sm font-medium text-black">
                Website
              </Label>
              <div className="relative mt-1">
                <Globe className="absolute left-3 top-3 text-gray-400" size={16} />
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  placeholder="https://www.clinic.com.au"
                  className="pl-10 bg-white border-2 border-gray-300 rounded-xl focus:border-black"
                  data-testid="input-website"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Additional Information */}
        <Card className="p-6 rounded-2xl border-2 border-gray-200">
          <h2 className="text-lg font-semibold text-black mb-4">Additional Information</h2>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="bulk-billing"
                checked={formData.bulkBilling}
                onCheckedChange={(checked) => handleInputChange("bulkBilling", checked as boolean)}
                className="border-2 border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                data-testid="checkbox-bulk-billing"
              />
              <Label htmlFor="bulk-billing" className="text-sm text-black">
                Offers Bulk Billing
              </Label>
            </div>

            <div>
              <Label htmlFor="qualifications" className="text-sm font-medium text-black">
                Qualifications
              </Label>
              <Textarea
                id="qualifications"
                value={formData.qualifications}
                onChange={(e) => handleInputChange("qualifications", e.target.value)}
                placeholder="MBBS, FRANZCOG, etc."
                rows={3}
                className="mt-1 bg-white border-2 border-gray-300 rounded-xl focus:border-black resize-none"
                data-testid="textarea-qualifications"
              />
            </div>

            <div>
              <Label htmlFor="bio" className="text-sm font-medium text-black">
                Biography
              </Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                placeholder="Brief description of expertise and experience..."
                rows={4}
                className="mt-1 bg-white border-2 border-gray-300 rounded-xl focus:border-black resize-none"
                data-testid="textarea-bio"
              />
            </div>
          </div>
        </Card>

        {/* Submit Button */}
        <div className="pb-8">
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-black text-white hover:bg-gray-800 py-4 rounded-xl font-medium text-lg"
            data-testid="button-submit"
          >
            {mutation.isPending ? "Adding Doctor..." : "Add Doctor/Clinic"}
          </Button>
        </div>
      </form>
    </div>
  );
}