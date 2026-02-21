import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Cycle, Event } from "@shared/schema";
import { 
  ArrowLeft, 
  Star, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  User, 
  Calendar,
  MessageSquare,
  Filter,
  Stethoscope,
  Edit,
  Trash2,
  ThumbsUp,
  Plus
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Doctor, DoctorReview } from "@shared/schema";
// Google Maps is now loaded via iframe, no API key needed

export default function DoctorDetail() {
  const [, params] = useRoute("/doctors/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const doctorId = params?.id || "";

  const [reviewSort, setReviewSort] = useState<"recent" | "best" | "worst">("recent");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showCreateDoctorDialog, setShowCreateDoctorDialog] = useState(false);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPrice, setReviewPrice] = useState<string>("");
  const [reviewTreatmentType, setReviewTreatmentType] = useState<string>("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [newDoctorForm, setNewDoctorForm] = useState({
    name: "",
    specialty: "",
    clinic: "",
    location: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    bulkBilling: false,
  });
  
  // Booking state
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

  // Edit/Delete state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showEditDoctorDialog, setShowEditDoctorDialog] = useState(false);
  const [showDeleteDoctorDialog, setShowDeleteDoctorDialog] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [editDoctorForm, setEditDoctorForm] = useState({
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

  // Helper function to get the map URL for the doctor's location
  const getMapUrl = (doctor: Doctor) => {
    // Combine address and location for better results
    const address = doctor.address 
      ? `${doctor.address}, ${doctor.location || ''}`.trim().replace(/,\s*$/, '')
      : doctor.location || '';
    if (!address) return null;
    // Use Google Maps embed format that works without API key
    // This format properly embeds the map using the standard Google Maps embed URL
    return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
  };

  // Get current user ID
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });
  }, []);

  // Fetch doctor details
  const { data: doctor, isLoading: doctorLoading } = useQuery<Doctor>({
    queryKey: ["/api/doctors", doctorId],
    enabled: !!doctorId,
  });

  // Fetch reviews
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<DoctorReview[]>({
    queryKey: ["/api/doctors", doctorId, "reviews"],
    enabled: !!doctorId,
  });

  // Fetch active cycle for booking
  const { data: activeCycle } = useQuery<Cycle>({
    queryKey: ["/api/cycles/active"],
  });

  // Fetch user events to surface appointments for this doctor
  const { data: userEvents = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const doctorAppointments = useMemo(() => {
    if (!doctor?.name) return [];
    const doctorName = doctor.name.trim().toLowerCase();
    return (userEvents || [])
      .filter(
        (event) =>
          event.eventType === "doctor_visit" &&
          event.doctorName?.trim().toLowerCase() === doctorName,
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [doctor?.name, userEvents]);

  // Create review mutation
  const createReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string; price?: string; treatmentType?: string; anonymous: boolean }) => {
      await apiRequest("POST", `/api/doctors/${doctorId}/reviews`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your review has been submitted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment("");
      setReviewPrice("");
      setReviewTreatmentType("");
      setReviewAnonymous(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    },
  });

  // Create doctor mutation
  const createDoctorMutation = useMutation({
    mutationFn: async (data: typeof newDoctorForm) => {
      const response = await apiRequest("POST", "/api/doctors", data);
      return response.json();
    },
    onSuccess: (newDoctor) => {
      toast({
        title: "Success",
        description: "Doctor/clinic created successfully!",
      });
      setShowCreateDoctorDialog(false);
      setNewDoctorForm({
        name: "",
        specialty: "",
        clinic: "",
        location: "",
        address: "",
        phone: "",
        email: "",
        website: "",
        bulkBilling: false,
      });
      // Navigate to the new doctor's page
      navigate(`/doctors/${newDoctor.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create doctor/clinic",
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => {
    if (!reviewRating || reviewRating === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a rating",
        variant: "destructive",
      });
      return;
    }
    if (!reviewComment.trim()) {
      toast({
        title: "Missing Information",
        description: "Please write a review comment",
        variant: "destructive",
      });
      return;
    }
    createReviewMutation.mutate({
      rating: reviewRating,
      comment: reviewComment,
      price: reviewPrice || undefined,
      treatmentType: reviewTreatmentType || undefined,
      anonymous: reviewAnonymous,
    });
  };

  const handleCreateDoctor = () => {
    if (!newDoctorForm.name.trim() || !newDoctorForm.specialty || !newDoctorForm.location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (Name, Specialty, Location)",
        variant: "destructive",
      });
      return;
    }
    createDoctorMutation.mutate(newDoctorForm);
  };

  // Helpfulness voting mutation
  const helpfulnessMutation = useMutation({
    mutationFn: async ({ reviewId, helpful }: { reviewId: string; helpful: boolean }) => {
      const response = await apiRequest("POST", `/api/reviews/${reviewId}/helpful`, { helpful });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId, "reviews"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update helpfulness",
        variant: "destructive",
      });
    },
  });

  const handleToggleHelpful = (reviewId: string, helpful: boolean) => {
    if (!currentUserId) {
      toast({
        title: "Please Login",
        description: "You need to be logged in to vote on reviews",
        variant: "destructive",
      });
      return;
    }
    helpfulnessMutation.mutate({ reviewId, helpful });
  };

  // Booking mutation
  const bookingMutation = useMutation({
    mutationFn: async (data: { date: string; time: string; notes: string }) => {
      const eventData = {
        eventType: "doctor_visit",
        title: `Appointment with ${doctor?.name}`,
        date: data.date,
        time: data.time || null,
        location: doctor?.location || doctor?.address || null,
        doctorName: doctor?.name || null,
        personalNotes: data.notes || null,
        cycleId: activeCycle?.id || null,
      };
      await apiRequest("POST", "/api/events", eventData);

      // Events are created only in the events table, not in appointments
      // Appointments should be created separately if needed
    },
    onSuccess: () => {
      toast({
        title: "Appointment Booked",
        description: "Your appointment has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "events"] });
      setShowBookingDialog(false);
      setBookingDate(new Date().toISOString().split('T')[0]);
      setBookingTime("");
      setBookingNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBookAppointment = () => {
    if (!bookingDate) {
      toast({
        title: "Missing Information",
        description: "Please select an appointment date",
        variant: "destructive",
      });
      return;
    }
    bookingMutation.mutate({
      date: bookingDate,
      time: bookingTime,
      notes: bookingNotes,
    });
  };

  // Update doctor mutation
  const updateDoctorMutation = useMutation({
    mutationFn: async (data: Partial<Doctor>) => {
      await apiRequest("PATCH", `/api/doctors/${doctorId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Doctor information updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      setShowEditDoctorDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update doctor",
        variant: "destructive",
      });
    },
  });

  // Delete doctor mutation
  const deleteDoctorMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/doctors/${doctorId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Doctor deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      navigate("/doctors");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete doctor",
        variant: "destructive",
      });
    },
  });

  // Update review mutation
  const updateReviewMutation = useMutation({
    mutationFn: async (data: { reviewId: string; rating: number; comment: string; anonymous: boolean }) => {
      await apiRequest("PATCH", `/api/doctors/${doctorId}/reviews/${data.reviewId}`, {
        rating: data.rating,
        comment: data.comment,
        anonymous: data.anonymous,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Review updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      setEditingReviewId(null);
      setReviewRating(0);
      setReviewComment("");
      setReviewAnonymous(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update review",
        variant: "destructive",
      });
    },
  });

  // Delete review mutation
  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      await apiRequest("DELETE", `/api/doctors/${doctorId}/reviews/${reviewId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Review deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      setDeletingReviewId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete review",
        variant: "destructive",
      });
    },
  });

  // Initialize edit form when doctor data loads
  useEffect(() => {
    if (doctor && showEditDoctorDialog) {
      setEditDoctorForm({
        name: doctor.name || "",
        specialty: doctor.specialty || "",
        clinic: doctor.clinic || "",
        location: doctor.location || "",
        address: doctor.address || "",
        phone: doctor.phone || "",
        email: doctor.email || "",
        website: doctor.website || "",
        bulkBilling: doctor.bulkBilling || false,
        bio: doctor.bio || "",
        qualifications: doctor.qualifications || ""
      });
    }
  }, [doctor, showEditDoctorDialog]);

  const handleEditDoctor = () => {
    if (!editDoctorForm.name || !editDoctorForm.specialty || !editDoctorForm.location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    updateDoctorMutation.mutate(editDoctorForm);
  };

  const handleDeleteDoctor = () => {
    deleteDoctorMutation.mutate();
  };

  const handleEditReview = (review: DoctorReview) => {
    setEditingReviewId(review.id);
    setReviewRating(review.rating);
    setReviewComment(review.comment || "");
    setReviewAnonymous(review.anonymous || false);
  };

  const handleUpdateReview = () => {
    if (!editingReviewId) return;
    if (!reviewRating || reviewRating === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a rating",
        variant: "destructive",
      });
      return;
    }
    if (!reviewComment.trim()) {
      toast({
        title: "Missing Information",
        description: "Please write a review comment",
        variant: "destructive",
      });
      return;
    }
    updateReviewMutation.mutate({
      reviewId: editingReviewId,
      rating: reviewRating,
      comment: reviewComment,
      anonymous: reviewAnonymous,
    });
  };

  const handleDeleteReview = (reviewId: string) => {
    deleteReviewMutation.mutate(reviewId);
  };


  // Sort reviews
  const sortedReviews = [...reviews].sort((a, b) => {
    if (reviewSort === "recent") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (reviewSort === "best") {
      return b.rating - a.rating;
    } else {
      return a.rating - b.rating;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (doctorLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="px-6 pt-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/doctors")}
            className="mb-4"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Doctors
          </Button>
          <Card className="rounded-2xl p-6 text-center">
            <p className="text-gray-500">Doctor not found</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header with Back Button */}
      <div className="px-6 pt-6 pb-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/doctors")}
          className="mb-4 -ml-2"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back
        </Button>
      </div>

      {/* Doctor Header Card */}
      <div className="px-6 mb-6">
        <Card className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: 'hsl(74, 17%, 78%)' }}>
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
              <Stethoscope className="text-gray-400" size={28} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-1">
                <h1 className="text-xl font-bold text-foreground break-words" data-testid="doctor-detail-name">
                {doctor.name}
              </h1>
                {currentUserId && (
                  <div className="flex gap-2 ml-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-white/80"
                      onClick={() => setShowEditDoctorDialog(true)}
                      data-testid="button-edit-doctor"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-red-100"
                      onClick={() => setShowDeleteDoctorDialog(true)}
                      data-testid="button-delete-doctor"
                    >
                      <Trash2 size={16} className="text-red-600" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-gray-700 text-sm mb-2 break-words" data-testid="doctor-detail-specialty">
                {doctor.specialty}
              </p>
              {doctor.clinic && (
                <p className="text-gray-600 text-xs mb-3 break-words" data-testid="doctor-detail-clinic">
                  {doctor.clinic}
                </p>
              )}
              
              {/* Rating */}
              {doctor.rating && (
                <div className="flex items-center space-x-2 flex-wrap mt-2">
                  <div className="flex items-center space-x-1">
                    <Star className="text-yellow-400 fill-current" size={18} />
                    <span className="text-base font-semibold text-foreground" data-testid="doctor-detail-rating">
                      {Number(doctor.rating).toFixed(1)}
                    </span>
                  </div>
                  {doctor.reviewCount && (
                    <span className="text-xs text-gray-600" data-testid="doctor-detail-review-count">
                      ({doctor.reviewCount} {doctor.reviewCount === 1 ? 'review' : 'reviews'})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-6">
        <div className="flex gap-3">
          {doctor.phone && (
            <Button 
              variant="outline"
              className="flex-1 bg-white border-2 border-gray-300 text-black hover:bg-gray-50 py-3 rounded-xl font-medium"
              onClick={() => window.location.href = `tel:${doctor.phone}`}
              data-testid="button-call-doctor"
            >
              <Phone size={18} className="mr-2" />
              Call
            </Button>
          )}
          <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
            <DialogTrigger asChild>
              <Button 
                className="flex-1 bg-black text-white hover:bg-gray-800 py-3 rounded-xl font-medium"
                data-testid="button-book-appointment"
              >
                <Calendar size={18} className="mr-2" />
                Book Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Book Appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="booking-doctor" className="text-sm font-medium">
                    Doctor
                  </Label>
                  <Input
                    id="booking-doctor"
                    value={doctor?.name || ""}
                    disabled
                    className="mt-1 bg-gray-50"
                  />
                </div>
                
                <div>
                  <Label htmlFor="booking-date" className="text-sm font-medium">
                    Appointment Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="booking-date"
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                    data-testid="input-booking-date"
                  />
                </div>
                
                <div>
                  <Label htmlFor="booking-time" className="text-sm font-medium">
                    Time (Optional)
                  </Label>
                  <Input
                    id="booking-time"
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="mt-1"
                    data-testid="input-booking-time"
                  />
                </div>
                
                {doctor?.location && (
                  <div>
                    <Label htmlFor="booking-location" className="text-sm font-medium">
                      Location
                    </Label>
                    <Input
                      id="booking-location"
                      value={doctor.location}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                )}
                
                <div>
                  <Label htmlFor="booking-notes" className="text-sm font-medium">
                    Notes (Optional)
                  </Label>
                  <Textarea
                    id="booking-notes"
                    placeholder="Any questions or notes for this appointment..."
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    className="mt-1 min-h-[80px]"
                    data-testid="textarea-booking-notes"
                  />
                </div>
                
                <div className="flex space-x-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowBookingDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBookAppointment}
                    disabled={bookingMutation.isPending}
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                    data-testid="button-confirm-booking"
                  >
                    {bookingMutation.isPending ? "Booking..." : "Confirm Booking"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Appointments with this doctor */}
      <div className="px-6 mb-6">
        <Card className="p-5 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Appointments with this doctor</h3>
              <p className="text-sm text-muted-foreground">Upcoming and recent visits booked for {doctor?.name}</p>
            </div>
          </div>

          {doctorAppointments.length > 0 ? (
            <div className="space-y-3">
              {doctorAppointments.map((apt) => {
                const dateObj = new Date(apt.date);
                const dateLabel = isNaN(dateObj.getTime())
                  ? apt.date
                  : dateObj.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
                const timeLabel = isNaN(dateObj.getTime())
                  ? ""
                  : dateObj.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={apt.id} className="flex items-start justify-between p-3 rounded-xl border border-border bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{apt.title || "Appointment"}</p>
                      <p className="text-sm text-muted-foreground">
                        {dateLabel}
                        {timeLabel ? ` • ${timeLabel}` : ""}
                      </p>
                      {apt.location && (
                        <p className="text-sm text-muted-foreground truncate">
                          Location: {apt.location}
                        </p>
                      )}
                      {apt.notes && (
                        <p className="text-sm text-muted-foreground truncate">
                          Notes: {apt.notes}
                        </p>
                      )}
                    </div>
                    <Badge variant={apt.completed ? "secondary" : "outline"}>
                      {apt.completed ? "Completed" : "Scheduled"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                No appointments found for this doctor yet.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Contact Information */}
      <div className="px-6 mb-6">
        <Card className="rounded-2xl p-5 border-2 border-gray-200">
          <h2 className="font-semibold text-base text-foreground mb-4 flex items-center">
            <MapPin className="mr-2 text-gray-500" size={18} />
            Contact Information
          </h2>
          <div className="space-y-3">
            {doctor.location && (
              <div>
                <p className="text-sm font-medium text-foreground mb-1 break-words" data-testid="doctor-detail-location">
                  {doctor.location}
                </p>
                {doctor.address && (
                  <p className="text-xs text-gray-600 break-words" data-testid="doctor-detail-address">
                    {doctor.address}
                  </p>
                )}
              </div>
            )}
            
            {doctor.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="text-gray-500 flex-shrink-0" size={16} />
                <a 
                  href={`tel:${doctor.phone}`}
                  className="text-sm text-gray-700 hover:text-primary break-all"
                  data-testid="doctor-detail-phone"
                >
                  {doctor.phone}
                </a>
              </div>
            )}
            
            {doctor.email && (
              <div className="flex items-center space-x-2">
                <Mail className="text-gray-500 flex-shrink-0" size={16} />
                <a 
                  href={`mailto:${doctor.email}`}
                  className="text-sm text-gray-700 hover:text-primary break-all"
                  data-testid="doctor-detail-email"
                >
                  {doctor.email}
                </a>
              </div>
            )}
            
            {doctor.website && (
              <div className="flex items-center space-x-2">
                <Globe className="text-gray-500 flex-shrink-0" size={16} />
                <a 
                  href={doctor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-700 hover:text-primary break-all"
                  data-testid="doctor-detail-website"
                >
                  {doctor.website}
                </a>
              </div>
            )}

            {doctor.bulkBilling && (
              <div className="pt-2">
                <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs" data-testid="doctor-detail-bulk-billing">
                  Bulk Billing Available
                </Badge>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Map */}
      {(() => {
        const mapUrl = getMapUrl(doctor);
        const searchUrl = doctor.address || doctor.location 
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doctor.address || doctor.location || '')}`
          : null;
        
        if (!mapUrl || !searchUrl) return null;
        
        return (
        <div className="px-6 mb-6">
          <Card className="rounded-2xl overflow-hidden border-2 border-gray-200">
              <div className="relative w-full h-[320px] min-h-[320px]">
                <iframe
                  src={mapUrl}
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Map showing location of ${doctor.name}`}
                />
                {/* Fallback overlay link in case iframe doesn't load */}
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 bg-white hover:bg-gray-50 px-3 py-2 rounded-lg shadow-md text-sm text-primary hover:underline flex items-center gap-2 transition-colors z-10"
                >
                  <MapPin className="w-4 h-4" />
                  Open in Google Maps
                </a>
              </div>
          </Card>
        </div>
        );
      })()}

      {/* Bio and Qualifications */}
      {(doctor.bio || doctor.qualifications) && (
        <div className="px-6 mb-6">
          <Card className="rounded-2xl p-5 border-2 border-gray-200">
            {doctor.bio && (
              <div className="mb-4">
                <h2 className="font-semibold text-base text-foreground mb-2">About</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed" data-testid="doctor-detail-bio">
                  {doctor.bio}
                </p>
              </div>
            )}
            {doctor.qualifications && (
              <div>
                <h2 className="font-semibold text-base text-foreground mb-2">Qualifications</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed" data-testid="doctor-detail-qualifications">
                  {doctor.qualifications}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Reviews Section */}
      <div className="px-6 mb-6">
        <Card className="rounded-2xl p-5 border-2 border-gray-200">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-lg text-gray-900 flex items-center">
                <MessageSquare className="mr-2 text-gray-600 flex-shrink-0" size={20} />
                Reviews
              </h2>
              <div className="flex gap-2 flex-wrap">
                <Dialog open={showCreateDoctorDialog} onOpenChange={setShowCreateDoctorDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="bg-white border-2 border-gray-300 text-black hover:bg-gray-50 text-xs sm:text-sm"
                      data-testid="button-create-doctor"
                    >
                      <Plus size={14} className="mr-1.5 flex-shrink-0" />
                      <span className="whitespace-normal sm:whitespace-nowrap">Add Doctor/Clinic</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Doctor/Clinic</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="new-doctor-name" className="text-sm font-medium">
                          Doctor Name or Clinic Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="new-doctor-name"
                          value={newDoctorForm.name}
                          onChange={(e) => setNewDoctorForm(prev => ({ ...prev, name: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-doctor-specialty" className="text-sm font-medium">
                          Specialty <span className="text-red-500">*</span>
                        </Label>
                        <Select 
                          value={newDoctorForm.specialty} 
                          onValueChange={(value) => setNewDoctorForm(prev => ({ ...prev, specialty: value }))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select specialty" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Reproductive Endocrinologist", "Fertility Specialist", "Gynaecologist", "Obstetrician", "Andrologist", "Genetic Counsellor", "Other"].map(specialty => (
                              <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="new-doctor-clinic" className="text-sm font-medium">
                          Associated Clinic
                        </Label>
                        <Input
                          id="new-doctor-clinic"
                          value={newDoctorForm.clinic}
                          onChange={(e) => setNewDoctorForm(prev => ({ ...prev, clinic: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-doctor-location" className="text-sm font-medium">
                          Location <span className="text-red-500">*</span>
                        </Label>
                        <Select 
                          value={newDoctorForm.location} 
                          onValueChange={(value) => setNewDoctorForm(prev => ({ ...prev, location: value }))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Sydney CBD", "Bondi Junction", "Parramatta", "North Sydney", "Chatswood", "Liverpool", "Blacktown", "Hornsby", "Other"].map(location => (
                              <SelectItem key={location} value={location}>{location}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="new-doctor-address" className="text-sm font-medium">
                          Full Address
                        </Label>
                        <Input
                          id="new-doctor-address"
                          value={newDoctorForm.address}
                          onChange={(e) => setNewDoctorForm(prev => ({ ...prev, address: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="new-doctor-phone" className="text-sm font-medium">
                            Phone Number
                          </Label>
                          <Input
                            id="new-doctor-phone"
                            value={newDoctorForm.phone}
                            onChange={(e) => setNewDoctorForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-doctor-email" className="text-sm font-medium">
                            Email Address
                          </Label>
                          <Input
                            id="new-doctor-email"
                            type="email"
                            value={newDoctorForm.email}
                            onChange={(e) => setNewDoctorForm(prev => ({ ...prev, email: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="new-doctor-website" className="text-sm font-medium">
                          Website
                        </Label>
                        <Input
                          id="new-doctor-website"
                          type="url"
                          value={newDoctorForm.website}
                          onChange={(e) => setNewDoctorForm(prev => ({ ...prev, website: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="new-doctor-bulk-billing"
                          checked={newDoctorForm.bulkBilling}
                          onCheckedChange={(checked) => setNewDoctorForm(prev => ({ ...prev, bulkBilling: checked as boolean }))}
                        />
                        <Label htmlFor="new-doctor-bulk-billing" className="text-sm">
                          Offers Bulk Billing
                        </Label>
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowCreateDoctorDialog(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateDoctor}
                          disabled={createDoctorMutation.isPending}
                          className="flex-1 bg-black text-white hover:bg-gray-800"
                        >
                          {createDoctorMutation.isPending ? "Creating..." : "Create Doctor/Clinic"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              <Dialog open={showReviewForm} onOpenChange={setShowReviewForm}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm"
                    className="bg-black text-white hover:bg-gray-800 text-xs sm:text-sm"
                    data-testid="button-write-review"
                  >
                    <MessageSquare size={14} className="mr-1.5 flex-shrink-0" />
                    <span className="whitespace-normal sm:whitespace-nowrap">Write Review</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Write a Review</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label className="text-sm font-medium">Rating <span className="text-red-500">*</span></Label>
                      <div className="flex items-center space-x-2 mt-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setReviewRating(rating)}
                            className="focus:outline-none"
                          >
                            <Star
                              size={28}
                              className={reviewRating > 0 && rating <= reviewRating ? "text-yellow-400 fill-current" : "text-gray-300"}
                            />
                          </button>
                        ))}
                        {reviewRating > 0 ? (
                          <span className="ml-2 text-sm text-gray-600">{reviewRating} out of 5</span>
                        ) : (
                          <span className="ml-2 text-sm text-gray-400">Select a rating</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="review-comment" className="text-sm font-medium">
                        Your Review <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="review-comment"
                        placeholder="Share your experience with this doctor..."
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        className="mt-1 min-h-[100px]"
                        data-testid="textarea-review-comment"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4 items-end">
                      <div>
                        <Label htmlFor="review-price" className="text-sm font-medium whitespace-nowrap leading-tight">
                          Price (Optional)
                        </Label>
                        <Input
                          id="review-price"
                          type="number"
                          placeholder="e.g., 5000"
                          value={reviewPrice}
                          onChange={(e) => setReviewPrice(e.target.value)}
                          className="mt-1 h-11"
                          data-testid="input-review-price"
                        />
                      </div>
                      <div>
                        <Label htmlFor="review-treatment-type" className="text-sm font-medium whitespace-nowrap leading-tight">
                          Treatment Type (Optional)
                        </Label>
                        <Select value={reviewTreatmentType || undefined} onValueChange={(value) => setReviewTreatmentType(value || "")}>
                          <SelectTrigger className="mt-1 h-11 truncate" data-testid="select-review-treatment-type">
                            <SelectValue placeholder="Select type (Optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IVF">IVF</SelectItem>
                            <SelectItem value="IUI">IUI</SelectItem>
                            <SelectItem value="FET">Frozen Embryo Transfer</SelectItem>
                            <SelectItem value="Egg Freezing">Egg Freezing</SelectItem>
                            <SelectItem value="Consultation">Consultation</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="review-anonymous"
                        checked={reviewAnonymous}
                        onCheckedChange={(checked) => setReviewAnonymous(checked as boolean)}
                        className="border-2 border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                        data-testid="checkbox-review-anonymous"
                      />
                      <label htmlFor="review-anonymous" className="text-sm text-gray-700">
                        Post anonymously
                      </label>
                    </div>
                    
                    <div className="flex space-x-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowReviewForm(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSubmitReview}
                        disabled={createReviewMutation.isPending}
                        className="flex-1 bg-black text-white hover:bg-gray-800"
                        data-testid="button-submit-review"
                      >
                        {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </div>
            
            {/* Sort Filter */}
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-500 flex-shrink-0" />
                <Select value={reviewSort} onValueChange={(value: "recent" | "best" | "worst") => setReviewSort(value)}>
                  <SelectTrigger className="w-full sm:w-52 bg-white border-2 border-gray-300 text-gray-700 h-10 font-medium" data-testid="review-sort-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="best">Best Rating</SelectItem>
                    <SelectItem value="worst">Worst Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {reviewsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : sortedReviews.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="text-gray-400 mx-auto mb-2" size={40} />
              <p className="text-sm text-gray-500 mb-4" data-testid="no-reviews-message">
                No reviews yet. Be the first to review this doctor!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedReviews.map((review) => (
                <Card key={review.id} className="p-5 border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow w-full" data-testid={`review-card-${review.id}`}>
                  {/* Header: Rating, Date, Actions */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100">
                    {/* Left: Rating */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-0.5 mb-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Star
                            key={rating}
                            size={16}
                            className={rating <= review.rating ? "text-yellow-400 fill-current" : "text-gray-300"}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-gray-900" data-testid={`review-rating-${review.id}`}>
                        {review.rating}/5
                      </span>
                    </div>
                    
                    {/* Right: Date and Actions */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar size={14} className="flex-shrink-0 text-gray-400" />
                      <span className="whitespace-nowrap" data-testid={`review-date-${review.id}`}>
                        {formatDate(review.createdAt)}
                      </span>
                      </div>
                      {currentUserId && review.userId === currentUserId && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-gray-100 text-gray-600"
                            onClick={() => handleEditReview(review)}
                            data-testid={`button-edit-review-${review.id}`}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-red-50 text-red-600"
                            onClick={() => setDeletingReviewId(review.id)}
                            data-testid={`button-delete-review-${review.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Review Comment */}
                  {review.comment && (
                    <p className="text-sm text-gray-800 mb-3 whitespace-pre-wrap break-words leading-relaxed" data-testid={`review-comment-${review.id}`}>
                      {review.comment}
                    </p>
                  )}
                  
                  {/* Price, Treatment Type, and Anonymous Badges */}
                  {(review.price || review.treatmentType || review.anonymous) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {review.price && (
                        <Badge variant="outline" className="text-xs font-medium px-3 py-1 bg-gray-50 border-gray-300 text-gray-700 whitespace-nowrap">
                          ${parseFloat(review.price).toLocaleString()}
                        </Badge>
                      )}
                      {review.treatmentType && (
                        <Badge variant="outline" className="text-xs font-medium px-3 py-1 bg-gray-50 border-gray-300 text-gray-700 whitespace-nowrap">
                          {review.treatmentType}
                        </Badge>
                      )}
                  {review.anonymous && (
                        <Badge variant="outline" className="text-xs font-medium px-3 py-1 bg-gray-50 border-gray-300 text-gray-500 italic whitespace-nowrap">
                          Posted anonymously
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Helpfulness Voting */}
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleHelpful(review.id, true)}
                      className="h-8 px-3 text-xs font-medium hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md flex-shrink-0"
                      disabled={helpfulnessMutation.isPending}
                      data-testid={`button-helpful-${review.id}`}
                    >
                      <ThumbsUp size={16} className="mr-2" />
                      Helpful
                    </Button>
                    {review.helpfulCount !== undefined && review.helpfulCount > 0 && (
                      <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                        {review.helpfulCount} {review.helpfulCount === 1 ? 'person' : 'people'} found this helpful
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Edit Doctor Dialog */}
      <Dialog open={showEditDoctorDialog} onOpenChange={setShowEditDoctorDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Doctor Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-name" className="text-sm font-medium">
                Doctor Name or Clinic Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editDoctorForm.name}
                onChange={(e) => setEditDoctorForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-specialty" className="text-sm font-medium">
                Specialty <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={editDoctorForm.specialty} 
                onValueChange={(value) => setEditDoctorForm(prev => ({ ...prev, specialty: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  {["Reproductive Endocrinologist", "Fertility Specialist", "Gynaecologist", "Obstetrician", "Andrologist", "Genetic Counsellor", "Other"].map(specialty => (
                    <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-clinic" className="text-sm font-medium">
                Associated Clinic
              </Label>
              <Input
                id="edit-clinic"
                value={editDoctorForm.clinic}
                onChange={(e) => setEditDoctorForm(prev => ({ ...prev, clinic: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-location" className="text-sm font-medium">
                Location <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={editDoctorForm.location} 
                onValueChange={(value) => setEditDoctorForm(prev => ({ ...prev, location: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {["Sydney CBD", "Bondi Junction", "Parramatta", "North Sydney", "Chatswood", "Liverpool", "Blacktown", "Hornsby", "Other"].map(location => (
                    <SelectItem key={location} value={location}>{location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-address" className="text-sm font-medium">
                Full Address
              </Label>
              <Input
                id="edit-address"
                value={editDoctorForm.address}
                onChange={(e) => setEditDoctorForm(prev => ({ ...prev, address: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-phone" className="text-sm font-medium">
                Phone Number
              </Label>
              <Input
                id="edit-phone"
                value={editDoctorForm.phone}
                onChange={(e) => setEditDoctorForm(prev => ({ ...prev, phone: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editDoctorForm.email}
                onChange={(e) => setEditDoctorForm(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-website" className="text-sm font-medium">
                Website
              </Label>
              <Input
                id="edit-website"
                type="url"
                value={editDoctorForm.website}
                onChange={(e) => setEditDoctorForm(prev => ({ ...prev, website: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-bulk-billing"
                checked={editDoctorForm.bulkBilling}
                onCheckedChange={(checked) => setEditDoctorForm(prev => ({ ...prev, bulkBilling: checked as boolean }))}
              />
              <Label htmlFor="edit-bulk-billing" className="text-sm">
                Offers Bulk Billing
              </Label>
            </div>

            <div>
              <Label htmlFor="edit-qualifications" className="text-sm font-medium">
                Qualifications
              </Label>
              <Textarea
                id="edit-qualifications"
                value={editDoctorForm.qualifications}
                onChange={(e) => setEditDoctorForm(prev => ({ ...prev, qualifications: e.target.value }))}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="edit-bio" className="text-sm font-medium">
                Biography
              </Label>
              <Textarea
                id="edit-bio"
                value={editDoctorForm.bio}
                onChange={(e) => setEditDoctorForm(prev => ({ ...prev, bio: e.target.value }))}
                className="mt-1"
                rows={4}
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowEditDoctorDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditDoctor}
                disabled={updateDoctorMutation.isPending}
                className="flex-1 bg-black text-white hover:bg-gray-800"
              >
                {updateDoctorMutation.isPending ? "Updating..." : "Update Doctor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Doctor Confirmation */}
      <AlertDialog open={showDeleteDoctorDialog} onOpenChange={setShowDeleteDoctorDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this doctor? This action cannot be undone. All reviews associated with this doctor will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDoctor}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteDoctorMutation.isPending}
            >
              {deleteDoctorMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Review Dialog */}
      <Dialog open={!!editingReviewId} onOpenChange={(open) => !open && setEditingReviewId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Rating <span className="text-red-500">*</span></Label>
              <div className="flex items-center space-x-2 mt-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className="focus:outline-none"
                  >
                    <Star
                      size={28}
                      className={reviewRating > 0 && rating <= reviewRating ? "text-yellow-400 fill-current" : "text-gray-300"}
                    />
                  </button>
                ))}
                {reviewRating > 0 ? (
                  <span className="ml-2 text-sm text-gray-600">{reviewRating} out of 5</span>
                ) : (
                  <span className="ml-2 text-sm text-gray-400">Select a rating</span>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-review-comment" className="text-sm font-medium">
                Your Review <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="edit-review-comment"
                placeholder="Share your experience with this doctor..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="mt-1 min-h-[100px]"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-review-anonymous"
                checked={reviewAnonymous}
                onCheckedChange={(checked) => setReviewAnonymous(checked as boolean)}
              />
              <label htmlFor="edit-review-anonymous" className="text-sm text-gray-700">
                Post anonymously
              </label>
            </div>
            
            <div className="flex space-x-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingReviewId(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateReview}
                disabled={updateReviewMutation.isPending}
                className="flex-1 bg-black text-white hover:bg-gray-800"
              >
                {updateReviewMutation.isPending ? "Updating..." : "Update Review"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Review Confirmation */}
      <AlertDialog open={!!deletingReviewId} onOpenChange={(open) => !open && setDeletingReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this review? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingReviewId && handleDeleteReview(deletingReviewId)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteReviewMutation.isPending}
            >
              {deleteReviewMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
