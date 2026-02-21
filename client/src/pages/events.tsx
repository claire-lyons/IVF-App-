import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, FileText, Stethoscope, Plus, X, Tag, AlertCircle, Eye, Edit, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Event, Cycle, Milestone } from "@shared/schema";

const eventFormSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  location: z.string().optional(),
  cycleId: z.string().optional(),
  milestoneId: z.string().optional(),
  doctorName: z.string().optional(),
  doctorNotes: z.string().optional(),
  outcome: z.string().optional(),
  personalNotes: z.string().optional(),
  tags: z.string().optional(),
  phase: z.string().optional(),
  important: z.boolean().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export default function EventsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: cycles = [] } = useQuery<Cycle[]>({
    queryKey: ["/api/cycles"],
  });

  const { data: milestones = [] } = useQuery<Milestone[]>({
    queryKey: ["/api/milestones"],
  });

  const activeCycle = cycles.find((c) => c.status === "active");

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      eventType: "general_note",
      title: "",
      date: format(new Date(), "yyyy-MM-dd"),
      time: "",
      location: "",
      cycleId: activeCycle?.id || "",
      milestoneId: "",
      doctorName: "",
      doctorNotes: "",
      outcome: "",
      personalNotes: "",
      tags: "",
      phase: "",
      important: false,
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormValues) => {
      const eventData = {
        ...data,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()) : [],
        cycleId: data.cycleId && data.cycleId !== "none" ? data.cycleId : null,
        milestoneId: data.milestoneId && data.milestoneId !== "none" ? data.milestoneId : null,
        time: data.time || null,
        location: data.location || null,
        doctorName: data.doctorName || null,
        doctorNotes: data.doctorNotes || null,
        outcome: data.outcome || null,
        personalNotes: data.personalNotes || null,
        phase: data.phase && data.phase !== "none" ? data.phase : null,
      };
      return await apiRequest("POST", "/api/events", eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Event logged",
        description: "Your event has been saved successfully.",
      });
      form.reset();
      setIsCreateDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to log event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EventFormValues }) => {
      const eventData = {
        ...data,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()) : [],
        cycleId: data.cycleId && data.cycleId !== "none" ? data.cycleId : null,
        milestoneId: data.milestoneId && data.milestoneId !== "none" ? data.milestoneId : null,
        time: data.time || null,
        location: data.location || null,
        doctorName: data.doctorName || null,
        doctorNotes: data.doctorNotes || null,
        outcome: data.outcome || null,
        personalNotes: data.personalNotes || null,
        phase: data.phase && data.phase !== "none" ? data.phase : null,
      };
      return await apiRequest("PATCH", `/api/events/${id}`, eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Event updated",
        description: "Your event has been updated successfully.",
      });
      form.reset();
      setIsEditDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/events/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Event deleted",
        description: "The event has been removed.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EventFormValues) => {
    if (selectedEvent && isEditDialogOpen) {
      updateEventMutation.mutate({ id: selectedEvent.id, data });
    } else {
      createEventMutation.mutate(data);
    }
  };

  const handleViewEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsViewDialogOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    form.reset({
      eventType: event.eventType,
      title: event.title,
      date: event.date,
      time: event.time || "",
      location: event.location || "",
      cycleId: event.cycleId || "",
      milestoneId: event.milestoneId || "",
      doctorName: event.doctorName || "",
      doctorNotes: event.doctorNotes || "",
      outcome: event.outcome || "",
      personalNotes: event.personalNotes || "",
      tags: event.tags?.join(", ") || "",
      phase: event.phase || "",
      important: event.important || false,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedEvent) {
      deleteEventMutation.mutate(selectedEvent.id);
    }
  };

  const eventTypeOptions = [
    { value: "doctor_visit", label: "Doctor Visit", icon: Stethoscope },
    { value: "observation", label: "Observation", icon: FileText },
    { value: "test_result", label: "Test Result", icon: FileText },
    { value: "milestone", label: "Milestone", icon: Calendar },
    { value: "general_note", label: "General Note", icon: FileText },
  ];

  const phaseOptions = [
    { value: "stimulation", label: "Stimulation" },
    { value: "trigger", label: "Trigger" },
    { value: "retrieval", label: "Egg Retrieval" },
    { value: "fertilization", label: "Fertilization" },
    { value: "transfer", label: "Embryo Transfer" },
    { value: "waiting", label: "Two Week Wait" },
    { value: "pregnancy_test", label: "Pregnancy Test" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              className="h-8 w-8"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Event Log</h1>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-event">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Log New Event</DialogTitle>
                <DialogDescription>
                  Record important events, appointments, observations, and notes about your fertility journey.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="eventType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-event-type">
                              <SelectValue placeholder="Select event type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {eventTypeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Brief description of the event" 
                            {...field} 
                            data-testid="input-event-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              data-testid="input-event-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="time" 
                              {...field} 
                              data-testid="input-event-time"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Clinic name or location" 
                            {...field} 
                            data-testid="input-event-location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cycleId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cycle (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-event-cycle">
                                <SelectValue placeholder="Select cycle" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {cycles.map((cycle) => (
                                <SelectItem key={cycle.id} value={cycle.id}>
                                  {cycle.type} - {format(new Date(cycle.startDate), "MMM d, yyyy")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phase (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-event-phase">
                                <SelectValue placeholder="Select phase" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {phaseOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {form.watch("eventType") === "doctor_visit" && (
                    <>
                      <FormField
                        control={form.control}
                        name="doctorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Doctor Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Dr. Smith" 
                                {...field} 
                                data-testid="input-doctor-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="doctorNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Doctor's Notes & Recommendations</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="What did the doctor say? Any recommendations or next steps?"
                                rows={4}
                                {...field}
                                data-testid="textarea-doctor-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {(form.watch("eventType") === "test_result" || form.watch("eventType") === "doctor_visit") && (
                    <FormField
                      control={form.control}
                      name="outcome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Outcome/Results</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Test results, measurements, or outcomes"
                              rows={3}
                              {...field}
                              data-testid="textarea-outcome"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="personalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Observations & Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="How are you feeling? Any symptoms or observations?"
                            rows={4}
                            {...field}
                            data-testid="textarea-personal-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Comma-separated tags (e.g., ultrasound, bloodwork, side effects)" 
                            {...field} 
                            data-testid="input-event-tags"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="important"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Mark as Important</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Highlight this event for easy reference
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-important"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createEventMutation.isPending}
                      data-testid="button-submit-event"
                    >
                      {createEventMutation.isPending ? "Saving..." : "Log Event"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel-event"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {eventsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-events">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start logging your fertility journey events, appointments, and observations.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-log-first-event">
              Log Your First Event
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const eventTypeOption = eventTypeOptions.find(
                (opt) => opt.value === event.eventType
              );
              const EventIcon = eventTypeOption?.icon || FileText;

              return (
                <div
                  key={event.id}
                  className={`bg-card rounded-lg border p-4 ${
                    event.important ? "border-primary" : ""
                  }`}
                  data-testid={`event-card-${event.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${
                        event.important 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted"
                      }`}>
                        <EventIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold" data-testid={`event-title-${event.id}`}>
                            {event.title}
                          </h3>
                          {event.important && (
                            <AlertCircle className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(event.date), "MMM d, yyyy")}</span>
                          {event.time && (
                            <>
                              <Clock className="h-3 w-3 ml-1" />
                              <span>{event.time}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewEvent(event)}
                        data-testid={`button-view-event-${event.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditEvent(event)}
                        data-testid={`button-edit-event-${event.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEvent(event)}
                        data-testid={`button-delete-event-${event.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{event.location}</span>
                    </div>
                  )}

                  {event.doctorName && (
                    <div className="mb-2">
                      <span className="text-sm font-medium">Doctor: </span>
                      <span className="text-sm">{event.doctorName}</span>
                    </div>
                  )}

                  {event.doctorNotes && (
                    <div className="bg-muted rounded p-3 mb-2">
                      <p className="text-sm font-medium mb-1">Doctor's Notes:</p>
                      <p className="text-sm whitespace-pre-wrap">{event.doctorNotes}</p>
                    </div>
                  )}

                  {event.outcome && (
                    <div className="bg-muted rounded p-3 mb-2">
                      <p className="text-sm font-medium mb-1">Outcome/Results:</p>
                      <p className="text-sm whitespace-pre-wrap">{event.outcome}</p>
                    </div>
                  )}

                  {event.personalNotes && (
                    <div className="mb-2">
                      <p className="text-sm font-medium mb-1">Your Notes:</p>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {event.personalNotes}
                      </p>
                    </div>
                  )}

                  {event.tags && event.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {event.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-muted px-2 py-1 rounded"
                          data-testid={`tag-${tag}-${event.id}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Event Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update the event details below.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-event-type">
                          <SelectValue placeholder="Select event type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Brief description of the event" 
                        {...field} 
                        data-testid="input-edit-event-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-edit-event-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          {...field} 
                          data-testid="input-edit-event-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Clinic name or location" 
                        {...field} 
                        data-testid="input-edit-event-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cycleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cycle (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-event-cycle">
                            <SelectValue placeholder="Select cycle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {cycles.map((cycle) => (
                            <SelectItem key={cycle.id} value={cycle.id}>
                              {cycle.type} - {format(new Date(cycle.startDate), "MMM d, yyyy")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phase (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-event-phase">
                            <SelectValue placeholder="Select phase" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {phaseOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("eventType") === "doctor_visit" && (
                <>
                  <FormField
                    control={form.control}
                    name="doctorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doctor Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Dr. Smith" 
                            {...field} 
                            data-testid="input-edit-doctor-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="doctorNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doctor's Notes & Recommendations</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What did the doctor say? Any recommendations or next steps?"
                            rows={4}
                            {...field}
                            data-testid="textarea-edit-doctor-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {(form.watch("eventType") === "test_result" || form.watch("eventType") === "doctor_visit") && (
                <FormField
                  control={form.control}
                  name="outcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outcome/Results</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Test results, measurements, or outcomes"
                          rows={3}
                          {...field}
                          data-testid="textarea-edit-outcome"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="personalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Observations & Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="How are you feeling? Any symptoms or observations?"
                        rows={4}
                        {...field}
                        data-testid="textarea-edit-personal-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Comma-separated tags (e.g., ultrasound, bloodwork, side effects)" 
                        {...field} 
                        data-testid="input-edit-event-tags"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="important"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Mark as Important</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Highlight this event for easy reference
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-important"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={updateEventMutation.isPending}
                  data-testid="button-update-event"
                >
                  {updateEventMutation.isPending ? "Updating..." : "Update Event"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedEvent(null);
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Event Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Event Type</Label>
                <p className="text-base" data-testid="view-event-type">
                  {eventTypeOptions.find((opt) => opt.value === selectedEvent.eventType)?.label}
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p className="text-base font-semibold" data-testid="view-event-title">
                  {selectedEvent.title}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="text-base" data-testid="view-event-date">
                    {format(new Date(selectedEvent.date), "MMM d, yyyy")}
                  </p>
                </div>
                {selectedEvent.time && (
                  <div>
                    <Label className="text-muted-foreground">Time</Label>
                    <p className="text-base" data-testid="view-event-time">
                      {selectedEvent.time}
                    </p>
                  </div>
                )}
              </div>

              {selectedEvent.location && (
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <p className="text-base" data-testid="view-event-location">
                    {selectedEvent.location}
                  </p>
                </div>
              )}

              {selectedEvent.phase && (
                <div>
                  <Label className="text-muted-foreground">Phase</Label>
                  <p className="text-base" data-testid="view-event-phase">
                    {phaseOptions.find((opt) => opt.value === selectedEvent.phase)?.label}
                  </p>
                </div>
              )}

              {selectedEvent.doctorName && (
                <div>
                  <Label className="text-muted-foreground">Doctor Name</Label>
                  <p className="text-base" data-testid="view-doctor-name">
                    {selectedEvent.doctorName}
                  </p>
                </div>
              )}

              {selectedEvent.doctorNotes && (
                <div>
                  <Label className="text-muted-foreground">Doctor's Notes & Recommendations</Label>
                  <div className="bg-muted rounded-lg p-3 mt-1">
                    <p className="text-sm whitespace-pre-wrap" data-testid="view-doctor-notes">
                      {selectedEvent.doctorNotes}
                    </p>
                  </div>
                </div>
              )}

              {selectedEvent.outcome && (
                <div>
                  <Label className="text-muted-foreground">Outcome/Results</Label>
                  <div className="bg-muted rounded-lg p-3 mt-1">
                    <p className="text-sm whitespace-pre-wrap" data-testid="view-outcome">
                      {selectedEvent.outcome}
                    </p>
                  </div>
                </div>
              )}

              {selectedEvent.personalNotes && (
                <div>
                  <Label className="text-muted-foreground">Your Observations & Notes</Label>
                  <div className="bg-muted rounded-lg p-3 mt-1">
                    <p className="text-sm whitespace-pre-wrap" data-testid="view-personal-notes">
                      {selectedEvent.personalNotes}
                    </p>
                  </div>
                </div>
              )}

              {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Tags</Label>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {selectedEvent.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-muted px-2 py-1 rounded"
                        data-testid={`view-tag-${tag}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.important && (
                <div className="flex items-center gap-2 text-primary">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Marked as Important</span>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    setIsViewDialogOpen(false);
                    handleEditEvent(selectedEvent);
                  }}
                  className="flex-1"
                  data-testid="button-edit-from-view"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Event
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsViewDialogOpen(false);
                    setSelectedEvent(null);
                  }}
                  data-testid="button-close-view"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
              {selectedEvent && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="font-medium text-foreground">{selectedEvent.title}</p>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedEvent.date), "MMM d, yyyy")}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
