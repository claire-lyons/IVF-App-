import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Pill, Activity, TestTube, Plus, Clock, Syringe, Target, AlertCircle, CheckCircle2, MapPin, Stethoscope, X, Play, Pause, Info, Lightbulb, FileText, Download, Copy, Droplet, Scan, Scissors, ClipboardList, Trash2, Edit, Pencil } from "lucide-react";
import HamburgerMenu from "@/components/hamburger-menu";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Cycle, Medication, Symptom, Appointment, TestResult, Milestone, Event } from "@shared/schema";
import { getMilestonesForCycle, getMilestoneByName, type CyclePhase, getMilestoneForDay, getEstimatedCycleLength, calculateCycleDay, getLatestActiveMilestone, getMilestoneByType, getStageInfoFromData, getMilestoneSummary, type StageReferenceData, getStageInfoWithJsonFallback } from "@/lib/cycleUtils";
import { loadMedicationData, getMedicationInfo, getMedicationInfoById, createMedicationInfo, type MedicationInfo } from "@/lib/medicationUtils";

interface CycleSummaryData {
  cycle: Cycle;
  medications: Medication[];
  symptoms: Symptom[];
  testResults: TestResult[];
  milestones: Milestone[];
  appointments: Appointment[];
  events: Event[];
}

// Format date as YYYY-MM-DD in local timezone (not UTC)
const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTestName = (name: string): string => {
  if (!name) return "";
  // Handle special cases
  if (name === 'endometrial_thickness') return 'Ultrasound';
  if (name === 'egg_collection') return 'Other';
  // Replace underscores with spaces and capitalize words
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatDisplayDate = (value: string | Date | null | undefined) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDisplayDateTime = (value: string | Date | null | undefined) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toSentenceCase = (value?: string | null) => {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const SummarySection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h4 className="font-semibold text-foreground">{title}</h4>
    {children}
  </div>
);

const EmptySummaryState = ({ message }: { message: string }) => (
  <div className="p-4 text-sm text-muted-foreground border border-dashed rounded-lg">{message}</div>
);

type ReminderItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  date: Date;
  type: "event" | "appointment";
  location?: string | null;
};

const formatReminderDateTime = (date: Date) => {
  const datePart = date.toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const hasSpecificTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const timePart = hasSpecificTime
    ? date.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    })
    : "All day";
  return `${datePart} • ${timePart}`;
};

const getReminderStatusMeta = (date: Date) => {
  const diffMs = date.getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < -60 * 60 * 1000) {
    return { label: "Past", className: "bg-muted text-muted-foreground border-border" };
  }
  if (diffMs < 0) {
    return { label: "Now", className: "bg-amber-100 text-amber-800 border-amber-200" };
  }
  if (diffHours < 1) {
    return { label: "Soon", className: "bg-amber-100 text-amber-800 border-amber-200" };
  }
  if (diffHours < 24) {
    return { label: "Today", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }
  if (diffHours < 24 * 3) {
    return { label: "This Week", className: "bg-sky-100 text-sky-800 border-sky-200" };
  }
  return { label: "Scheduled", className: "bg-muted text-muted-foreground border-border" };
};

const getEventSubtitle = (event: Event) => {
  if (event.personalNotes) return event.personalNotes;
  const labels: Record<string, string> = {
    test_result: "Lab or bloodwork reminder",
    procedure: "Clinic procedure",
    medication: "Medication reminder",
    general_note: "Personal reminder",
  };
  return labels[event.eventType as keyof typeof labels] || "Cycle reminder";
};

const toReminderDate = (value: string | Date | null | undefined, time?: string | null) => {
  if (!value) return null;
  const parsed = typeof value === "string" || typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (time) {
    const [hours, minutes] = time.split(":");
    parsed.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  }
  return parsed;
};

export default function Tracking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("cycle");
  const [newCycleType, setNewCycleType] = useState("");
  const [newCycleStartDate, setNewCycleStartDate] = useState("");
  const [newCycleClinic, setNewCycleClinic] = useState("");
  const [newCycleDoctor, setNewCycleDoctor] = useState("");
  const [selectedSymptom, setSelectedSymptom] = useState("");
  const [symptomSeverity, setSymptomSeverity] = useState("");
  const [symptomDuration, setSymptomDuration] = useState("");
  const [showAddTest, setShowAddTest] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState("");
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showCycleActions, setShowCycleActions] = useState(false);
  const [milestoneType, setMilestoneType] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [editingMilestone, setEditingMilestone] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editMilestoneStatus, setEditMilestoneStatus] = useState("");
  const [editMilestoneDate, setEditMilestoneDate] = useState("");
  const [editMilestoneNotes, setEditMilestoneNotes] = useState("");
  const [symptomDate, setSymptomDate] = useState<Date>(new Date());
  const [symptomNotes, setSymptomNotes] = useState("");
  const [testDate, setTestDate] = useState<Date>(new Date());
  const [testNotes, setTestNotes] = useState("");
  const [testName, setTestName] = useState("");
  const [testValue, setTestValue] = useState("");
  const [testUnit, setTestUnit] = useState("");
  const [testReferenceRange, setTestReferenceRange] = useState("");
  const [editingTestResult, setEditingTestResult] = useState<any>(null);
  const [testToDelete, setTestToDelete] = useState<any>(null);
  const [editTestType, setEditTestType] = useState("");
  const [editTestDate, setEditTestDate] = useState<Date>(new Date());
  const [editTestNotes, setEditTestNotes] = useState("");
  const [editTestName, setEditTestName] = useState("");
  const [editTestValue, setEditTestValue] = useState("");
  const [editTestUnit, setEditTestUnit] = useState("");
  const [editTestReferenceRange, setEditTestReferenceRange] = useState("");
  const [editingSymptom, setEditingSymptom] = useState<Symptom | null>(null);
  const [symptomToDelete, setSymptomToDelete] = useState<Symptom | null>(null);
  const [editSymptomType, setEditSymptomType] = useState("");
  const [editSymptomSeverity, setEditSymptomSeverity] = useState("");
  const [editSymptomDuration, setEditSymptomDuration] = useState("");
  const [editSymptomDate, setEditSymptomDate] = useState<Date>(new Date());
  const [editSymptomNotes, setEditSymptomNotes] = useState("");
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [medicationToDelete, setMedicationToDelete] = useState<Medication | null>(null);
  const [editMedicationName, setEditMedicationName] = useState("");
  const [editMedicationDosage, setEditMedicationDosage] = useState("");
  const [editMedicationTime, setEditMedicationTime] = useState("");
  const [editMedicationFrequency, setEditMedicationFrequency] = useState("");
  const [editMedicationStartDate, setEditMedicationStartDate] = useState<Date>(new Date());
  const [editMedicationReminder, setEditMedicationReminder] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [editAppointmentTitle, setEditAppointmentTitle] = useState("");
  const [editAppointmentType, setEditAppointmentType] = useState("");
  const [editAppointmentDate, setEditAppointmentDate] = useState<Date>(new Date());
  const [editAppointmentTime, setEditAppointmentTime] = useState("");
  const [editAppointmentLocation, setEditAppointmentLocation] = useState("");
  const [editAppointmentDoctorName, setEditAppointmentDoctorName] = useState("");
  const [editAppointmentNotes, setEditAppointmentNotes] = useState("");
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [medicationSearch, setMedicationSearch] = useState("");
  const [selectedMedicationType, setSelectedMedicationType] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [medicationDosage, setMedicationDosage] = useState("");
  const [medicationTime, setMedicationTime] = useState("");
  const [medicationFrequency, setMedicationFrequency] = useState("");
  const [medicationReminder, setMedicationReminder] = useState(false);
  const [medicationStartDate, setMedicationStartDate] = useState<Date>(new Date());
  const [selectedMedication, setSelectedMedication] = useState("");
  const [showEndMedication, setShowEndMedication] = useState(false);
  const [endingMedication, setEndingMedication] = useState<Medication | null>(null);
  const [medicationEndDate, setMedicationEndDate] = useState<Date>(new Date());
  const [showLogDose, setShowLogDose] = useState(false);
  const [loggingMedication, setLoggingMedication] = useState<Medication | null>(null);
  const [logDoseDate, setLogDoseDate] = useState<Date>(new Date());
  const [logDoseNotes, setLogDoseNotes] = useState("");
  const [selectedMedicationInfo, setSelectedMedicationInfo] = useState<MedicationInfo | null>(null);
  const [showMedicationInfo, setShowMedicationInfo] = useState(false);
  const [showCreateMedicationInfo, setShowCreateMedicationInfo] = useState(false);
  const [newMedicationInfo, setNewMedicationInfo] = useState({
    name: "",
    generic: "",
    class: "",
    purpose: "",
    route: "",
    timing: "",
    commonSideEffects: [] as string[],
    seriousSideEffects: [] as string[],
    monitoringNotes: "",
    patientNotes: "",
    reference: "",
    videoLink: "",
  });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventType, setEventType] = useState("general_note");
  const [showQuickEventDialog, setShowQuickEventDialog] = useState(false);
  const [quickEventType, setQuickEventType] = useState("doctor_visit");
  const [quickEventTitle, setQuickEventTitle] = useState("");
  const [quickEventNotes, setQuickEventNotes] = useState("");
  const [quickEventLocation, setQuickEventLocation] = useState("");
  const [quickEventDate, setQuickEventDate] = useState<Date>(new Date());
  const [quickEventTime, setQuickEventTime] = useState("");
  const [summaryCycle, setSummaryCycle] = useState<Cycle | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<"pdf" | "csv" | null>(null);
  const [cycleToDelete, setCycleToDelete] = useState<Cycle | null>(null);
  const [showCancelCycleDialog, setShowCancelCycleDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedCancelReason, setSelectedCancelReason] = useState<string>("");

  const { data: activeCycle } = useQuery<Cycle>({
    queryKey: ["/api/cycles/active"],
  });

  // Load cycle-specific milestones from JSON
  const [cycleMilestones, setCycleMilestones] = useState<any[]>([]);
  const [selectedMilestoneDetails, setSelectedMilestoneDetails] = useState<any>(null);
  const handleViewMilestoneDetails = async (milestone: any) => {
    if (!activeCycle?.type) {
      toast({
        title: "Cycle data unavailable",
        description: "Start a cycle first to view milestone guidance.",
        variant: "destructive",
      });
      return;
    }

    try {
      const details = await getMilestoneByName(activeCycle.type, milestone.title);
      if (details) {
        // Get milestone summary from Excel data
        const summary = getMilestoneSummary(
          activeCycle.type,
          milestone.type,
          milestone.title,
          milestone.type // Use type as potential ID
        );
        setSelectedMilestoneDetails({
          ...details,
          summary: summary || details.summary,
        });
        return;
      }

      // Get milestone summary even if full details aren't available
      const summary = getMilestoneSummary(
        activeCycle.type,
        milestone.type,
        milestone.title,
        milestone.type
      );

      if (milestone.notes) {
        setSelectedMilestoneDetails({
          name: milestone.title,
          summary: summary,
          medicalDetails: milestone.notes,
          patientInsights: milestone.notes,
          tips: [],
        });
        return;
      }

      // If we have a summary but no other details, show at least the summary
      if (summary) {
        setSelectedMilestoneDetails({
          name: milestone.title,
          summary: summary,
          medicalDetails: '',
          patientInsights: '',
          tips: [],
        });
        return;
      }

      toast({
        title: "Details coming soon",
        description: "We're still preparing guidance for this milestone.",
      });
    } catch (error) {
      console.error("Failed to load milestone details", error);
      toast({
        title: "Unable to load details",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleQuickEventSchedule = ({
    title,
    type = "general_note",
    notes = "",
    location = "",
  }: {
    title: string;
    type?: string;
    notes?: string;
    location?: string;
  }) => {
    setQuickEventType(type);
    setQuickEventTitle(title);
    setQuickEventNotes(notes);
    setQuickEventLocation(location);
    setQuickEventDate(new Date());
    setQuickEventTime("");
    setShowQuickEventDialog(true);
  };

  const handleViewAllMedications = () => {
    setActiveTab("meds");
  };

  const handleViewAllEvents = () => {
    // Navigate to home page and scroll to calendar section
    setLocation("/#calendar");
  };

  const createEventRecord = useCallback(
    async ({
      title,
      eventType,
      date,
      time,
      location,
      notes,
    }: {
      title: string;
      eventType: string;
      date: Date;
      time: string;
      location?: string;
      notes?: string;
    }) => {
      if (!activeCycle) {
        toast({
          title: "No active cycle",
          description: "Please start a cycle before adding events.",
          variant: "destructive",
        });
        return false;
      }

      if (!title || !date || !time) {
        toast({
          title: "Required fields",
          description: "Please fill in the event title, date, and time.",
          variant: "destructive",
        });
        return false;
      }

      try {
        const eventData = {
          eventType,
          title,
          date: formatDateForAPI(date),
          time,
          location: location || null,
          personalNotes: notes || null,
          cycleId: activeCycle.id,
        };

        await apiRequest("POST", "/api/events", eventData);

        // Events are created only in the events table, not in appointments
        // Appointments should be created separately if needed

        queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle.id, "events"] });

        toast({
          title: "Event saved",
          description: "Your event has been saved successfully.",
        });

        return true;
      } catch (error) {
        console.error("Error saving event:", error);
        toast({
          title: "Error",
          description: "Failed to save event. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [activeCycle, queryClient, toast],
  );

  const handleSubmitQuickEvent = async () => {
    const success = await createEventRecord({
      title: quickEventTitle,
      eventType: quickEventType,
      date: quickEventDate,
      time: quickEventTime,
      location: quickEventLocation,
      notes: quickEventNotes,
    });

    if (success) {
      setShowQuickEventDialog(false);
      setQuickEventTitle("");
      setQuickEventNotes("");
      setQuickEventLocation("");
      setQuickEventTime("");
    }
  };
  const [currentPhase, setCurrentPhase] = useState<StageDetectionResult | null>(null);
  const [currentMilestoneTemplate, setCurrentMilestoneTemplate] = useState<any>(null);
  const [currentStageDetails, setCurrentStageDetails] = useState<string | null>(null);

  const [, setLocation] = useLocation();

  const { data: allCycles = [] } = useQuery<Cycle[]>({
    queryKey: ["/api/cycles"],
  });

  // Handle URL parameters to set initial tab and trigger actions
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    const action = searchParams.get('action');
    const eventTypeParam = searchParams.get('eventType');
    const requestedDateParam = searchParams.get('date');
    const viewSummaryParam = searchParams.get('viewSummary');

    let requestedDate: Date | null = null;
    if (requestedDateParam) {
      // Parse YYYY-MM-DD format and create date in local timezone
      const [year, month, day] = requestedDateParam.split('-').map(Number);
      if (year && month && day) {
        const parsed = new Date(year, month - 1, day);
        if (!isNaN(parsed.getTime())) {
          requestedDate = parsed;
          setEventDate(parsed);
        }
      }
    }

    if (tab) {
      setActiveTab(tab);
    }

    if (eventTypeParam) {
      setEventType(eventTypeParam);
    }

    if (action === 'add-test') {
      setShowAddTest(true);
    } else if (action === 'add-event') {
      setShowAddEvent(true);
      if (eventTypeParam === 'doctor_visit' && !eventTitle) {
        setEventTitle("Doctor appointment");
      }
      if (requestedDate) {
        setEventDate(requestedDate);
      }
    } else if (action === 'add-medication') {
      setShowAddMedication(true);
    }

    // Handle viewSummary parameter - open summary for specified cycle
    if (viewSummaryParam && allCycles.length > 0) {
      const cycle = allCycles.find(c => c.id === viewSummaryParam);
      if (cycle) {
        setSummaryCycle(cycle);
        setActiveTab('cycle');
      }
    }
  }, [location, allCycles]);

  const summaryCycleId = summaryCycle?.id ?? null;
  const {
    data: cycleSummaryData,
    isFetching: summaryLoading,
    isError: summaryError,
  } = useQuery<CycleSummaryData>({
    queryKey: ["cycle-summary", summaryCycleId],
    queryFn: async () => {
      if (!summaryCycleId) {
        throw new Error("Cycle not selected");
      }
      const response = await apiRequest("GET", `/api/cycles/${summaryCycleId}/summary`);
      return (await response.json()) as CycleSummaryData;
    },
    enabled: Boolean(summaryCycleId),
    staleTime: 0,
  });

  // Load cycle-specific milestones from JSON
  useEffect(() => {
    if (!activeCycle) return;

    const loadCycleMilestones = async () => {
      try {
        const milestones = await getMilestonesForCycle(activeCycle.type);
        setCycleMilestones(milestones);
      } catch (error) {
        console.error('Error loading cycle milestones:', error);
      }
    };

    loadCycleMilestones();
  }, [activeCycle]);

  const { data: medications = [] } = useQuery<Medication[]>({
    queryKey: ["/api/cycles", activeCycle?.id, "medications"],
    enabled: !!activeCycle,
  });

  const { data: medicationLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/cycles", activeCycle?.id, "medication-logs"],
    enabled: !!activeCycle,
  });

  const { data: upcomingAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments/upcoming"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: activeCycle ? ["/api/cycles", activeCycle.id, "events"] : [],
    enabled: !!activeCycle && activeCycle.status === "active", // Only fetch events for active cycles
  });

  const lastCompletedCycle = useMemo(() => {
    if (!allCycles.length) return null;
    const completed = allCycles
      .filter((cycle) => cycle.status === "completed")
      .sort((a, b) => {
        const dateA = new Date(a.endDate || a.updatedAt || a.startDate || "").getTime();
        const dateB = new Date(b.endDate || b.updatedAt || b.startDate || "").getTime();
        return dateB - dateA;
      });
    return completed[0] || null;
  }, [allCycles]);

  // Get all completed or cancelled cycles for summary export
  const completedOrCancelledCycles = useMemo(() => {
    if (!allCycles.length) return [];
    return allCycles
      .filter((cycle) => cycle.status === "completed" || cycle.status === "cancelled")
      .sort((a, b) => {
        const dateA = new Date(a.endDate || a.updatedAt || a.startDate || "").getTime();
        const dateB = new Date(b.endDate || b.updatedAt || b.startDate || "").getTime();
        return dateB - dateA; // Most recent first
      });
  }, [allCycles]);

  // Filter medications for today
  const todaysMedications = medications.filter((medication) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Handle date strings (YYYY-MM-DD format from database)
    const startDateStr = medication.startDate instanceof Date
      ? medication.startDate.toISOString().split('T')[0]
      : medication.startDate;
    const startDate = new Date(startDateStr + 'T00:00:00');

    const endDateStr = medication.endDate
      ? (medication.endDate instanceof Date
        ? medication.endDate.toISOString().split('T')[0]
        : medication.endDate)
      : null;
    const endDate = endDateStr ? new Date(endDateStr + 'T00:00:00') : null;

    // Check if today is within medication date range
    if (today < startDate) {
      console.log(`[Today's Meds] ${medication.name}: Not started yet (start: ${startDateStr}, today: ${today.toISOString().split('T')[0]})`);
      return false;
    }
    if (endDate) {
      // Exclude medications that ended today or before today
      // Compare dates at midnight to ensure accurate comparison
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (todayOnly >= endDateOnly) {
        console.log(`[Today's Meds] ${medication.name}: Already ended (end: ${endDateStr}, today: ${today.toISOString().split('T')[0]})`);
        return false;
      }
    }

    // Check frequency to see if medication should be taken today
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    let shouldShow = false;
    switch (medication.frequency) {
      case 'daily':
      case 'twice-daily':
      case 'three-times':
        shouldShow = true; // Daily medications are always shown
        break;
      case 'every-other-day':
        shouldShow = daysSinceStart % 2 === 0;
        break;
      case 'weekly':
        shouldShow = daysSinceStart % 7 === 0;
        break;
      case 'once':
        shouldShow = daysSinceStart === 0;
        break;
      default:
        console.warn(`[Today's Meds] ${medication.name}: Unknown frequency "${medication.frequency}", showing anyway`);
        shouldShow = true; // Default to showing if frequency is unknown
    }

    console.log(`[Today's Meds] ${medication.name}: start=${startDateStr}, end=${endDateStr || 'none'}, frequency=${medication.frequency}, daysSinceStart=${daysSinceStart}, shouldShow=${shouldShow}`);

    return shouldShow;
  });

  console.log(`[Today's Meds] Total medications: ${medications.length}, Today's medications: ${todaysMedications.length}`);

  const upcomingReminderItems = useMemo<ReminderItem[]>(() => {
    const reminders: ReminderItem[] = [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Only show events from active cycles
    if (activeCycle && activeCycle.status === "active") {
      (events || [])
        .forEach((event) => {
          const reminderDate = toReminderDate(event.date, event.time);
          if (!reminderDate || reminderDate < startOfToday) return;

          reminders.push({
            id: `event-${event.id}`,
            title: event.title,
            subtitle: getEventSubtitle(event),
            date: reminderDate,
            type: "event",
            location: event.location,
          });
        });
    }

    // Appointments are already filtered by backend to only show from active cycles
    (upcomingAppointments || []).forEach((appointment) => {
      const reminderDate = appointment.date ? new Date(appointment.date) : null;
      if (!reminderDate || Number.isNaN(reminderDate.getTime()) || reminderDate < startOfToday) return;

      reminders.push({
        id: `appointment-${appointment.id}`,
        title: appointment.title || "Clinic appointment",
        subtitle: appointment.doctorName || appointment.location || "Scheduled visit",
        date: reminderDate,
        type: "appointment",
        location: appointment.location,
      });
    });

    return reminders.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, upcomingAppointments, activeCycle]);

  const { data: milestones = [] } = useQuery<any[]>({
    queryKey: ["/api/cycles", activeCycle?.id, "milestones"],
    enabled: !!activeCycle,
  });

  // Create a stable reference for milestones to avoid infinite loops
  // Only track the parts we care about: IDs, statuses, types, and titles
  const milestonesKey = useMemo(() => {
    if (!milestones || milestones.length === 0) return '';
    return milestones.map(m => `${m.id || ''}:${m.status || ''}:${m.type || ''}:${m.title || ''}`).join('|');
  }, [milestones]);

  const { data: testResults = [] } = useQuery<any[]>({
    queryKey: activeCycle ? [`/api/cycles/${activeCycle.id}/test-results`] : [],
    enabled: !!activeCycle,
  });

  // Fetch reference data
  const { data: cycleTypes = [], isLoading: isLoadingCycleTypes, error: cycleTypesError } = useQuery({
    queryKey: ["/api/reference/cycle-types"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/reference/cycle-types");
      if (!response.ok) {
        throw new Error("Failed to fetch cycle types");
      }
      return response.json();
    },
    retry: 2,
  });

  const { data: eventTypes = [], isLoading: isLoadingEventTypes, error: eventTypesError } = useQuery({
    queryKey: ["/api/reference/event-types"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/reference/event-types");
      if (!response.ok) {
        throw new Error("Failed to fetch event types");
      }
      return response.json();
    },
    retry: 2,
  });

  const { data: stageReferenceData = [] } = useQuery<StageReferenceData[]>({
    queryKey: ["/api/reference/stages"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/reference/stages");
      if (!response.ok) {
        throw new Error("Failed to fetch stage data");
      }
      return response.json();
    },
    retry: 2,
  });

  // Get filtered milestone options based on cycle type
  const getAddMilestoneOptions = () => {
    if (!activeCycle) {
      return [
        { value: "cycle-day-1", label: "Cycle day 1" },
        { value: "baseline-blood-test", label: "Baseline blood test" },
        { value: "monitoring-blood-test", label: "Monitoring blood test" },
        { value: "monitoring-ultrasound", label: "Monitoring ultrasound" },
        { value: "medication-start", label: "Medication start" },
        { value: "ovulation-detected", label: "Ovulation detected" },
        { value: "trigger-injection", label: "Trigger injection" },
        { value: "egg-retrieval", label: "Egg retrieval" },
        { value: "insemination-iui", label: "Insemination (IUI)" },
        { value: "embryo-transfer", label: "Embryo transfer" },
        { value: "eggs-frozen", label: "Eggs frozen" },
        { value: "pregnancy-blood-test", label: "Pregnancy blood test" },
        { value: "other", label: "Other" },
      ];
    }

    // FET cycles: Only show these 7 milestones in exact order
    if (activeCycle.type === "ivf-frozen" || activeCycle.type === "FET") {
      return [
        { value: "cycle-day-1", label: "Cycle day 1" },
        { value: "monitoring-blood-test", label: "Monitoring blood test" },
        { value: "monitoring-ultrasound", label: "Monitoring ultrasound" },
        { value: "medication-start", label: "Medication start" },
        { value: "ovulation-detected", label: "Ovulation detected" },
        { value: "embryo-transfer", label: "Embryo transfer" },
        { value: "pregnancy-blood-test", label: "Pregnancy blood test" },
      ];
    }

    // Default options for other cycle types
    return [
      { value: "cycle-day-1", label: "Cycle day 1" },
      { value: "baseline-blood-test", label: "Baseline blood test" },
      { value: "monitoring-blood-test", label: "Monitoring blood test" },
      { value: "monitoring-ultrasound", label: "Monitoring ultrasound" },
      { value: "medication-start", label: "Medication start" },
      { value: "ovulation-detected", label: "Ovulation detected" },
      { value: "trigger-injection", label: "Trigger injection" },
      { value: "egg-retrieval", label: "Egg retrieval" },
      { value: "insemination-iui", label: "Insemination (IUI)" },
      { value: "embryo-transfer", label: "Embryo transfer" },
      { value: "eggs-frozen", label: "Eggs frozen" },
      { value: "pregnancy-blood-test", label: "Pregnancy blood test" },
      { value: "other", label: "Other" },
    ];
  };

  const addMilestoneOptions = getAddMilestoneOptions();

  const formatMilestoneTitle = (title: string) => {
    if (!title) return title;
    if (title.includes(" ")) return title;
    const lower = title.toLowerCase();
    const stripped = lower.replace(/^(ivf-frozen-|ivf-fresh-|egg-freezing-|egg-freez-|iui-)/, "");
    return stripped
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const { data: loggedSymptoms = [] } = useQuery<Symptom[]>({
    queryKey: activeCycle ? ["/api/cycles", activeCycle.id, "symptoms"] : [],
    enabled: !!activeCycle,
  });

  // Helper function to convert severity value to text
  const getSeverityText = (value: number): string => {
    if (value <= 1) return 'Mild';
    if (value <= 2) return 'Moderate';
    if (value <= 3) return 'Severe';
    return 'Very Severe';
  };

  // Detect current phase - prioritize latest active milestone over cycle day
  useEffect(() => {
    if (!activeCycle) return;

    const loadCurrentPhase = async () => {
      try {
        // Use the new JSON-based stage detection
        const stageResult = await getStageInfoWithJsonFallback(
          stageReferenceData,
          activeCycle,
          milestones,
          calculateCycleDay(activeCycle.startDate)
        );

        if (stageResult) {
          setCurrentPhase(stageResult);
          setCurrentMilestoneTemplate(null); // Not needed with new approach
          setCurrentStageDetails(stageResult.stage.details || null);
        }
      } catch (error) {
        console.error('Error detecting current phase:', error);
      }
    };

    loadCurrentPhase();
  }, [activeCycle?.id, activeCycle?.type, activeCycle?.startDate, milestonesKey, stageReferenceData.length]);


  const startCycleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/cycles", data);
      const newCycle = await response.json();
      return newCycle;
    },
    onSuccess: async (newCycle) => {
      // Directly update the cache with the new cycle
      queryClient.setQueryData<Cycle | null>(["/api/cycles/active"], newCycle);

      // Add the new cycle to the cycles list
      queryClient.setQueryData<Cycle[]>(["/api/cycles"], (oldCycles = []) => {
        // Check if cycle already exists (shouldn't, but just in case)
        const exists = oldCycles.some(c => c.id === newCycle.id);
        return exists ? oldCycles : [newCycle, ...oldCycles];
      });

      // Also invalidate to ensure all related queries update
      queryClient.invalidateQueries({ queryKey: ["/api/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cycles/active"] });

      toast({
        title: "Cycle started",
        description: "Your new treatment cycle has been created.",
      });
      // Reset form
      setNewCycleType("");
      setNewCycleStartDate("");
      setNewCycleClinic("");
      setNewCycleDoctor("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start cycle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartCycle = () => {
    if (!newCycleType || !newCycleStartDate) {
      toast({
        title: "Required fields",
        description: "Please fill in cycle type and start date.",
        variant: "destructive",
      });
      return;
    }

    startCycleMutation.mutate({
      type: newCycleType,
      startDate: newCycleStartDate,
      clinic: newCycleClinic,
      doctor: newCycleDoctor,
      donorConception: false,
    });
  };

  const finishCycleMutation = useMutation({
    mutationFn: async ({ cycle, updates }: { cycle: Cycle; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/cycles/${cycle.id}`, updates);
      const updatedCycle = await response.json();
      return { cycle: updatedCycle, updates };
    },
    onSuccess: async (data, variables) => {
      // Directly update the cache to reflect the cancelled/completed cycle
      if (variables.updates.status === "cancelled" || variables.updates.status === "completed") {
        // Set active cycle to null since it's no longer active
        queryClient.setQueryData<Cycle | null>(["/api/cycles/active"], null);
      }

      // Update the cycles list with the updated cycle
      queryClient.setQueryData<Cycle[]>(["/api/cycles"], (oldCycles = []) => {
        return oldCycles.map((c) => (c.id === data.cycle.id ? data.cycle : c));
      });

      // Also invalidate to ensure all related queries update
      queryClient.invalidateQueries({ queryKey: ["/api/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cycles/active"] });

      toast({
        title: variables.updates.status === "completed" ? "Cycle completed" : "Cycle updated",
        description:
          variables.updates.status === "completed"
            ? "Your cycle has been marked as completed."
            : variables.updates.status === "cancelled"
              ? "Your cycle has been cancelled."
              : "Cycle status updated.",
      });
      setShowCycleActions(false);
      if (variables.updates.status === "completed") {
        setSummaryCycle(variables.cycle);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update cycle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFinishCycle = (result: string) => {
    if (!activeCycle) return;

    finishCycleMutation.mutate({
      cycle: activeCycle,
      updates: {
        status: "completed",
        endDate: formatDateForAPI(new Date()),
        result: result,
      },
    });
  };

  const deleteCycleMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      await apiRequest("DELETE", `/api/cycles/${cycleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cycles/active"] });
      toast({
        title: "Cycle deleted",
        description: "The cycle has been permanently deleted.",
      });
      setCycleToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete cycle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveSymptomMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/symptoms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "symptoms"] });
      toast({
        title: "Symptom logged",
        description: "Your symptom has been successfully recorded.",
      });
      // Reset form
      setSelectedSymptom("");
      setSymptomSeverity("");
      setSymptomDuration("");
      setSymptomNotes("");
      setSymptomDate(new Date());
    },
    onError: (error: any) => {
      console.error("Error saving symptom:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save symptom. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteSymptomMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/symptoms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "symptoms"] });
      toast({
        title: "Symptom deleted",
        description: "The symptom has been removed.",
      });
      setSymptomToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete symptom. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateSymptomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/symptoms/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "symptoms"] });
      toast({
        title: "Symptom updated",
        description: "Your symptom has been updated successfully.",
      });
      setEditingSymptom(null);
      setEditSymptomType("");
      setEditSymptomSeverity("");
      setEditSymptomDuration("");
      setEditSymptomNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update symptom. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper function to normalize duration/appearance values to match select item values
  const normalizeDurationValue = (value: string): string => {
    if (!value) return "";

    // Normalize: lowercase and replace spaces with hyphens
    const normalized = value.toLowerCase().trim().replace(/\s+/g, '-');

    // Map common variations to select values
    const durationMap: { [key: string]: string } = {
      // Duration values
      "few-minutes": "few-minutes",
      "a-few-minutes": "few-minutes",
      "30-minutes": "30-minutes",
      "thirty-minutes": "30-minutes",
      "1-hour": "1-hour",
      "one-hour": "1-hour",
      "few-hours": "few-hours",
      "a-few-hours": "few-hours",
      "half-day": "half-day",
      "all-day": "all-day",
      // Appearance values
      "clear": "clear",
      "white": "white",
      "yellow": "yellow",
      "brown": "brown",
      "green": "green",
      "light-pink": "light-pink",
      "red": "red",
      "dark-red": "dark-red",
    };

    // Check if normalized value matches a select value
    if (durationMap[normalized]) {
      return durationMap[normalized];
    }

    // If not found, try partial matching
    for (const [key, mappedValue] of Object.entries(durationMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return mappedValue;
      }
    }

    // Return normalized value as fallback
    return normalized;
  };

  // Helper function to parse symptom data from notes and schema fields
  const parseSymptomForEdit = (symptom: Symptom) => {
    let symptomType = "";
    let severity = "";
    let duration = "";
    let userNotes = "";

    // Parse from notes
    if (symptom.notes) {
      const notesLines = symptom.notes.split('\n\n');
      const symptomInfoLine = notesLines.find(line => line.includes('Symptom:'));

      if (symptomInfoLine) {
        // Extract symptom name
        const symptomMatch = symptomInfoLine.match(/Symptom:\s*(.+?)\s*\|/);
        if (symptomMatch) {
          const symptomName = symptomMatch[1].toLowerCase().replace(/\s+/g, '-');
          symptomType = symptomName;
        }

        // Extract severity
        const severityMatch = symptomInfoLine.match(/Severity:\s*(.+?)(?:\s*\||$)/);
        if (severityMatch) {
          severity = severityMatch[1].toLowerCase();
        }

        // Extract duration or appearance
        const durationMatch = symptomInfoLine.match(/(?:Duration|Appearance):\s*(.+?)(?:\s*\||$)/);
        if (durationMatch) {
          duration = normalizeDurationValue(durationMatch[1]);
        }
      }

      // Get user notes (everything after the symptom info line)
      const userNotesLines = notesLines.filter(line => !line.includes('Symptom:'));
      userNotes = userNotesLines.join('\n\n');
    }

    // If we couldn't parse from notes, try to infer from schema fields
    if (!symptomType) {
      if (symptom.bloating) {
        symptomType = "bloating";
        severity = getSeverityFromValue(symptom.bloating);
      } else if (symptom.fatigue) {
        symptomType = "fatigue";
        severity = getSeverityFromValue(symptom.fatigue);
      } else if (symptom.nausea) {
        symptomType = "nausea";
        severity = getSeverityFromValue(symptom.nausea);
      } else if (symptom.headache) {
        symptomType = "headaches";
        severity = getSeverityFromValue(symptom.headache);
      } else if (symptom.moodSwings) {
        symptomType = "mood-swings";
        severity = getSeverityFromValue(symptom.moodSwings);
      }
    }

    return { symptomType, severity, duration, userNotes };
  };

  const getSeverityFromValue = (value: number): string => {
    if (value <= 1) return "mild";
    if (value <= 2) return "moderate";
    if (value <= 3) return "severe";
    return "very-severe";
  };

  // Populate edit symptom form when dialog opens
  useEffect(() => {
    if (editingSymptom) {
      const parsed = parseSymptomForEdit(editingSymptom);
      setEditSymptomType(parsed.symptomType);
      setEditSymptomSeverity(parsed.severity);
      setEditSymptomDuration(parsed.duration);
      setEditSymptomNotes(parsed.userNotes);
      setEditSymptomDate(new Date(editingSymptom.date));
    }
  }, [editingSymptom]);

  // Populate edit medication form when dialog opens
  useEffect(() => {
    if (editingMedication) {
      setEditMedicationName(editingMedication.name);
      setEditMedicationDosage(editingMedication.dosage);
      setEditMedicationTime(editingMedication.time || "");
      setEditMedicationFrequency(editingMedication.frequency);
      const startDateStr = editingMedication.startDate instanceof Date
        ? editingMedication.startDate.toISOString().split('T')[0]
        : editingMedication.startDate;
      setEditMedicationStartDate(startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date());
      setEditMedicationReminder(false); // Note: reminder is not stored in medication
    }
  }, [editingMedication]);

  // Populate edit appointment form when dialog opens
  useEffect(() => {
    if (editingAppointment) {
      setEditAppointmentTitle(editingAppointment.title);
      setEditAppointmentType(editingAppointment.type || "");
      const appointmentDate = new Date(editingAppointment.date);
      setEditAppointmentDate(appointmentDate);
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      setEditAppointmentTime(`${hours}:${minutes}`);
      setEditAppointmentLocation(editingAppointment.location || "");
      setEditAppointmentDoctorName(editingAppointment.doctorName || "");
      setEditAppointmentNotes(editingAppointment.notes || "");
    }
  }, [editingAppointment]);

  // Populate edit event form when editing
  useEffect(() => {
    if (editingEvent) {
      setEventTitle(editingEvent.title);
      setEventType(editingEvent.eventType || "general_note");
      setEventDate(new Date(editingEvent.date));
      setEventTime(editingEvent.time || "");
      setEventLocation(editingEvent.location || "");
      setEventNotes(editingEvent.personalNotes || "");
    }
  }, [editingEvent]);

  // Populate edit test result form when dialog opens
  useEffect(() => {
    if (editingTestResult) {
      // Map the test type back to the form type
      let formType = '';
      if (editingTestResult.type === 'blood') {
        formType = 'blood-test';
      } else if (editingTestResult.type === 'ultrasound') {
        formType = 'ultrasound';
      } else {
        formType = 'other';
      }
      setEditTestType(formType);
      setEditTestDate(new Date(editingTestResult.date));
      setEditTestNotes(editingTestResult.notes || "");
      setEditTestName(editingTestResult.name || "");
      setEditTestValue(editingTestResult.value || "");
      setEditTestUnit(editingTestResult.unit || "");
      setEditTestReferenceRange(editingTestResult.referenceRange || "");
    }
  }, [editingTestResult]);

  const deleteMedicationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/medications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "medications"] });
      toast({
        title: "Medication deleted",
        description: "The medication has been removed.",
      });
      setMedicationToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete medication. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMedicationMutation = useMutation({
    mutationFn: async (data: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/medications/${data.id}`, data.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "medications"] });
      toast({
        title: "Medication updated",
        description: "Your medication has been updated successfully.",
      });
      setEditingMedication(null);
      setEditMedicationName("");
      setEditMedicationDosage("");
      setEditMedicationTime("");
      setEditMedicationFrequency("");
      setEditMedicationReminder(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update medication. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/appointments/${data.id}`, data.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "appointments"] });
      toast({
        title: "Appointment updated",
        description: "Your appointment has been updated successfully.",
      });
      setEditingAppointment(null);
      setEditAppointmentTitle("");
      setEditAppointmentType("");
      setEditAppointmentTime("");
      setEditAppointmentLocation("");
      setEditAppointmentDoctorName("");
      setEditAppointmentNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "appointments"] });
      toast({
        title: "Appointment deleted",
        description: "The appointment has been removed.",
      });
      setAppointmentToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/events/${data.id}`, data.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "events"] });
      toast({
        title: "Event updated",
        description: "Your event has been updated successfully.",
      });
      setEditingEvent(null);
      setShowAddEvent(false);
      setEventTitle("");
      setEventType("general_note");
      setEventDate(new Date());
      setEventTime("");
      setEventLocation("");
      setEventNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "events"] });
      toast({
        title: "Event deleted",
        description: "The event has been removed.",
      });
      setEventToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSymptom = () => {
    if (!activeCycle) {
      toast({
        title: "No active cycle",
        description: "Please start a cycle before logging symptoms.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSymptom || !symptomSeverity) {
      toast({
        title: "Required fields",
        description: "Please select a symptom and severity level.",
        variant: "destructive",
      });
      return;
    }

    // Map severity to 1-5 scale
    const severityMap: { [key: string]: number } = {
      "mild": 1,
      "moderate": 2,
      "severe": 3,
      "very-severe": 4,
    };
    const severityValue = severityMap[symptomSeverity] || 2;

    // Map selected symptom to schema fields
    const symptomData: any = {
      cycleId: activeCycle.id,
      date: formatDateForAPI(symptomDate),
    };

    // Map symptom type to schema field
    const symptomFieldMap: { [key: string]: string } = {
      "bloating": "bloating",
      "fatigue": "fatigue",
      "nausea": "nausea",
      "headaches": "headache",
      "mood-swings": "moodSwings",
      "cramping": "bloating", // Map cramping to bloating (cramping can cause bloating sensation)
      "breast-tenderness": "bloating", // Map to bloating field (or could use notes)
      "anxiety": "moodSwings", // Map anxiety to moodSwings
      "hot-flashes": "moodSwings", // Map hot flashes to moodSwings
      "spotting": "moodSwings", // Map to moodSwings (or could use notes)
      "discharge": "moodSwings", // Map to moodSwings (or could use notes)
      "sleep-issues": "fatigue", // Map sleep issues to fatigue
    };

    const fieldName = symptomFieldMap[selectedSymptom];
    if (fieldName) {
      symptomData[fieldName] = severityValue;
    }

    // Build notes string - ALWAYS include symptom type and severity for display
    const notesParts: string[] = [];

    // Always add symptom type and severity at the beginning
    const symptomName = selectedSymptom.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let symptomInfo = `Symptom: ${symptomName} | Severity: ${symptomSeverity}`;
    if (symptomDuration) {
      const durationLabel = (selectedSymptom === "discharge" || selectedSymptom === "spotting") ? "Appearance" : "Duration";
      symptomInfo += ` | ${durationLabel}: ${symptomDuration}`;
    }
    notesParts.push(symptomInfo);

    // Add user notes if provided
    if (symptomNotes) {
      notesParts.push(symptomNotes);
    }

    // Set notes (always has at least symptom info)
    symptomData.notes = notesParts.join('\n\n');

    saveSymptomMutation.mutate(symptomData);
  };

  const handleCancelCycle = () => {
    if (!activeCycle) return;
    setShowCancelCycleDialog(true);
  };

  const confirmCancelCycle = () => {
    if (!activeCycle) return;

    const updates: any = {
      status: "cancelled",
      endDate: formatDateForAPI(new Date()),
    };

    // Build cancellation reason text from selected reason and custom notes
    const reasonParts: string[] = [];
    if (selectedCancelReason) {
      reasonParts.push(selectedCancelReason);
    }
    if (cancelReason.trim()) {
      reasonParts.push(cancelReason.trim());
    }

    // Save cancel reason to notes if provided
    if (reasonParts.length > 0) {
      const reasonText = reasonParts.join(selectedCancelReason && cancelReason.trim() ? " - " : "");
      const existingNotes = activeCycle.notes || "";
      updates.notes = existingNotes
        ? `${existingNotes}\n\nCancellation reason: ${reasonText}`
        : `Cancellation reason: ${reasonText}`;
    }

    finishCycleMutation.mutate({
      cycle: activeCycle,
      updates,
    });

    // Reset cancel reason and close dialog
    setCancelReason("");
    setSelectedCancelReason("");
    setShowCancelCycleDialog(false);
  };

  const handleGenerateSummary = async () => {
    if (!activeCycle) return;

    try {
      // Fetch HTML with authentication
      const response = await apiRequest("GET", `/api/cycles/${activeCycle.id}/summary?format=html`);
      const html = await response.text();

      // Create blob and open in new window
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');

      if (newWindow) {
        // Clean up blob URL after window opens
        setTimeout(() => URL.revokeObjectURL(url), 100);

        toast({
          title: "Summary generated",
          description: "Your cycle summary report has been opened in a new window. You can print or save it from there.",
        });
      } else {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site to view the summary report.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast({
        title: "Error",
        description: "Failed to generate summary report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleOpenSummary = (cycle?: Cycle | null) => {
    if (!cycle) {
      console.warn("handleOpenSummary called with no cycle");
      return;
    }
    console.log("Opening summary for cycle:", cycle.id, cycle.type);
    setSummaryCycle(cycle);
  };

  const handleCloseSummary = () => {
    setSummaryCycle(null);
  };

  const handleDownloadSummary = async (format: "pdf" | "csv", cycle?: Cycle | null) => {
    const targetCycle = cycle ?? summaryCycle;
    if (!targetCycle) {
      toast({
        title: "Error",
        description: "No cycle selected for download.",
        variant: "destructive",
      });
      return;
    }

    try {
      setDownloadingFormat(format);

      // Use fetch directly instead of apiRequest to have more control
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/cycles/${targetCycle.id}/summary?export=${format}`, {
        method: "GET",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.message || error.error || `Server returned ${response.status}`);
        } catch {
          throw new Error(errorText || `Server returned ${response.status}`);
        }
      }

      // Get the blob directly
      const blob = await response.blob();

      // Check if blob is empty
      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      // If content-type is JSON, it's probably an error message
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const text = await blob.text();
        try {
          const error = JSON.parse(text);
          throw new Error(error.message || error.error || "Export failed");
        } catch {
          throw new Error("Server returned an error");
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = `cycle-summary-${targetCycle.type}-${targetCycle.id.slice(0, 6)}.${format}`;
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: format === "pdf" ? "PDF ready" : "CSV ready",
        description: `${format.toUpperCase()} download started.`,
      });
    } catch (error) {
      console.error("Error downloading summary:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Download failed",
        description: errorMessage || "Unable to download the summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }

    if (navigator?.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("navigator.clipboard failed, falling back to execCommand", err);
      }
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      textArea.style.left = "-1000px";
      textArea.style.top = "-1000px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback copy failed", err);
      return false;
    }
  };

  const handleCopySummaryLink = async (cycle?: Cycle | null) => {
    const targetCycle = cycle ?? summaryCycle;
    if (!targetCycle) return;

    try {
      // Get or generate share token
      const response = await apiRequest("GET", `/api/cycles/${targetCycle.id}/share-token`);
      const { shareToken } = await response.json();

      // Create a public share link that works without login
      const shareUrl = `${window.location.origin}/share/${shareToken}`;
      const copied = await copyTextToClipboard(shareUrl);
      if (!copied) {
        throw new Error("Clipboard unavailable");
      }

      toast({
        title: "Link copied",
        description: "Public share link copied. Anyone with this link can view the summary.",
      });
    } catch (error) {
      console.error("Error copying summary link:", error);
      toast({
        title: "Copy failed",
        description: "Unable to copy the link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/milestones", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "milestones"] });
      toast({
        title: "Milestone added",
        description: "Your milestone has been successfully recorded.",
      });
      // Reset form
      setMilestoneType("");
      setMilestoneDate("");
      setMilestoneNotes("");
      setShowMilestoneForm(false);
      // Reset edit form if it was used
      setEditingMilestone(null);
      setEditMilestoneStatus("");
      setEditMilestoneDate("");
      setEditMilestoneNotes("");
      setShowEditDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save milestone. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveMilestone = () => {
    // Check if this is being called from the edit form for a new milestone
    if (editingMilestone && editingMilestone.isNew) {
      if (!editMilestoneStatus || !editMilestoneDate || !activeCycle) {
        toast({
          title: "Required fields",
          description: "Please fill in status and date.",
          variant: "destructive",
        });
        return;
      }

      saveMilestoneMutation.mutate({
        cycleId: activeCycle.id,
        type: editingMilestone.type,
        title: editingMilestone.title,
        date: editMilestoneDate,
        notes: editMilestoneNotes,
        status: editMilestoneStatus,
        completed: editMilestoneStatus === "completed",
      });
      return;
    }

    // Original save milestone logic for regular form
    if (!milestoneType || !milestoneDate || !activeCycle) {
      toast({
        title: "Required fields",
        description: "Please fill in milestone type and date.",
        variant: "destructive",
      });
      return;
    }

    const titleLookup = addMilestoneOptions.reduce<Record<string, string>>((acc, option) => {
      acc[option.value] = option.label;
      return acc;
    }, {});

    saveMilestoneMutation.mutate({
      cycleId: activeCycle.id,
      type: milestoneType,
      title: titleLookup[milestoneType] || milestoneType,
      date: milestoneDate,
      notes: milestoneNotes,
    });
  };

  const updateMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/milestones/${editingMilestone.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "milestones"] });
      toast({
        title: "Milestone updated",
        description: "Your milestone has been successfully updated.",
      });
      setEditingMilestone(null);
      setEditMilestoneStatus("");
      setEditMilestoneDate("");
      setEditMilestoneNotes("");
      setShowEditDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update milestone. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveTestResultMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/test-results", data);
    },
    onSuccess: () => {
      if (activeCycle) {
        queryClient.invalidateQueries({ queryKey: [`/api/cycles/${activeCycle.id}/test-results`] });
      }
      toast({
        title: "Test result saved",
        description: "Your test result has been saved successfully.",
      });
      // Reset form
      setShowAddTest(false);
      setSelectedTestType("");
      setTestDate(new Date());
      setTestNotes("");
      setTestName("");
      setTestValue("");
      setTestUnit("");
      setTestReferenceRange("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save test result. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTestResultMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/test-results/${id}`, data);
    },
    onSuccess: () => {
      if (activeCycle) {
        queryClient.invalidateQueries({ queryKey: [`/api/cycles/${activeCycle.id}/test-results`] });
      }
      toast({
        title: "Test result updated",
        description: "Your test result has been updated successfully.",
      });
      // Reset edit form
      setEditingTestResult(null);
      setEditTestType("");
      setEditTestDate(new Date());
      setEditTestNotes("");
      setEditTestName("");
      setEditTestValue("");
      setEditTestUnit("");
      setEditTestReferenceRange("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update test result. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTestResultMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/test-results/${id}`);
    },
    onSuccess: () => {
      if (activeCycle) {
        queryClient.invalidateQueries({ queryKey: [`/api/cycles/${activeCycle.id}/test-results`] });
      }
      toast({
        title: "Test result deleted",
        description: "The test result has been removed.",
      });
      setTestToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete test result. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveTest = () => {
    if (!activeCycle) {
      toast({
        title: "No active cycle",
        description: "Please start a cycle before logging test results.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTestType) {
      toast({
        title: "Test type required",
        description: "Please select a test type.",
        variant: "destructive",
      });
      return;
    }

    // Map test type to the format expected by the API
    // Schema expects: type (blood, ultrasound, etc.) and name (specific test name)
    let type: string;
    let name: string;

    switch (selectedTestType) {
      case 'blood-test':
        type = 'blood';
        name = testName || 'general_blood_work';
        break;
      case 'ultrasound':
        type = 'ultrasound';
        name = testName || 'ultrasound_scan';
        break;
      case 'other':
        type = 'other';
        name = testName || 'other_test';
        break;
      default:
        type = 'other';
        name = testName || selectedTestType;
    }

    saveTestResultMutation.mutate({
      cycleId: activeCycle.id,
      type: type,
      name: testName || name,
      date: formatDateForAPI(testDate),
      value: testValue || null,
      unit: testUnit || null,
      referenceRange: testReferenceRange || null,
      notes: testNotes || null,
    });
  };

  const handleEditTestResult = (test: any) => {
    setEditingTestResult(test);
  };

  const handleUpdateTestResult = () => {
    if (!editingTestResult || !activeCycle) return;

    // Map test type to the format expected by the API
    let type: string;
    let name: string;

    switch (editTestType) {
      case 'blood-test':
        type = 'blood';
        name = editTestName || 'general_blood_work';
        break;
      case 'ultrasound':
        type = 'ultrasound';
        name = editTestName || 'ultrasound_scan';
        break;
      case 'other':
        type = 'other';
        name = editTestName || 'other_test';
        break;
      default:
        type = editingTestResult.type;
        name = editTestName || editingTestResult.name;
    }

    updateTestResultMutation.mutate({
      id: editingTestResult.id,
      data: {
        type,
        name: name || editTestName,
        date: formatDateForAPI(editTestDate),
        notes: editTestNotes || null,
        value: editTestValue || null,
        unit: editTestUnit || null,
        referenceRange: editTestReferenceRange || null,
      },
    });
  };

  const handleUpdateMilestone = () => {
    if (!editMilestoneStatus || !editMilestoneDate) {
      toast({
        title: "Required fields",
        description: "Please fill in status and date.",
        variant: "destructive",
      });
      return;
    }

    updateMilestoneMutation.mutate({
      date: editMilestoneDate,
      notes: editMilestoneNotes,
      status: editMilestoneStatus,
      completed: editMilestoneStatus === "completed",
    });
  };

  const addMedicationMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/medications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "medications"] });
      toast({
        title: "Medication added",
        description: "Your medication has been successfully added.",
      });
      // Reset form
      setSelectedMedication("");
      setMedicationName("");
      setMedicationDosage("");
      setMedicationTime("");
      setMedicationFrequency("");
      setMedicationReminder(false);
      setMedicationStartDate(new Date());
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add medication. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddMedication = () => {
    if (!activeCycle) {
      toast({
        title: "No active cycle",
        description: "Please start a cycle before adding medications.",
        variant: "destructive",
      });
      return;
    }

    const name = selectedMedication === "Custom" ? medicationName : selectedMedication;

    if (!name || !medicationDosage || !medicationFrequency) {
      toast({
        title: "Required fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Format date in local timezone to avoid timezone offset issues
    const year = medicationStartDate.getFullYear();
    const month = String(medicationStartDate.getMonth() + 1).padStart(2, '0');
    const day = String(medicationStartDate.getDate()).padStart(2, '0');
    const formattedStartDate = `${year}-${month}-${day}`;

    addMedicationMutation.mutate({
      cycleId: activeCycle.id,
      name: name,
      dosage: medicationDosage,
      frequency: medicationFrequency,
      time: medicationTime,
      startDate: formattedStartDate,
    });
  };

  const endMedicationMutation = useMutation({
    mutationFn: async (data: { id: string; endDate: string }) => {
      await apiRequest("PATCH", `/api/medications/${data.id}`, { endDate: data.endDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "medications"] });
      toast({
        title: "Medication ended",
        description: "End date has been set for this medication.",
      });
      setShowEndMedication(false);
      setEndingMedication(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to end medication. Please try again.",
        variant: "destructive",
      });
    },
  });

  const logDoseMutation = useMutation({
    mutationFn: async (data: { id: string; date: string; notes?: string }) => {
      await apiRequest("POST", `/api/medications/${data.id}/log`, {
        date: data.date,
        taken: true,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cycles", activeCycle?.id, "medication-logs"] });
      toast({
        title: "Dose logged",
        description: "Medication dose has been logged successfully.",
      });
      setShowLogDose(false);
      setLoggingMedication(null);
      setLogDoseNotes("");
      setLogDoseDate(new Date());
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to log dose. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogDose = () => {
    if (!loggingMedication) return;

    const year = logDoseDate.getFullYear();
    const month = String(logDoseDate.getMonth() + 1).padStart(2, '0');
    const day = String(logDoseDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    logDoseMutation.mutate({
      id: loggingMedication.id,
      date: formattedDate,
      notes: logDoseNotes.trim() || undefined,
    });
  };

  const handleEndMedication = () => {
    if (!endingMedication) return;

    // Get medication start date (startDate is always a string from API)
    const startDateStr = String(endingMedication.startDate || '');
    const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;

    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get selected end date (start of day)
    const endDate = new Date(medicationEndDate);
    endDate.setHours(0, 0, 0, 0);

    // Validate: end date must be >= start date and >= today
    if (startDate) {
      const minDate = startDate > today ? startDate : today;
      if (endDate < minDate) {
        const minDateStr = minDate.toLocaleDateString('en-AU');
        toast({
          title: "Invalid end date",
          description: `End date must be on or after ${minDateStr} (medication start date or today, whichever is later).`,
          variant: "destructive",
        });
        return;
      }
    } else if (endDate < today) {
      toast({
        title: "Invalid end date",
        description: `End date cannot be before today.`,
        variant: "destructive",
      });
      return;
    }

    // Format date in local timezone to avoid timezone offset issues
    const year = medicationEndDate.getFullYear();
    const month = String(medicationEndDate.getMonth() + 1).padStart(2, '0');
    const day = String(medicationEndDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    endMedicationMutation.mutate({
      id: endingMedication.id,
      endDate: formattedDate,
    });
  };

  const handleEditPendingMilestone = (milestoneType: string, title: string) => {
    // Check if this milestone already exists in saved milestones
    const existingMilestone = milestones.find(m => m.type === milestoneType);

    if (existingMilestone) {
      // Edit existing milestone
      setEditingMilestone(existingMilestone);
      setEditMilestoneStatus(existingMilestone.status || "pending");
      setEditMilestoneDate(existingMilestone.date);
      setEditMilestoneNotes(sanitizeMilestoneNotes(existingMilestone.notes));
    } else {
      // Create new milestone from template
      const newMilestone = {
        id: `temp-${milestoneType}`,
        type: milestoneType,
        title: title,
        cycleId: activeCycle?.id,
        isNew: true
      };
      setEditingMilestone(newMilestone);
      setEditMilestoneStatus("in-progress");
      setEditMilestoneDate("");
      setEditMilestoneNotes("");
    }
    setShowEditDialog(true);
  };

  const getStatusIcon = (status: string | null | undefined) => {
    // Normalize status to handle variations
    if (!status) return <Clock className="text-muted-foreground" size={18} />;

    // Normalize: lowercase, trim, and replace spaces/underscores with hyphens
    const normalizedStatus = status.toLowerCase().trim().replace(/[\s_]/g, '-');

    // Handle in-progress status (with multiple possible formats)
    if (normalizedStatus === "in-progress" || normalizedStatus.includes("progress")) {
      return <Play className="text-white" size={18} strokeWidth={2.5} fill="currentColor" />;
    }

    switch (normalizedStatus) {
      case "completed":
        return <CheckCircle2 className="text-primary-foreground" size={18} />;
      case "cancelled":
        return <X className="text-primary-foreground" size={18} />;
      case "pending":
        return <Clock className="text-muted-foreground" size={18} />;
      default:
        return <AlertCircle className="text-muted-foreground" size={18} />;
    }
  };

  const getStatusColor = (status: string | null | undefined) => {
    // Normalize status to handle variations
    if (!status) return "bg-muted";

    // Normalize: lowercase, trim, and replace spaces/underscores with hyphens
    const normalizedStatus = status.toLowerCase().trim().replace(/[\s_]/g, '-');

    switch (normalizedStatus) {
      case "completed":
        return "bg-primary";
      case "in-progress":
        return "bg-primary";
      case "cancelled":
        return "bg-slate-500";
      case "pending":
        return "bg-muted";
      default:
        // Fallback: if status contains "progress", use in-progress color
        if (normalizedStatus.includes("progress")) {
          return "bg-primary";
        }
        return "bg-muted";
    }
  };

  const getBadgeStyles = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-primary/10 text-primary border-primary/20";
      case "in-progress":
        return "bg-primary/5 text-primary/80 border-primary/30";
      case "pending":
        return "bg-muted text-muted-foreground border-border";
      case "cancelled":
        return "bg-slate-50 text-slate-600 border-slate-200";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getPredictiveText = (milestoneName: string, cycleType: string, startDate: string) => {
    const milestone = cycleMilestones.find(m => m.name === milestoneName);
    if (milestone) {
      return `Usually day ${milestone.day} of cycle`;
    }

    // Fallback for unmapped types
    return "Pending";
  };

  const sanitizeMilestoneNotes = (notes?: string | null) => {
    if (!notes) return "";
    const autoGenerated =
      notes.includes("Medical details:") ||
      notes.includes("Monitoring:") ||
      notes.includes("Patient insights:");
    return autoGenerated ? "" : notes;
  };

  // Load medication data from backend using React Query
  const { data: medicationInfoList = [], refetch: refetchMedicationInfo, isLoading: isLoadingMedications, error: medicationError } = useQuery({
    queryKey: ["medicationInfo"],
    queryFn: async () => {
      console.log('[Medications] Fetching from API...');
      try {
        const medications = await loadMedicationData(false);
        console.log('[Medications] Fetched medications:', medications.length);
        console.log('[Medications] Medication names:', medications.map(m => m.name).join(', '));
        if (medications.length === 0) {
          console.warn('[Medications] No medications found in database. Seeding may be needed.');
        }
        return medications;
      } catch (error) {
        console.error('[Medications] Error in queryFn:', error);
        throw error;
      }
    },
    retry: 2,
    staleTime: 0, // Always refetch to get latest data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Map medication info to the format expected by the UI
  const commonMedications = React.useMemo(() => {
    console.log('[Medications] Mapping medications, count:', medicationInfoList.length);
    return medicationInfoList.map(med => ({
      id: med.id,
      name: med.name,
      type: med.class.toLowerCase().replace(/\s+/g, '-'), // Convert class to type format
      category: med.class // Use class as category
    }));
  }, [medicationInfoList]);

  const filteredMedications = commonMedications.filter(med => {
    const searchMatch = med.name.toLowerCase().includes(medicationSearch.toLowerCase());
    // Map filter values to medication classes
    let typeMatch = true;
    if (selectedMedicationType && selectedMedicationType !== "" && selectedMedicationType !== "all") {
      const categoryLower = med.category.toLowerCase();
      typeMatch =
        (selectedMedicationType === "recombinant-fsh" && categoryLower.includes("recombinant fsh")) ||
        (selectedMedicationType === "hmg" && categoryLower.includes("hmg")) ||
        (selectedMedicationType === "gnrh-antagonist" && categoryLower.includes("gnrh antagonist")) ||
        (selectedMedicationType === "gnrh-agonist" && categoryLower.includes("gnrh agonist")) ||
        (selectedMedicationType === "hcg" && categoryLower.includes("hcg")) ||
        (selectedMedicationType === "progesterone" && categoryLower.includes("progesterone")) ||
        med.type === selectedMedicationType;
    }
    return searchMatch && typeMatch;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <Card className="rounded-2xl p-5 shadow-sm relative" style={{ backgroundColor: 'hsl(74, 17%, 78%)' }}>
          <HamburgerMenu className="absolute top-5 right-3 text-white hover:bg-white/10" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-1" data-testid="header-title">
              Track Your Journey
            </h1>
            <p className="text-sm text-white/80" data-testid="header-subtitle">
              Log medications, symptoms & test results
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-6 mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex items-center bg-muted rounded-2xl p-1.5 w-full gap-1 h-12">
            <TabsTrigger
              value="cycle"
              className="flex-1 py-2.5 px-2.5 rounded-xl text-sm font-medium text-center whitespace-normal break-words data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              data-testid="tab-cycle"
            >
              Cycle
            </TabsTrigger>
            <TabsTrigger
              value="meds"
              className="flex-1 py-2.5 px-2.5 rounded-xl text-sm font-medium text-center whitespace-normal break-words data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              data-testid="tab-meds"
            >
              Meds
            </TabsTrigger>
            <TabsTrigger
              value="symptoms"
              className="flex-1 py-2.5 px-2.5 rounded-xl text-sm font-medium text-center whitespace-normal break-words data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              data-testid="tab-symptoms"
            >
              Symptoms
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="flex-1 py-2.5 px-2.5 rounded-xl text-sm font-medium text-center whitespace-normal break-words data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              data-testid="tab-events"
            >
              Appointments
            </TabsTrigger>
          </TabsList>

          {/* Cycle Tab */}
          <TabsContent value="cycle" className="mt-6 space-y-3">
            {!activeCycle ? (
              <>
                {/* Start New Cycle */}
                <Card className="rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4">
                    <CalendarIcon className="text-foreground" size={20} />
                    <div>
                      <h3 className="font-semibold text-foreground" data-testid="start-cycle-title">
                        Start New Cycle
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid="start-cycle-subtitle">
                        Begin tracking a new treatment cycle
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cycle-type" className="text-sm font-medium text-foreground">
                        Cycle Type
                      </Label>
                      <Select value={newCycleType} onValueChange={setNewCycleType} disabled={isLoadingCycleTypes || cycleTypes.length === 0}>
                        <SelectTrigger className="mt-1" data-testid="select-cycle-type">
                          <SelectValue placeholder={isLoadingCycleTypes ? "Loading..." : cycleTypes.length === 0 ? "No cycle types available" : "Select cycle type"} />
                        </SelectTrigger>
                        <SelectContent>
                          {cycleTypes.map((type: any) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cycleTypesError && (
                        <p className="text-xs text-destructive mt-1">Failed to load cycle types. Please refresh.</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="start-date" className="text-sm font-medium text-foreground">
                        Start Date
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={newCycleStartDate}
                        onChange={(e) => setNewCycleStartDate(e.target.value)}
                        className="mt-1"
                        data-testid="input-start-date"
                      />
                    </div>

                    <div>
                      <Label htmlFor="clinic" className="text-sm font-medium text-foreground">
                        Clinic
                      </Label>
                      <Input
                        id="clinic"
                        value={newCycleClinic}
                        onChange={(e) => setNewCycleClinic(e.target.value)}
                        placeholder="Enter clinic name"
                        className="mt-1"
                        data-testid="input-clinic"
                      />
                    </div>

                    <div>
                      <Label htmlFor="doctor" className="text-sm font-medium text-foreground">
                        Doctor
                      </Label>
                      <Input
                        id="doctor"
                        value={newCycleDoctor}
                        onChange={(e) => setNewCycleDoctor(e.target.value)}
                        placeholder="Enter doctor name"
                        className="mt-1"
                        data-testid="input-doctor"
                      />
                    </div>


                    <Button
                      onClick={handleStartCycle}
                      disabled={startCycleMutation.isPending || !newCycleType || !newCycleStartDate}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      data-testid="button-start-cycle"
                    >
                      {startCycleMutation.isPending ? "Starting..." : "Start Cycle Tracking"}
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              /* Detailed Cycle Status View */
              <>
                {/* Cycle Progress Header */}
                <Card className="rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Target className="text-primary" size={24} />
                      <div>
                        <h3 className="font-semibold text-foreground" data-testid="cycle-status-title">
                          {cycleTypes.find((ct: any) => ct.id === activeCycle.type)?.label || activeCycle.type}
                        </h3>
                        <p className="text-sm text-muted-foreground" data-testid="cycle-status-subtitle">
                          Day {Math.ceil((Date.now() - new Date(activeCycle.startDate).getTime()) / (1000 * 60 * 60 * 24))} • Started {new Date(activeCycle.startDate).toLocaleDateString('en-AU')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20" data-testid="cycle-status-badge">
                      {activeCycle.status}
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>Cycle Progress</span>
                      <span>
                        {activeCycle.type === 'ivf-fresh' ? '~28 days' :
                          activeCycle.type === 'ivf-frozen' ? '~21 days' :
                            activeCycle.type === 'iui' ? '~14 days' : '~28 days'}
                      </span>
                    </div>
                    <Progress
                      value={(() => {
                        // Check if cycle is completed or cancelled
                        const isCycleEnded = activeCycle.status === 'completed' || activeCycle.status === 'cancelled';

                        // Calculate day-based progress
                        const daysSinceStart = Math.ceil((Date.now() - new Date(activeCycle.startDate).getTime()) / (1000 * 60 * 60 * 24));
                        const estimatedLength = activeCycle.type === 'ivf-fresh' ? 28 :
                          activeCycle.type === 'ivf-frozen' ? 21 :
                            activeCycle.type === 'iui' ? 14 : 28;
                        const dayBasedProgress = Math.min((daysSinceStart / estimatedLength) * 100, 100);

                        // Check milestones if available
                        if (milestones && milestones.length > 0) {
                          const totalMilestones = milestones.length;
                          const completedMilestones = milestones.filter((m: any) =>
                            m.status === 'completed' || m.completed === true
                          ).length;
                          const milestoneProgress = (completedMilestones / totalMilestones) * 100;

                          // Only show 100% if all milestones are complete AND cycle is still active
                          if (milestoneProgress >= 100) {
                            const allMilestonesComplete = completedMilestones === totalMilestones;
                            if (allMilestonesComplete && !isCycleEnded) {
                              return 100;
                            } else {
                              return Math.min(milestoneProgress, 99);
                            }
                          }

                          // Use milestone progress if available, otherwise day-based
                          return Math.min(milestoneProgress, isCycleEnded ? 99 : 100);
                        }

                        // Fallback to day-based progress, but cap at 99% if cycle is ended
                        return isCycleEnded ? Math.min(dayBasedProgress, 99) : dayBasedProgress;
                      })()}
                      className="h-2"
                      data-testid="cycle-progress-bar"
                    />
                  </div>

                  {/* Current Phase Indicator */}
                  {currentPhase && (
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg border border-border" data-testid="phase-indicator-tracking">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xl" role="img" aria-label="phase-icon">🔄</span>
                        <h4 className="font-semibold text-slate-600" data-testid="phase-name-tracking">
                          {currentPhase.stage.name}
                        </h4>
                        {/* Source indicator */}
                        {/* <div className="flex items-center space-x-1">
                          {currentPhase.source === 'current_milestone' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full" title="Based on current milestone">
                              Current
                            </span>
                          )}
                          {currentPhase.source === 'fallback_milestone' && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full" title={`Based on recent progress (${currentPhase.fallbackMilestone?.daysAgo} days ago)`}>
                              Recent
                            </span>
                          )}
                          {currentPhase.source === 'day_based' && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full" title="Estimated based on cycle day">
                              Estimated
                            </span>
                          )}
                        </div> */}
                      </div>
                      {currentPhase.stage.description && (
                        <div className="mb-3">
                          <ul className="text-sm text-muted-foreground space-y-1" data-testid="phase-description-tracking">
                            {currentPhase.stage.description.split('\n').filter(line => line.trim()).map((line, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <span className="text-primary mt-1 text-xs">•</span>
                                <span>{line.trim()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Additional context for fallback scenarios */}
                      {currentPhase.source === 'fallback_milestone' && currentPhase.fallbackMilestone && (
                        <p className="text-xs text-muted-foreground mb-2 italic">
                          Based on recent progress from {currentPhase.fallbackMilestone.title}
                        </p>
                      )}
                      {currentPhase.confidence === 'low' && (
                        <p className="text-xs text-muted-foreground mb-2 italic">
                          Stage information pending - continue following your treatment plan
                        </p>
                      )}

                      {/* Stage Details */}
                      {/* {currentStageDetails && (
                        <div className="mb-3">
                          <h5 className="font-medium text-foreground mb-2 flex items-center space-x-2 text-sm">
                            <ClipboardList size={14} className="text-sky-500" />
                            <span>Stage Details</span>
                          </h5>
                          <div className="text-xs text-muted-foreground whitespace-pre-line" data-testid="stage-details">
                            {currentStageDetails}
                          </div>
                        </div>
                      )} */}

                      {currentPhase.tips && currentPhase.tips.length > 0 && (
                        <div className="space-y-1.5">
                          {currentPhase.tips.slice(0, 3).map((tip, index) => (
                            <div key={index} className="flex items-start space-x-2">
                              <Lightbulb className="text-amber-500 mt-0.5 flex-shrink-0" size={14} />
                              <span className="text-xs text-muted-foreground" data-testid={`phase-tip-${index}`}>
                                {tip}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clinic & Doctor Info */}
                  <div className="grid grid-cols-2 gap-4 mb-4 px-3 py-2">
                    {activeCycle.clinic && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="text-muted-foreground" size={16} />
                        <span className="text-sm font-medium text-foreground" data-testid="cycle-clinic">
                          {activeCycle.clinic}
                        </span>
                      </div>
                    )}
                    {activeCycle.doctor && (
                      <div className="flex items-center space-x-2">
                        <Stethoscope className="text-muted-foreground" size={16} />
                        <span className="text-sm font-medium text-foreground" data-testid="cycle-doctor">
                          {activeCycle.doctor}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs px-2"
                      onClick={() => setShowMilestoneForm(!showMilestoneForm)}
                      data-testid="button-add-milestone"
                    >
                      <Plus size={14} className="mr-1 flex-shrink-0" />
                      <span>Add</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs px-2"
                      onClick={() => setShowCycleActions(!showCycleActions)}
                      data-testid="button-manage-cycle"
                    >
                      <CalendarIcon size={14} className="mr-1 flex-shrink-0" />
                      <span>Manage</span>
                    </Button>
                  </div>
                </Card>

                {/* Sleek Edit Milestone Dialog */}
                <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold text-foreground">
                        {editingMilestone?.title}
                      </DialogTitle>
                      <div className="sr-only">Edit milestone status, date, and notes</div>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-foreground">
                            Status <span className="text-red-500">*</span>
                          </Label>
                          <Select value={editMilestoneStatus} onValueChange={setEditMilestoneStatus}>
                            <SelectTrigger className={`mt-1 ${!editMilestoneStatus ? 'border-red-500' : ''}`} data-testid="select-milestone-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          {!editMilestoneStatus && (
                            <p className="text-xs text-red-500 mt-1">
                              Status is required.
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-foreground">
                            Date <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="date"
                            value={editMilestoneDate}
                            onChange={(e) => setEditMilestoneDate(e.target.value)}
                            className={`mt-1 ${!editMilestoneDate ? 'border-red-500' : ''}`}
                            data-testid="input-milestone-date"
                            required
                          />
                          {!editMilestoneDate && (
                            <p className="text-xs text-red-500 mt-1">
                              Date is required.
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-foreground">Notes (optional)</Label>
                        <Textarea
                          placeholder="Add details about this milestone..."
                          value={editMilestoneNotes}
                          onChange={(e) => setEditMilestoneNotes(e.target.value)}
                          className="mt-1"
                          rows={3}
                          data-testid="textarea-milestone-notes"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          className="flex-1 text-xs sm:text-sm px-3"
                          onClick={editingMilestone?.isNew ? handleSaveMilestone : handleUpdateMilestone}
                          disabled={saveMilestoneMutation.isPending || updateMilestoneMutation.isPending}
                        >
                          {editingMilestone?.isNew
                            ? (saveMilestoneMutation.isPending ? "Saving..." : "Save")
                            : (updateMilestoneMutation.isPending ? "Updating..." : "Update")
                          }
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 text-xs sm:text-sm px-3"
                          onClick={() => setShowEditDialog(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Milestone Details Dialog */}
                <Dialog open={!!selectedMilestoneDetails} onOpenChange={() => setSelectedMilestoneDetails(null)}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold text-foreground">
                        {selectedMilestoneDetails?.name}
                      </DialogTitle>
                      {selectedMilestoneDetails?.day && (
                        <p className="text-sm text-muted-foreground">
                          Usually occurs on day {selectedMilestoneDetails.day} of your cycle
                        </p>
                      )}
                    </DialogHeader>
                    {selectedMilestoneDetails && (
                      <div className="space-y-4 py-4">
                        {/* Milestone Summary */}
                        {selectedMilestoneDetails.summary && (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <FileText size={16} className="text-primary" />
                              <h4 className="font-medium text-foreground">Summary</h4>
                            </div>
                            <p className="text-sm text-muted-foreground pl-6">
                              {selectedMilestoneDetails.summary}
                            </p>
                          </div>
                        )}

                        {/* Medical Details */}
                        {selectedMilestoneDetails.medicalDetails && (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Stethoscope size={16} className="text-primary" />
                              <h4 className="font-medium text-foreground">Medical Details</h4>
                            </div>
                            <p className="text-sm text-muted-foreground pl-6">
                              {selectedMilestoneDetails.medicalDetails}
                            </p>
                          </div>
                        )}

                        {/* Patient Insights */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <AlertCircle size={16} className="text-blue-500" />
                            <h4 className="font-medium text-foreground">What to Expect</h4>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">
                            {selectedMilestoneDetails.patientInsights}
                          </p>
                        </div>

                        {/* Tips */}
                        {selectedMilestoneDetails.tips && selectedMilestoneDetails.tips.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Lightbulb size={16} className="text-yellow-500" />
                              <h4 className="font-medium text-foreground">Helpful Tips</h4>
                            </div>
                            <ul className="text-sm text-muted-foreground pl-6 space-y-1">
                              {selectedMilestoneDetails.tips.map((tip: string, index: number) => (
                                <li key={index} className="flex items-start space-x-2">
                                  <span className="text-primary mt-1">•</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {/* Quick Event Dialog */}
                <Dialog open={showQuickEventDialog} onOpenChange={setShowQuickEventDialog}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold text-foreground">
                        Schedule Reminder
                      </DialogTitle>
                      <DialogDescription>
                        Create a quick appointment or monitoring reminder without leaving this view.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                      <div>
                        <Label className="text-sm font-medium text-foreground">Reminder Type</Label>
                        <Select value={quickEventType} onValueChange={setQuickEventType} disabled={isLoadingEventTypes || eventTypes.length === 0}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={isLoadingEventTypes ? "Loading..." : eventTypes.length === 0 ? "No event types available" : "Select reminder type"} />
                          </SelectTrigger>
                          <SelectContent>
                            {eventTypes.map((type: any) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-foreground">Title</Label>
                        <Input
                          value={quickEventTitle}
                          onChange={(e) => setQuickEventTitle(e.target.value)}
                          placeholder="e.g., Clinic visit, Blood test"
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-foreground">Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full mt-1 justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {quickEventDate ? quickEventDate.toLocaleDateString("en-AU") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={quickEventDate}
                                onSelect={(date) => date && setQuickEventDate(date)}
                                initialFocus
                                weekStartsOn={1}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-foreground">Time</Label>
                          <Input
                            type="time"
                            value={quickEventTime}
                            onChange={(e) => setQuickEventTime(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-foreground">Location (optional)</Label>
                        <Input
                          value={quickEventLocation}
                          onChange={(e) => setQuickEventLocation(e.target.value)}
                          placeholder="Clinic name, hospital, lab"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-foreground">Notes (optional)</Label>
                        <Textarea
                          value={quickEventNotes}
                          onChange={(e) => setQuickEventNotes(e.target.value)}
                          rows={3}
                          placeholder="Any prep instructions or reminders"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1"
                        disabled={!quickEventTitle || !quickEventTime}
                        onClick={handleSubmitQuickEvent}
                      >
                        Save reminder
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowQuickEventDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>


                {/* Add Milestone Form */}
                {showMilestoneForm && (
                  <Card className="rounded-2xl p-6 shadow-sm border-primary/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-foreground" data-testid="add-milestone-title">
                        Add Milestone
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMilestoneForm(false)}
                        data-testid="button-close-milestone-form"
                      >
                        <X size={16} />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="milestone-type" className="text-sm font-medium text-foreground">
                          Milestone Type <span className="text-red-500">*</span>
                        </Label>
                        <Select value={milestoneType} onValueChange={setMilestoneType}>
                          <SelectTrigger className="mt-1" data-testid="select-milestone-type">
                            <SelectValue placeholder="Select milestone" />
                          </SelectTrigger>
                          <SelectContent>
                            {addMilestoneOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="milestone-date" className="text-sm font-medium text-foreground">
                          Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="milestone-date"
                          type="date"
                          value={milestoneDate}
                          onChange={(e) => setMilestoneDate(e.target.value)}
                          className="mt-1"
                          data-testid="input-milestone-date"
                        />
                      </div>

                      <div>
                        <Label htmlFor="milestone-notes" className="text-sm font-medium text-foreground">
                          Notes (optional)
                        </Label>
                        <Textarea
                          id="milestone-notes"
                          placeholder=""
                          value={milestoneNotes}
                          onChange={(e) => setMilestoneNotes(e.target.value)}
                          className="mt-1"
                          rows={3}
                          data-testid="textarea-milestone-notes"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="flex-1 text-xs sm:text-sm px-3"
                          onClick={handleSaveMilestone}
                          disabled={saveMilestoneMutation.isPending}
                          data-testid="button-save-milestone"
                        >
                          {saveMilestoneMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 text-xs sm:text-sm px-3"
                          onClick={() => setShowMilestoneForm(false)}
                          data-testid="button-cancel-milestone"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Cycle Management Actions */}
                {showCycleActions && (
                  <Card className="rounded-2xl p-6 shadow-sm border-primary/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-foreground" data-testid="cycle-actions-title">
                        Cycle Management
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCycleActions(false)}
                        data-testid="button-close-cycle-actions"
                      >
                        <X size={16} />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-muted/30 rounded-xl">
                        <h4 className="font-medium text-foreground mb-2" data-testid="finish-cycle-title">
                          Complete Cycle
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Mark this cycle as completed
                        </p>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white w-full"
                          onClick={() => handleFinishCycle('completed')}
                          disabled={finishCycleMutation.isPending}
                          data-testid="button-complete-cycle"
                        >
                          {finishCycleMutation.isPending ? "Completing..." : "Complete Cycle"}
                        </Button>
                      </div>

                      <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl">
                        <h4 className="font-medium text-foreground mb-2" data-testid="cancel-cycle-title">
                          Cancel Cycle
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Cancel this cycle if treatment was discontinued
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 w-full"
                          onClick={handleCancelCycle}
                          disabled={finishCycleMutation.isPending}
                          data-testid="button-cancel-cycle"
                        >
                          {finishCycleMutation.isPending ? "Cancelling..." : "Cancel Cycle"}
                        </Button>
                      </div>

                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                        <h4 className="font-medium text-foreground mb-2" data-testid="generate-summary-title">
                          Cycle Summary & Export
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Compile medications, labs, symptoms, milestones, and appointments into a doctor-ready summary.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => handleOpenSummary(activeCycle)}
                            data-testid="button-view-summary"
                          >
                            <FileText size={16} className="mr-2" />
                            View summary
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDownloadSummary("pdf", activeCycle)}
                            disabled={downloadingFormat === "pdf"}
                            data-testid="button-download-summary-pdf"
                          >
                            <Download size={16} className="mr-2" />
                            {downloadingFormat === "pdf" ? "Preparing..." : "Download PDF"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadSummary("csv", activeCycle)}
                            disabled={downloadingFormat === "csv"}
                            data-testid="button-download-summary-csv"
                          >
                            {downloadingFormat === "csv" ? "Preparing..." : "Export CSV"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleGenerateSummary}
                            data-testid="button-open-summary-window"
                          >
                            Open in browser
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopySummaryLink(activeCycle)}
                            data-testid="button-copy-summary-link"
                          >
                            <Copy size={16} className="mr-2" />
                            Copy link
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Milestones Timeline */}
                <Card className="rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4">
                    <CheckCircle2 className="text-primary" size={20} />
                    <h3 className="font-semibold text-foreground" data-testid="milestones-title">
                      Cycle Milestones
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Show actual saved milestones */}
                    {milestones.map((milestone) => {
                      const displayTitle = formatMilestoneTitle(milestone.title);
                      // Determine status from milestone data
                      const getDisplayStatus = (milestone: any) => {
                        // Use the new status field if available, fallback to completed boolean
                        if (milestone.status && milestone.status.trim()) {
                          // Normalize the status to ensure consistency
                          const normalized = milestone.status.toLowerCase().trim().replace(/[\s_]/g, '-');
                          return normalized;
                        }
                        if (milestone.completed === false) return "in-progress";
                        if (milestone.completed === true) return "completed";
                        return "pending"; // default to pending instead of in-progress
                      };

                      const displayStatus = getDisplayStatus(milestone);
                      const statusLabels = {
                        "in-progress": "In Progress",
                        "completed": "Completed",
                        "cancelled": "Cancelled",
                        "pending": "Pending"
                      };

                      return (
                        <div
                          key={milestone.id}
                          className="p-5 border border-border rounded-xl cursor-pointer hover:bg-muted/30 hover:shadow-md transition-all flex flex-col gap-4 shadow-sm bg-card"
                          onClick={() => {
                            setEditingMilestone(milestone);
                            setEditMilestoneStatus(displayStatus);
                            setEditMilestoneDate(milestone.date);
                            setEditMilestoneNotes(sanitizeMilestoneNotes(milestone.notes));
                            setShowEditDialog(true);
                          }}
                        >
                          <div className="space-y-2">
                            <h4
                              className="font-semibold text-foreground text-base"
                              data-testid={`milestone-${milestone.id}`}
                            >
                              {displayTitle}
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {displayStatus !== "pending" ? (
                                <>
                                  {new Date(milestone.date).toLocaleDateString("en-AU")}
                                </>
                              ) : (
                                getPredictiveText(
                                  displayTitle,
                                  activeCycle.type,
                                  activeCycle.startDate
                                )
                              )}
                            </p>
                            {/* Milestone Summary */}
                            {(() => {
                              const summary = getMilestoneSummary(
                                activeCycle.type,
                                milestone.type,
                                displayTitle,
                                milestone.type
                              );
                              return summary ? (
                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                  {summary}
                                </p>
                              ) : null;
                            })()}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-3 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewMilestoneDetails(milestone);
                              }}
                            >
                              <Info size={12} className="mr-1.5" />
                              Details
                            </Button>
                          </div>

                          <div className="pt-4 border-t border-dashed border-border/60 flex items-center gap-2.5 text-sm">
                            <div
                              className={`w-8 h-8 ${getStatusColor(
                                displayStatus
                              )} rounded-full flex items-center justify-center`}
                            >
                              {getStatusIcon(displayStatus)}
                            </div>
                            <span className="font-medium text-foreground">
                              {statusLabels[displayStatus as keyof typeof statusLabels] ||
                                "Pending"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Dynamic milestones based on cycle type */}
                    {activeCycle.type === 'ivf-fresh' && (
                      <>
                        {!milestones.some(m => m.type === 'stimulation-start') && (
                          <div
                            className="p-5 border border-border rounded-xl cursor-pointer hover:bg-muted/30 hover:shadow-md transition-all shadow-sm bg-card"
                            onClick={() => handleEditPendingMilestone('stimulation-start', 'Ovarian Stimulation')}
                          >
                            <div className="space-y-2 mb-4">
                              <h4 className="font-semibold text-foreground text-base" data-testid="milestone-stimulation">
                                Ovarian Stimulation
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {getPredictiveText('stimulation-start', activeCycle.type, activeCycle.startDate)}
                              </p>
                            </div>
                            <div className="pt-4 border-t border-dashed border-border/60 flex items-center gap-2.5 text-sm">
                              <div className={`w-8 h-8 ${getStatusColor("pending")} rounded-full flex items-center justify-center`}>
                                {getStatusIcon("pending")}
                              </div>
                              <span className="font-medium text-foreground">Pending</span>
                            </div>
                          </div>
                        )}

                        {!milestones.some(m => m.type === 'embryo-transfer') && (
                          <div
                            className="p-5 border border-border rounded-xl cursor-pointer hover:bg-muted/30 hover:shadow-md transition-all shadow-sm bg-card"
                            onClick={() => handleEditPendingMilestone('embryo-transfer', 'Embryo Transfer')}
                          >
                            <div className="space-y-2 mb-4">
                              <h4 className="font-semibold text-foreground text-base" data-testid="milestone-embryo-transfer">
                                Embryo Transfer
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {getPredictiveText('embryo-transfer', activeCycle.type, activeCycle.startDate)}
                              </p>
                            </div>
                            <div className="pt-4 border-t border-dashed border-border/60 flex items-center gap-2.5 text-sm">
                              <div className={`w-8 h-8 ${getStatusColor("pending")} rounded-full flex items-center justify-center`}>
                                {getStatusIcon("pending")}
                              </div>
                              <span className="font-medium text-foreground">Pending</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}


                    {activeCycle.type === 'iui' && (
                      <>
                        {!milestones.some(m => m.type === 'iui-procedure') && (
                          <div
                            className="p-5 border border-border rounded-xl cursor-pointer hover:bg-muted/30 hover:shadow-md transition-all shadow-sm bg-card"
                            onClick={() => handleEditPendingMilestone('iui-procedure', 'IUI Procedure')}
                          >
                            <div className="space-y-2 mb-4">
                              <h4 className="font-semibold text-foreground text-base" data-testid="milestone-iui-procedure">
                                IUI Procedure
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {getPredictiveText('iui-procedure', activeCycle.type, activeCycle.startDate)}
                              </p>
                            </div>
                            <div className="pt-4 border-t border-dashed border-border/60 flex items-center gap-2.5 text-sm">
                              <div className={`w-8 h-8 ${getStatusColor("pending")} rounded-full flex items-center justify-center`}>
                                {getStatusIcon("pending")}
                              </div>
                              <span className="font-medium text-foreground">Pending</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                  </div>
                </Card>

                {/* Upcoming Reminders */}
                <Card className="rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <CalendarIcon className="text-primary" size={20} />
                      <h3 className="font-semibold text-foreground" data-testid="upcoming-events-title">
                        Upcoming Reminders
                      </h3>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={handleViewAllEvents}>
                      View all
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {upcomingReminderItems.length > 0 ? (
                      upcomingReminderItems.slice(0, 3).map((reminder) => {
                        const statusMeta = getReminderStatusMeta(reminder.date);
                        return (
                          <div
                            key={reminder.id}
                            className="flex items-start justify-between gap-3 p-3 border border-border rounded-xl"
                          >
                            <div>
                              <h4 className="font-medium text-foreground text-sm">
                                {reminder.title}
                              </h4>
                              {reminder.subtitle && (
                                <p className="text-xs text-muted-foreground">
                                  {reminder.subtitle}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground/80 mt-1">
                                {formatReminderDateTime(reminder.date)}
                                {reminder.location ? ` • ${reminder.location}` : ""}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </Badge>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        No reminders scheduled yet. Add clinic visits or monitoring tasks to stay on track.
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center rounded-full px-4 py-2.5 text-sm font-medium"
                        onClick={() =>
                          handleQuickEventSchedule({
                            title: "Clinic appointment",
                            type: "doctor_visit",
                            notes: "Schedule your next clinic visit",
                          })
                        }
                      >
                        Schedule visit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center rounded-full px-4 py-2.5 text-sm font-medium"
                        onClick={() =>
                          handleQuickEventSchedule({
                            title: activeCycle?.type === "ivf-frozen" ? "Lining Check" : "Monitoring Scan",
                            type: "test_result",
                            notes:
                              activeCycle?.type === "ivf-frozen"
                                ? "Monitor endometrial thickness"
                                : "Track follicle development",
                          })
                        }
                      >
                        Add monitoring
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-center rounded-full px-4 py-2.5 text-sm font-medium"
                        onClick={handleViewAllEvents}
                      >
                        Open calendar
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Active Medications Summary */}
                <Card className="rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Syringe className="text-primary" size={20} />
                      <h3 className="font-semibold text-foreground" data-testid="active-medications-title">
                        Active Medications
                      </h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="button-view-all-meds"
                      onClick={handleViewAllMedications}
                    >
                      View All
                    </Button>
                  </div>

                  {todaysMedications.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground text-sm" data-testid="no-active-medications">
                        No medications scheduled. Add medications in the Meds tab.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todaysMedications.slice(0, 3).map((medication) => (
                        <div key={medication.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                          <div>
                            <h4 className="font-medium text-foreground text-sm" data-testid={`active-med-name-${medication.id}`}>
                              {medication.name}
                            </h4>
                            <p className="text-xs text-muted-foreground" data-testid={`active-med-schedule-${medication.id}`}>
                              {medication.dosage} • {medication.time}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                            Today
                          </Badge>
                        </div>
                      ))}
                      {todaysMedications.length > 3 && (
                        <p className="text-xs text-center text-muted-foreground pt-2" data-testid="more-medications-count">
                          +{todaysMedications.length - 3} more medications
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </>
            )}
            {/* Closed/Complete Cycles Summary Export - Always visible at bottom */}
            {completedOrCancelledCycles.length > 0 && (
              <Card className="rounded-2xl p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <FileText className="text-foreground" size={20} />
                  <div>
                    <h3 className="font-semibold text-foreground" data-testid="closed-cycles-summary-title">
                      Closed/Complete Cycles Summary
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid="closed-cycles-summary-subtitle">
                      Export summary data for completed or cancelled cycles
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {completedOrCancelledCycles.map((cycle) => (
                    <div
                      key={cycle.id}
                      className="p-4 border border-border rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors relative"
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 left-2 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                        onClick={() => setCycleToDelete(cycle)}
                        data-testid={`button-delete-cycle-${cycle.id}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                      <div className="flex flex-col gap-3 pl-10">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-medium text-foreground">
                              {cycleTypes.find((ct: any) => ct.id === cycle.type)?.label || cycle.type}
                            </p>
                            <Badge
                              variant={cycle.status === 'completed' ? 'default' : 'destructive'}
                              className="text-xs shrink-0"
                            >
                              {cycle.status === 'completed' ? 'Completed' : 'Cancelled'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Started {formatDisplayDate(cycle.startDate)} •
                            {cycle.endDate ? ` Ended ${formatDisplayDate(cycle.endDate)}` :
                              cycle.updatedAt ? ` Updated ${formatDisplayDate(cycle.updatedAt)}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenSummary(cycle);
                            }}
                            data-testid={`button-view-summary-${cycle.id}`}
                            className="flex-1 sm:flex-initial"
                          >
                            <FileText size={14} className="mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadSummary("pdf", cycle)}
                            disabled={downloadingFormat === "pdf"}
                            data-testid={`button-download-pdf-${cycle.id}`}
                            className="flex-1 sm:flex-initial"
                          >
                            <Download size={14} className="mr-1" />
                            {downloadingFormat === "pdf" ? "Preparing..." : "PDF"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadSummary("csv", cycle)}
                            disabled={downloadingFormat === "csv"}
                            data-testid={`button-download-csv-${cycle.id}`}
                            className="flex-1 sm:flex-initial"
                          >
                            <Download size={14} className="mr-1" />
                            {downloadingFormat === "csv" ? "Preparing..." : "CSV"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Medications Tab */}
          <TabsContent value="meds" className="mt-6 space-y-3">
            <Card className="rounded-2xl p-6 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <Syringe className="text-stone-600 flex-shrink-0" size={24} />
                  <h3 className="font-semibold text-foreground truncate" data-testid="medications-title">
                    Today's Medications
                  </h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-add-medication"
                  onClick={() => setShowAddMedication(true)}
                  className="flex-shrink-0 whitespace-nowrap"
                >
                  <Plus size={16} className="mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">Add Medication</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>

              {todaysMedications.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground" data-testid="no-medications">
                    No medications scheduled for today. Add your medication schedule to track doses.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaysMedications.map((medication) => (
                    <div key={medication.id} className="border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-foreground" data-testid={`medication-name-${medication.id}`}>
                              {medication.name}
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                              onClick={() => setEditingMedication(medication)}
                              data-testid={`edit-medication-today-${medication.id}`}
                            >
                              <Pencil size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setMedicationToDelete(medication)}
                              data-testid={`delete-medication-today-${medication.id}`}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p data-testid={`medication-dosage-${medication.id}`}>
                              {medication.dosage}
                            </p>
                            <div className="flex items-center space-x-1">
                              <Clock size={12} />
                              <span data-testid={`medication-time-${medication.id}`}>
                                {medication.time}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-log-${medication.id}`}
                          onClick={() => {
                            setLoggingMedication(medication);
                            setLogDoseDate(new Date());
                            setLogDoseNotes("");
                            setShowLogDose(true);
                          }}
                        >
                          Log Dose
                        </Button>
                      </div>

                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">
                          Notes (optional)
                        </Label>
                        <Textarea
                          placeholder="Any side effects or observations..."
                          className="mt-1"
                          rows={2}
                          data-testid={`textarea-med-notes-${medication.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Medication History */}
            <Card className="rounded-2xl p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <Pill className="text-stone-600" size={24} />
                <h3 className="font-semibold text-foreground" data-testid="medication-history-title">
                  Medication History
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4" data-testid="medication-history-subtitle">
                What's been taken to date this cycle
              </p>

              {medications.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground" data-testid="no-medication-history">
                    No medications logged for this cycle yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {medications.map((medication) => (
                    <div key={medication.id} className="border border-border rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              <h4 className="font-medium text-foreground" data-testid={`history-med-name-${medication.id}`}>
                                {medication.name}
                              </h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              onClick={() => setEditingMedication(medication)}
                              data-testid={`edit-medication-${medication.id}`}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setMedicationToDelete(medication)}
                              data-testid={`delete-medication-${medication.id}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={async () => {
                                // Try to find medication info by name first (for backward compatibility)
                                let info = await getMedicationInfo(medication.name);
                                if (!info && medication.medicationInfoId) {
                                  // If not found by name, try by ID
                                  info = await getMedicationInfoById(medication.medicationInfoId);
                                }
                                if (info) {
                                  console.log('[Medication Info] Loaded:', info.name, 'videoLink:', info.videoLink);
                                  setSelectedMedicationInfo(info);
                                  setShowMedicationInfo(true);
                                } else {
                                  toast({
                                    title: "Medication info not found",
                                    description: "Information for this medication is not available. You can add it if needed.",
                                    variant: "default",
                                  });
                                }
                              }}
                              data-testid={`info-history-${medication.id}`}
                              title="View medication information"
                            >
                              <Info size={14} className="text-muted-foreground" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`history-med-dosage-${medication.id}`}>
                            {medication.dosage} • {medication.frequency}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Started: {(() => {
                              const startDateStr = medication.startDate instanceof Date
                                ? medication.startDate.toISOString().split('T')[0]
                                : medication.startDate;
                              const startDate = new Date(startDateStr + 'T00:00:00');
                              return startDate.toLocaleDateString('en-AU');
                            })()}
                            {medication.endDate && (() => {
                              const endDateStr = medication.endDate instanceof Date
                                ? medication.endDate.toISOString().split('T')[0]
                                : medication.endDate;
                              const endDate = new Date(endDateStr + 'T00:00:00');
                              const startDateStr = medication.startDate instanceof Date
                                ? medication.startDate.toISOString().split('T')[0]
                                : medication.startDate;
                              const startDate = new Date(startDateStr + 'T00:00:00');

                              // Validate: end date should not be before start date
                              if (endDate < startDate) {
                                console.warn(`[Medication History] ${medication.name}: End date (${endDateStr}) is before start date (${startDateStr})`);
                                return null; // Don't show end date if it's invalid
                              }
                              return ` • Ended: ${endDate.toLocaleDateString('en-AU')}`;
                            })()}
                          </p>
                        </div>
                        {!medication.endDate && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEndingMedication(medication);
                              setMedicationEndDate(new Date());
                              setShowEndMedication(true);
                            }}
                            data-testid={`button-end-${medication.id}`}
                          >
                            End
                          </Button>
                        )}
                      </div>

                      <div className="bg-muted rounded-lg p-3 mt-3">
                        {(() => {
                          // Calculate dots based on frequency
                          const dotsPerDay = medication.frequency === 'daily' ? 1
                            : medication.frequency === 'twice-daily' ? 2
                              : medication.frequency === 'three-times' ? 3
                                : 1;
                          const totalDots = 14 * dotsPerDay;

                          // Get medication start date
                          const startDateStr = medication.startDate instanceof Date
                            ? medication.startDate.toISOString().split('T')[0]
                            : medication.startDate;
                          const startDate = new Date(startDateStr + 'T00:00:00');

                          // Get logs for this medication
                          const medLogs = medicationLogs.filter(log => log.medicationId === medication.id);

                          // Create a map of dates to logged doses
                          const loggedDosesByDate = new Map<string, number>();
                          medLogs.forEach(log => {
                            const logDate = log.date instanceof Date
                              ? log.date.toISOString().split('T')[0]
                              : log.date;
                            if (log.taken) {
                              loggedDosesByDate.set(logDate, (loggedDosesByDate.get(logDate) || 0) + 1);
                            }
                          });

                          // Generate dots for 14 days
                          const dots = [];
                          for (let day = 0; day < 14; day++) {
                            const currentDate = new Date(startDate);
                            currentDate.setDate(currentDate.getDate() + day);
                            const dateStr = currentDate.toISOString().split('T')[0];
                            const loggedCount = loggedDosesByDate.get(dateStr) || 0;

                            // Check if medication should be taken on this day based on frequency
                            const shouldTake = (() => {
                              switch (medication.frequency) {
                                case 'daily':
                                case 'twice-daily':
                                case 'three-times':
                                  return true;
                                case 'every-other-day':
                                  return day % 2 === 0;
                                case 'weekly':
                                  return day % 7 === 0;
                                case 'once':
                                  return day === 0;
                                default:
                                  return true;
                              }
                            })();

                            // Check if date is within medication range
                            const endDateStr = medication.endDate
                              ? (medication.endDate instanceof Date
                                ? medication.endDate.toISOString().split('T')[0]
                                : medication.endDate)
                              : null;
                            let endDate = endDateStr ? new Date(endDateStr + 'T00:00:00') : null;

                            // Validate end date - if it's before start date, ignore it
                            if (endDate && endDate < startDate) {
                              console.warn(`[Medication Tracker] ${medication.name}: End date (${endDateStr}) is before start date (${startDateStr}), ignoring end date`);
                              endDate = null;
                            }

                            const isWithinRange = currentDate >= startDate && (!endDate || currentDate <= endDate);

                            // Create dots for this day - always create dots even if not scheduled
                            for (let dose = 0; dose < dotsPerDay; dose++) {
                              const isLogged = shouldTake && isWithinRange && loggedCount > dose;
                              dots.push({
                                day: day + 1,
                                dose: dose + 1,
                                isLogged,
                                shouldTake: shouldTake && isWithinRange
                              });
                            }
                          }

                          // Organize dots by day for better display
                          // For multiple doses per day, stack them vertically
                          const dotsByDay = new Map<number, typeof dots>();
                          dots.forEach(dot => {
                            if (!dotsByDay.has(dot.day)) {
                              dotsByDay.set(dot.day, []);
                            }
                            dotsByDay.get(dot.day)!.push(dot);
                          });

                          return (
                            <>
                              <div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                                {Array.from({ length: 14 }, (_, dayIndex) => {
                                  const day = dayIndex + 1;
                                  const dayDots = dotsByDay.get(day) || [];

                                  return (
                                    <div key={day} className="flex flex-col gap-0.5 items-center">
                                      {dayDots.length > 0 ? (
                                        dayDots.map((dot, doseIndex) => (
                                          <div
                                            key={`${dot.day}-${dot.dose}`}
                                            className={`w-4 h-4 rounded-sm flex-shrink-0 ${dot.isLogged
                                              ? 'bg-primary'
                                              : dot.shouldTake
                                                ? 'bg-muted-foreground/20 border border-border'
                                                : 'bg-transparent'
                                              }`}
                                            title={`Day ${dot.day}, Dose ${dot.dose}: ${dot.isLogged ? 'Taken' : dot.shouldTake ? 'Not taken' : 'Not scheduled'}`}
                                            data-testid={`dose-day-${medication.id}-${dot.day}-${dot.dose}`}
                                          />
                                        ))
                                      ) : (
                                        // Placeholder for days with no doses
                                        <div className="w-4 h-4 rounded-sm bg-transparent" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                <span>Day 1</span>
                                <span>Day 14</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Logged Doses History */}
                      {(() => {
                        const medLogs = medicationLogs
                          .filter(log => log.medicationId === medication.id && log.taken)
                          .sort((a, b) => {
                            const dateA = a.date instanceof Date ? a.date : new Date(a.date);
                            const dateB = b.date instanceof Date ? b.date : new Date(b.date);
                            return dateB.getTime() - dateA.getTime(); // Most recent first
                          });

                        if (medLogs.length === 0) {
                          return null;
                        }

                        return (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h5 className="text-sm font-medium text-foreground mb-3">
                              Logged Doses ({medLogs.length})
                            </h5>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {medLogs.map((log) => {
                                const logDate = log.date instanceof Date
                                  ? log.date
                                  : new Date(log.date);
                                const takenAt = log.takenAt
                                  ? (log.takenAt instanceof Date ? log.takenAt : new Date(log.takenAt))
                                  : null;

                                return (
                                  <div
                                    key={log.id}
                                    className="flex items-start justify-between p-2 bg-muted/50 rounded-lg text-sm"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
                                        <span className="font-medium text-foreground">
                                          {logDate.toLocaleDateString('en-AU', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                          })}
                                        </span>
                                        {takenAt && (
                                          <span className="text-xs text-muted-foreground">
                                            at {takenAt.toLocaleTimeString('en-AU', {
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </span>
                                        )}
                                      </div>
                                      {log.notes && (
                                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                                          {log.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Add Medication Dialog */}
            <Dialog open={showAddMedication} onOpenChange={setShowAddMedication}>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    Add Medication
                  </DialogTitle>
                  <div className="sr-only">Search and add medications to your treatment plan</div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Search and Filter Section */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-foreground">
                        Search Medications
                      </Label>
                      <Input
                        placeholder="Type medication name (e.g., Gonal-f, Crinone...)"
                        value={medicationSearch}
                        onChange={(e) => setMedicationSearch(e.target.value)}
                        className="mt-1"
                        data-testid="medication-search"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-foreground">
                        Filter by Type
                      </Label>
                      <Select value={selectedMedicationType} onValueChange={setSelectedMedicationType}>
                        <SelectTrigger className="mt-1" data-testid="medication-type-filter">
                          <SelectValue placeholder="All medication types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="recombinant-fsh">Recombinant FSH</SelectItem>
                          <SelectItem value="hmg">hMG (FSH + LH)</SelectItem>
                          <SelectItem value="gnrh-antagonist">GnRH Antagonist</SelectItem>
                          <SelectItem value="gnrh-agonist">GnRH Agonist</SelectItem>
                          <SelectItem value="hcg">hCG (Trigger)</SelectItem>
                          <SelectItem value="progesterone">Progesterone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Medication List */}
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    <Label className="text-sm font-medium text-foreground">
                      Available Medications ({filteredMedications.length} of {commonMedications.length})
                      {medicationInfoList.length > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Loaded: {medicationInfoList.length})
                        </span>
                      )}
                    </Label>

                    {isLoadingMedications ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Loading medications...</p>
                      </div>
                    ) : medicationError ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-red-500">Error loading medications</p>
                        <p className="text-xs mt-1">Please refresh the page or contact support</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            console.log('[Medications] Manual retry triggered');
                            refetchMedicationInfo();
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : commonMedications.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No medications available</p>
                        <p className="text-xs mt-1">Medications will be loaded from the database</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={async () => {
                            console.log('[Medications] Manual refresh triggered');
                            // Clear cache and refetch
                            const { clearMedicationCache } = await import('@/lib/medicationUtils');
                            clearMedicationCache();
                            await refetchMedicationInfo();
                          }}
                        >
                          Refresh
                        </Button>
                      </div>
                    ) : filteredMedications.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No medications found matching your search.</p>
                        <p className="text-xs mt-1">Try adjusting your search or filter criteria.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredMedications.map((medication, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border border-border rounded-xl hover:bg-muted/30 transition-colors"
                          >
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={async (e) => {
                                // Prevent triggering when clicking the + button
                                if ((e.target as HTMLElement).closest('button')) {
                                  return;
                                }

                                // Show medication info when clicking on the card (using ID)
                                try {
                                  const info = await getMedicationInfoById(medication.id);
                                  if (info) {
                                    setSelectedMedicationInfo(info);
                                    setShowMedicationInfo(true);
                                  } else {
                                    toast({
                                      title: "Medication not found",
                                      description: "This medication information is not available.",
                                      variant: "destructive",
                                    });
                                  }
                                } catch (error) {
                                  console.error("Error loading medication info:", error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to load medication information.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`med-card-${medication.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-foreground" data-testid={`med-option-${medication.name}`}>
                                  {medication.name}
                                </h4>
                                <Info size={14} className="text-muted-foreground" />
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {medication.category}
                                </Badge>
                                <span className="capitalize">{medication.type}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="h-8 w-8 rounded-full p-0 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent card click
                                // Close the add medication dialog
                                setShowAddMedication(false);
                                // Directly open the medication form
                                setTimeout(() => {
                                  setSelectedMedication(medication.name);
                                  setMedicationDosage("");
                                  setMedicationTime("");
                                  setMedicationFrequency("");
                                  setMedicationReminder(false);
                                }, 100);
                              }}
                              data-testid={`add-${medication.name}`}
                              title="Add medication"
                            >
                              <Plus size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Add Custom Medication */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">Not found?</h4>
                        <p className="text-sm text-muted-foreground">Add a custom medication</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedMedication("Custom");
                          setShowAddMedication(false);
                          setMedicationDosage("");
                          setMedicationTime("");
                          setMedicationFrequency("");
                          setMedicationReminder(false);
                        }}
                        data-testid="add-custom-medication"
                      >
                        <Plus size={16} className="mr-2" />
                        Add Custom
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Medication Information Dialog */}
            <Dialog
              open={showMedicationInfo}
              onOpenChange={(open) => {
                setShowMedicationInfo(open);
                // When dialog closes, clear the selected medication info
                if (!open) {
                  setSelectedMedicationInfo(null);
                }
              }}
            >
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                {selectedMedicationInfo && (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold text-foreground">
                        {selectedMedicationInfo.name}
                      </DialogTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {selectedMedicationInfo.class}
                        </Badge>
                      </div>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                      {/* Generic Name */}
                      <div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Generic:</span> {selectedMedicationInfo.generic}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium text-foreground">Class:</span> {selectedMedicationInfo.class}
                        </p>
                      </div>

                      {/* Purpose */}
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Purpose</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedMedicationInfo.purpose}
                        </p>
                      </div>

                      {/* Route & Timing */}
                      <div>
                        <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                          <Stethoscope size={16} />
                          Administration
                        </h4>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">Route:</span> {selectedMedicationInfo.route}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Timing/Dosing:</span> {selectedMedicationInfo.timing}
                          </p>
                        </div>
                      </div>

                      {/* Common Side Effects */}
                      {selectedMedicationInfo.commonSideEffects && selectedMedicationInfo.commonSideEffects.length > 0 && (
                        <div>
                          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                            <AlertCircle size={16} className="text-amber-500" />
                            Common Side Effects
                          </h4>
                          <ul className="space-y-2">
                            {selectedMedicationInfo.commonSideEffects.map((effect, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                                <span>{effect}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Serious Side Effects */}
                      {selectedMedicationInfo.seriousSideEffects && selectedMedicationInfo.seriousSideEffects.length > 0 && (
                        <div>
                          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-500" />
                            Serious Side Effects
                          </h4>
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <ul className="space-y-2">
                              {selectedMedicationInfo.seriousSideEffects.map((effect, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm text-red-900">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                                  <span>{effect}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Monitoring Notes */}
                      {selectedMedicationInfo.monitoringNotes && (
                        <div>
                          <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                            <Target size={16} className="text-blue-500" />
                            Monitoring Notes
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {selectedMedicationInfo.monitoringNotes}
                          </p>
                        </div>
                      )}

                      {/* Patient Notes */}
                      {selectedMedicationInfo.patientNotes && (
                        <div>
                          <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                            <Lightbulb size={16} className="text-yellow-500" />
                            Patient Notes
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {selectedMedicationInfo.patientNotes}
                          </p>
                        </div>
                      )}

                      {/* Video Instructions */}
                      {/* TODO: Uncomment when video links are available
                      {selectedMedicationInfo.videoLink && selectedMedicationInfo.videoLink.trim() !== "" && (
                        <div>
                          <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                            <Play size={16} className="text-blue-500" />
                            Video Instructions
                          </h4>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              window.open(selectedMedicationInfo.videoLink, '_blank', 'noopener,noreferrer');
                            }}
                            data-testid="medication-video-link"
                          >
                            <Play size={16} className="mr-2" />
                            Watch Video Instructions
                          </Button>
                        </div>
                      )}
                      */}

                      {/* Reference */}
                      {selectedMedicationInfo.reference && (
                        <div className="text-xs text-muted-foreground italic">
                          Reference: {selectedMedicationInfo.reference}
                        </div>
                      )}

                      {/* Important Note */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-xs text-amber-900">
                          <strong>Important:</strong> Always follow your doctor's specific instructions.
                          If you experience severe side effects or have concerns, contact your clinic immediately.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Create Medication Info Dialog */}
            <Dialog open={showCreateMedicationInfo} onOpenChange={setShowCreateMedicationInfo}>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Medication Information</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Add information for "{newMedicationInfo.name || "this medication"}" to help other users.
                  </p>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <Label>Medication Name *</Label>
                    <Input
                      value={newMedicationInfo.name}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Gonal-F"
                    />
                  </div>

                  <div>
                    <Label>Generic Name *</Label>
                    <Input
                      value={newMedicationInfo.generic}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, generic: e.target.value }))}
                      placeholder="e.g., Follitropin alfa"
                    />
                  </div>

                  <div>
                    <Label>Class *</Label>
                    <Input
                      value={newMedicationInfo.class}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, class: e.target.value }))}
                      placeholder="e.g., Recombinant FSH"
                    />
                  </div>

                  <div>
                    <Label>Purpose *</Label>
                    <Textarea
                      value={newMedicationInfo.purpose}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, purpose: e.target.value }))}
                      placeholder="What is this medication used for?"
                    />
                  </div>

                  <div>
                    <Label>Route *</Label>
                    <Input
                      value={newMedicationInfo.route}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, route: e.target.value }))}
                      placeholder="e.g., Subcutaneous injection (pen)"
                    />
                  </div>

                  <div>
                    <Label>Timing/Dosing *</Label>
                    <Textarea
                      value={newMedicationInfo.timing}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, timing: e.target.value }))}
                      placeholder="e.g., Daily doses (e.g., 75–300 IU) from stimulation start"
                    />
                  </div>

                  <div>
                    <Label>Common Side Effects (one per line)</Label>
                    <Textarea
                      value={newMedicationInfo.commonSideEffects.join("\n")}
                      onChange={(e) => setNewMedicationInfo(prev => ({
                        ...prev,
                        commonSideEffects: e.target.value.split("\n").filter(s => s.trim())
                      }))}
                      placeholder="Bloating&#10;Breast tenderness&#10;Injection site bruising"
                    />
                  </div>

                  <div>
                    <Label>Serious Side Effects (one per line)</Label>
                    <Textarea
                      value={newMedicationInfo.seriousSideEffects.join("\n")}
                      onChange={(e) => setNewMedicationInfo(prev => ({
                        ...prev,
                        seriousSideEffects: e.target.value.split("\n").filter(s => s.trim())
                      }))}
                      placeholder="OHSS (abdominal pain, rapid weight gain, breathlessness)&#10;Allergic reaction"
                    />
                  </div>

                  <div>
                    <Label>Monitoring Notes</Label>
                    <Textarea
                      value={newMedicationInfo.monitoringNotes}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, monitoringNotes: e.target.value }))}
                      placeholder="What should be monitored while taking this medication?"
                    />
                  </div>

                  <div>
                    <Label>Patient Notes</Label>
                    <Textarea
                      value={newMedicationInfo.patientNotes}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, patientNotes: e.target.value }))}
                      placeholder="Helpful tips for patients"
                    />
                  </div>

                  <div>
                    <Label>Reference</Label>
                    <Input
                      value={newMedicationInfo.reference}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, reference: e.target.value }))}
                      placeholder="e.g., TGA product info / clinic leaflets"
                    />
                  </div>

                  <div>
                    <Label>Video Link (optional)</Label>
                    <Input
                      value={newMedicationInfo.videoLink}
                      onChange={(e) => setNewMedicationInfo(prev => ({ ...prev, videoLink: e.target.value }))}
                      placeholder="https://..."
                      type="url"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      className="flex-1"
                      onClick={async () => {
                        if (!newMedicationInfo.name || !newMedicationInfo.generic || !newMedicationInfo.class ||
                          !newMedicationInfo.purpose || !newMedicationInfo.route || !newMedicationInfo.timing) {
                          toast({
                            title: "Missing required fields",
                            description: "Please fill in all required fields (marked with *)",
                            variant: "destructive",
                          });
                          return;
                        }

                        try {
                          const created = await createMedicationInfo(newMedicationInfo);
                          if (created) {
                            toast({
                              title: "Success",
                              description: `Medication information for "${created.name}" has been added.`,
                            });
                            await refetchMedicationInfo();
                            setShowCreateMedicationInfo(false);
                            // Show the newly created medication info
                            const info = await getMedicationInfoById(created.id);
                            if (info) {
                              setSelectedMedicationInfo(info);
                              setShowMedicationInfo(true);
                            }
                            // Reset form
                            setNewMedicationInfo({
                              name: "",
                              generic: "",
                              class: "",
                              purpose: "",
                              route: "",
                              timing: "",
                              commonSideEffects: [],
                              seriousSideEffects: [],
                              monitoringNotes: "",
                              patientNotes: "",
                              reference: "",
                              videoLink: "",
                            });
                          }
                        } catch (error: any) {
                          toast({
                            title: "Error",
                            description: error.message || "Failed to create medication information",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Create
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowCreateMedicationInfo(false);
                        setNewMedicationInfo({
                          name: "",
                          generic: "",
                          class: "",
                          purpose: "",
                          route: "",
                          timing: "",
                          commonSideEffects: [],
                          seriousSideEffects: [],
                          monitoringNotes: "",
                          patientNotes: "",
                          reference: "",
                          videoLink: "",
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Medication Details Dialog */}
            <Dialog open={!!selectedMedication} onOpenChange={() => setSelectedMedication("")}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    {selectedMedication === "Custom" ? "Add Custom Medication" : `Add ${selectedMedication}`}
                  </DialogTitle>
                  <div className="sr-only">Configure medication dosage, timing, and reminder settings</div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {selectedMedication === "Custom" && (
                    <div>
                      <Label className="text-sm font-medium text-foreground">
                        Medication Name
                      </Label>
                      <Input
                        placeholder="Enter medication name"
                        value={medicationName}
                        onChange={(e) => setMedicationName(e.target.value)}
                        className="mt-1"
                        data-testid="custom-medication-name"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Dosage & Instructions
                    </Label>
                    <Input
                      placeholder="e.g., 75 IU, 1 tablet, 0.25mg"
                      value={medicationDosage}
                      onChange={(e) => setMedicationDosage(e.target.value)}
                      className="mt-1"
                      data-testid="medication-dosage"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Time to Take
                    </Label>
                    <Input
                      type="time"
                      value={medicationTime}
                      onChange={(e) => setMedicationTime(e.target.value)}
                      className="mt-1"
                      data-testid="medication-time"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Frequency
                    </Label>
                    <Select value={medicationFrequency} onValueChange={setMedicationFrequency}>
                      <SelectTrigger className="mt-1" data-testid="medication-frequency">
                        <SelectValue placeholder="How often?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">One-off dose</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="twice-daily">Twice daily</SelectItem>
                        <SelectItem value="three-times">Three times daily</SelectItem>
                        <SelectItem value="every-other-day">Every other day</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="as-needed">As needed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Start Date
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal mt-1"
                          data-testid="medication-start-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {medicationStartDate.toLocaleDateString()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={medicationStartDate}
                          onSelect={(date) => date && setMedicationStartDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="medication-reminder"
                      checked={medicationReminder}
                      onChange={(e) => setMedicationReminder(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                      data-testid="medication-reminder-checkbox"
                    />
                    <Label htmlFor="medication-reminder" className="text-sm font-medium text-foreground">
                      Set reminder notifications
                    </Label>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      className="flex-1 text-xs sm:text-sm px-3"
                      disabled={!medicationDosage || !medicationTime || !medicationFrequency || addMedicationMutation.isPending}
                      onClick={handleAddMedication}
                      data-testid="save-medication"
                    >
                      {addMedicationMutation.isPending ? "Adding..." : "Add"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-xs sm:text-sm px-3"
                      onClick={() => {
                        setSelectedMedication("");
                        setMedicationDosage("");
                        setMedicationTime("");
                        setMedicationFrequency("");
                        setMedicationReminder(false);
                      }}
                      data-testid="cancel-medication"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Log Dose Dialog */}
            <Dialog open={showLogDose} onOpenChange={setShowLogDose}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    Log Medication Dose
                  </DialogTitle>
                  <div className="sr-only">Record that you have taken a medication dose</div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {loggingMedication && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground">
                        Logging dose for:
                      </p>
                      <p className="font-medium text-foreground">{loggingMedication.name}</p>
                      <p className="text-sm text-muted-foreground">{loggingMedication.dosage}</p>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Date Taken <span className="text-destructive">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal mt-1"
                          data-testid="log-dose-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {logDoseDate.toLocaleDateString()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={logDoseDate}
                          onSelect={(date) => date && setLogDoseDate(date)}
                          disabled={(date) => {
                            // Disable future dates
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const checkDate = new Date(date);
                            checkDate.setHours(0, 0, 0, 0);
                            return checkDate > today;
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select the date when you took this dose
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Notes (optional)
                    </Label>
                    <Textarea
                      placeholder="Add any notes about this dose..."
                      value={logDoseNotes}
                      onChange={(e) => setLogDoseNotes(e.target.value)}
                      className="mt-1"
                      rows={3}
                      data-testid="log-dose-notes"
                    />
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button
                      className="flex-1"
                      onClick={handleLogDose}
                      disabled={logDoseMutation.isPending}
                      data-testid="confirm-log-dose"
                    >
                      {logDoseMutation.isPending ? "Logging..." : "Log Dose"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowLogDose(false);
                        setLoggingMedication(null);
                        setLogDoseNotes("");
                        setLogDoseDate(new Date());
                      }}
                      data-testid="cancel-log-dose"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* End Medication Dialog */}
            <Dialog open={showEndMedication} onOpenChange={setShowEndMedication}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    End Medication
                  </DialogTitle>
                  <div className="sr-only">Set an end date for this medication</div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {endingMedication && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground">
                        Setting end date for:
                      </p>
                      <p className="font-medium text-foreground">{endingMedication.name}</p>
                      <p className="text-sm text-muted-foreground">{endingMedication.dosage}</p>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      End Date <span className="text-destructive">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal mt-1"
                          data-testid="medication-end-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {medicationEndDate.toLocaleDateString()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={medicationEndDate}
                          onSelect={(date) => {
                            if (date && endingMedication) {
                              // Get medication start date (startDate is always a string from API)
                              const startDateStr = String(endingMedication.startDate || '');
                              const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;

                              // Get today's date (start of day)
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);

                              // Get selected end date (start of day)
                              const endDate = new Date(date);
                              endDate.setHours(0, 0, 0, 0);

                              // Determine minimum allowed date (start date or today, whichever is later)
                              if (startDate) {
                                const minDate = startDate > today ? startDate : today;
                                if (endDate < minDate) {
                                  toast({
                                    title: "Invalid date",
                                    description: `End date must be on or after ${minDate.toLocaleDateString('en-AU')}.`,
                                    variant: "destructive",
                                  });
                                  return;
                                }
                              } else if (endDate < today) {
                                toast({
                                  title: "Invalid date",
                                  description: `End date cannot be before today.`,
                                  variant: "destructive",
                                });
                                return;
                              }

                              setMedicationEndDate(date);
                            }
                          }}
                          disabled={(date) => {
                            if (!endingMedication) return false;

                            // Get medication start date (startDate is always a string from API)
                            const startDateStr = String(endingMedication.startDate || '');
                            const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;

                            // Get today's date (start of day)
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);

                            // Get date to check (start of day)
                            const checkDate = new Date(date);
                            checkDate.setHours(0, 0, 0, 0);

                            // Disable dates before start date or before today (whichever is later)
                            if (startDate) {
                              const minDate = startDate > today ? startDate : today;
                              return checkDate < minDate;
                            }

                            // If no start date, just disable dates before today
                            return checkDate < today;
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {endingMedication && (() => {
                      // Get medication start date (startDate is always a string from API)
                      const startDateStr = String(endingMedication.startDate || '');
                      const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const minDate = startDate && startDate > today ? startDate : today;
                      return (
                        <p className="text-xs text-muted-foreground mt-1">
                          End date must be on or after {minDate.toLocaleDateString('en-AU')}
                        </p>
                      );
                    })()}
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button
                      className="flex-1"
                      onClick={handleEndMedication}
                      disabled={endMedicationMutation.isPending}
                      data-testid="confirm-end-medication"
                    >
                      {endMedicationMutation.isPending ? "Saving..." : "Set End Date"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowEndMedication(false);
                        setEndingMedication(null);
                      }}
                      data-testid="cancel-end-medication"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Symptoms Tab */}
          <TabsContent value="symptoms" className="mt-6 space-y-3">
            <Card className="rounded-2xl p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <Activity className="text-stone-600" size={24} />
                <h3 className="font-semibold text-foreground" data-testid="symptoms-title">
                  Log Symptoms
                </h3>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="symptom-select" className="text-sm font-medium text-foreground">
                      Select Symptom
                    </Label>
                    <Select value={selectedSymptom} onValueChange={(value) => {
                      setSelectedSymptom(value);
                      setSymptomSeverity("");
                      setSymptomDuration("");
                    }}>
                      <SelectTrigger className="mt-1" data-testid="select-symptom">
                        <SelectValue placeholder="Choose a symptom to track" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cramping">Cramping</SelectItem>
                        <SelectItem value="bloating">Bloating</SelectItem>
                        <SelectItem value="fatigue">Fatigue</SelectItem>
                        <SelectItem value="nausea">Nausea</SelectItem>
                        <SelectItem value="breast-tenderness">Breast Tenderness</SelectItem>
                        <SelectItem value="headaches">Headaches</SelectItem>
                        <SelectItem value="mood-swings">Mood Swings</SelectItem>
                        <SelectItem value="anxiety">Anxiety</SelectItem>
                        <SelectItem value="hot-flashes">Hot Flashes</SelectItem>
                        <SelectItem value="spotting">Spotting</SelectItem>
                        <SelectItem value="discharge">Vaginal Discharge</SelectItem>
                        <SelectItem value="sleep-issues">Sleep Issues</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Date
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full mt-1 justify-start text-left font-normal"
                          data-testid="symptom-date-picker"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {symptomDate ? symptomDate.toLocaleDateString('en-AU') : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={symptomDate}
                          onSelect={(date) => date && setSymptomDate(date)}
                          initialFocus
                          weekStartsOn={1}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {selectedSymptom && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="severity-select" className="text-sm font-medium text-foreground">
                        Severity Level
                      </Label>
                      <Select value={symptomSeverity} onValueChange={setSymptomSeverity}>
                        <SelectTrigger className="mt-1" data-testid="select-severity">
                          <SelectValue placeholder="Rate severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mild">Mild</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="severe">Severe</SelectItem>
                          <SelectItem value="very-severe">Very Severe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(selectedSymptom === "cramping" || selectedSymptom === "headaches" || selectedSymptom === "anxiety") && (
                      <div>
                        <Label htmlFor="duration-select" className="text-sm font-medium text-foreground">
                          Duration
                        </Label>
                        <Select value={symptomDuration} onValueChange={setSymptomDuration}>
                          <SelectTrigger className="mt-1" data-testid="select-duration">
                            <SelectValue placeholder="How long did it last?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="few-minutes">A few minutes</SelectItem>
                            <SelectItem value="30-minutes">30 minutes</SelectItem>
                            <SelectItem value="1-hour">1 hour</SelectItem>
                            <SelectItem value="few-hours">A few hours</SelectItem>
                            <SelectItem value="half-day">Half day</SelectItem>
                            <SelectItem value="all-day">All day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(selectedSymptom === "discharge" || selectedSymptom === "spotting") && (
                      <div>
                        <Label htmlFor="appearance-select" className="text-sm font-medium text-foreground">
                          Appearance
                        </Label>
                        <Select value={symptomDuration} onValueChange={setSymptomDuration}>
                          <SelectTrigger className="mt-1" data-testid="select-appearance">
                            <SelectValue placeholder="Describe appearance" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedSymptom === "discharge" ? (
                              <>
                                <SelectItem value="clear">Clear</SelectItem>
                                <SelectItem value="white">White</SelectItem>
                                <SelectItem value="yellow">Yellow</SelectItem>
                                <SelectItem value="brown">Brown</SelectItem>
                                <SelectItem value="green">Green</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="light-pink">Light Pink</SelectItem>
                                <SelectItem value="brown">Brown</SelectItem>
                                <SelectItem value="red">Red</SelectItem>
                                <SelectItem value="dark-red">Dark Red</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="symptom-notes" className="text-sm font-medium text-foreground">
                    Notes
                  </Label>
                  <Textarea
                    id="symptom-notes"
                    placeholder="Any additional details about this symptom..."
                    className="mt-1"
                    rows={3}
                    value={symptomNotes}
                    onChange={(e) => setSymptomNotes(e.target.value)}
                    data-testid="textarea-symptom-notes"
                  />
                </div>

                <Button
                  className="w-full"
                  data-testid="button-save-symptoms"
                  disabled={!selectedSymptom || !symptomSeverity || saveSymptomMutation.isPending}
                  onClick={handleSaveSymptom}
                >
                  {saveSymptomMutation.isPending ? "Logging..." : "Log Symptom"}
                </Button>
              </div>
            </Card>

            {/* Display Logged Symptoms */}
            {loggedSymptoms.length > 0 && (
              <Card className="rounded-2xl p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <Activity className="text-stone-600" size={24} />
                  <h3 className="font-semibold text-foreground" data-testid="logged-symptoms-title">
                    Logged Symptoms
                  </h3>
                </div>

                <div className="space-y-3">
                  {loggedSymptoms.map((symptom) => {
                    // Get all symptoms from schema fields (primary source)
                    const allSymptoms: Array<{ name: string, severity: string, value: number, duration?: string }> = [];

                    // Add symptoms from schema fields - check ALL fields
                    if (symptom.bloating !== null && symptom.bloating !== undefined) {
                      allSymptoms.push({
                        name: 'Bloating',
                        severity: getSeverityText(symptom.bloating),
                        value: symptom.bloating
                      });
                    }
                    if (symptom.fatigue !== null && symptom.fatigue !== undefined) {
                      allSymptoms.push({
                        name: 'Fatigue',
                        severity: getSeverityText(symptom.fatigue),
                        value: symptom.fatigue
                      });
                    }
                    if (symptom.nausea !== null && symptom.nausea !== undefined) {
                      allSymptoms.push({
                        name: 'Nausea',
                        severity: getSeverityText(symptom.nausea),
                        value: symptom.nausea
                      });
                    }
                    if (symptom.headache !== null && symptom.headache !== undefined) {
                      allSymptoms.push({
                        name: 'Headache',
                        severity: getSeverityText(symptom.headache),
                        value: symptom.headache
                      });
                    }
                    if (symptom.moodSwings !== null && symptom.moodSwings !== undefined) {
                      allSymptoms.push({
                        name: 'Mood Swings',
                        severity: getSeverityText(symptom.moodSwings),
                        value: symptom.moodSwings
                      });
                    }

                    // Debug logging
                    console.log("[Display] Symptom record:", {
                      id: symptom.id,
                      date: symptom.date,
                      bloating: symptom.bloating,
                      fatigue: symptom.fatigue,
                      nausea: symptom.nausea,
                      headache: symptom.headache,
                      moodSwings: symptom.moodSwings,
                      allSymptomsCount: allSymptoms.length
                    });

                    // Parse symptoms from notes (for symptoms that don't map to schema fields)
                    const notesLines = symptom.notes?.split('\n\n') || [];
                    const symptomInfos = notesLines.filter(line => line.includes('Symptom:'));
                    const userNotes = notesLines.filter(line => !line.includes('Symptom:')).join('\n\n') || '';

                    // Get existing symptom names from schema fields
                    const existingNames = allSymptoms.map(s => s.name.toLowerCase());

                    // Parse symptoms from notes and add if not already in schema fields
                    symptomInfos.forEach(info => {
                      const symptomMatch = info.match(/Symptom:\s*(.+?)\s*\|/);
                      const severityMatch = info.match(/Severity:\s*(.+?)(?:\s*\||$)/);
                      const durationMatch = info.match(/Duration:\s*(.+?)(?:\s*\||$)/) || info.match(/Appearance:\s*(.+?)(?:\s*\||$)/);

                      if (symptomMatch && severityMatch) {
                        const symptomName = symptomMatch[1];
                        const severity = severityMatch[1];
                        const duration = durationMatch ? durationMatch[1] : undefined;

                        // Only add if not already in schema fields
                        const nameLower = symptomName.toLowerCase();
                        const isInSchema = existingNames.some(n =>
                          (nameLower.includes('bloating') && n.includes('bloating')) ||
                          (nameLower.includes('fatigue') && n.includes('fatigue')) ||
                          (nameLower.includes('nausea') && n.includes('nausea')) ||
                          (nameLower.includes('headache') && n.includes('headache')) ||
                          (nameLower.includes('mood') && n.includes('mood'))
                        );

                        if (!isInSchema) {
                          allSymptoms.push({
                            name: symptomName,
                            severity: severity,
                            value: 0, // Not in schema fields
                            duration: duration
                          });
                        }
                      }
                    });

                    // Remove duplicates by name (case-insensitive)
                    const uniqueSymptoms = allSymptoms.filter((s, index, self) =>
                      index === self.findIndex(t => t.name.toLowerCase() === s.name.toLowerCase())
                    );

                    return (
                      <div
                        key={symptom.id}
                        className="p-4 border border-border rounded-lg bg-muted/30"
                        data-testid={`logged-symptom-${symptom.id}`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-end gap-2 mb-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                onClick={() => setEditingSymptom(symptom)}
                                data-testid={`edit-symptom-${symptom.id}`}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setSymptomToDelete(symptom)}
                                data-testid={`delete-symptom-${symptom.id}`}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-white text-sm text-foreground shadow-xs" data-testid={`symptom-date-${symptom.id}`}>
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                <span className="font-medium">
                                  {new Date(symptom.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {uniqueSymptoms.length} {uniqueSymptoms.length === 1 ? 'symptom' : 'symptoms'}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {uniqueSymptoms.map((s, index) => (
                                <div key={index} className="flex items-center gap-3 text-sm">
                                  <span className="font-medium text-foreground">{s.name}</span>
                                  <span className="text-muted-foreground">
                                    {s.severity}
                                  </span>
                                  {s.duration && (
                                    <span className="text-muted-foreground text-xs">
                                      • {s.duration}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        {userNotes && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-sm text-muted-foreground" data-testid={`symptom-notes-${symptom.id}`}>
                              {userNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {loggedSymptoms.length === 0 && (
              <Card className="rounded-2xl p-6 shadow-sm">
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground" data-testid="no-logged-symptoms">
                    No symptoms logged yet. Use the form above to log your symptoms.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Tests Tab */}
          <TabsContent value="events" className="mt-6 space-y-3">
            <Card className="rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <TestTube className="text-stone-600" size={24} />
                  <h3 className="font-semibold text-foreground" data-testid="tests-title">
                    Test Results
                  </h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-add-test"
                  onClick={() => setShowAddTest(!showAddTest)}
                >
                  <Plus size={16} className="mr-2" />
                  Add Test
                </Button>
              </div>

              {showAddTest && (
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5 mb-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <Plus className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-foreground" data-testid="add-test-title">
                      Add New Test
                    </h4>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="test-type-select" className="text-sm font-medium text-foreground">
                          Test Type <span className="text-red-500">*</span>
                        </Label>
                        <Select value={selectedTestType} onValueChange={setSelectedTestType}>
                          <SelectTrigger className="h-11" data-testid="select-test-type">
                            <SelectValue placeholder="Choose test type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="blood-test">Blood test</SelectItem>
                            <SelectItem value="ultrasound">Ultrasound</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Date <span className="text-red-500">*</span>
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-11 justify-start text-left font-normal overflow-hidden"
                              data-testid="test-date-picker"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                              <span className="truncate">
                                {testDate ? testDate.toLocaleDateString('en-AU') : "Pick a date"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={testDate}
                              onSelect={(date) => date && setTestDate(date)}
                              initialFocus
                              weekStartsOn={1}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {selectedTestType === 'ultrasound' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900 mb-1">
                              Ultrasound Information
                            </p>
                            <p className="text-sm text-blue-800">
                              <strong>Ideal thickness: ≥7mm</strong>
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              Your endometrial lining should be at least 7mm thick for optimal embryo transfer success. Track your measurements here.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedTestType && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="test-name" className="text-sm font-medium text-foreground">
                              Test Name
                            </Label>
                            <Input
                              id="test-name"
                              value={testName}
                              onChange={(e) => setTestName(e.target.value)}
                              placeholder="e.g., hCG, Estradiol"
                              className="h-11"
                              data-testid="input-test-name"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="test-value" className="text-sm font-medium text-foreground">
                              Value
                            </Label>
                            <Input
                              id="test-value"
                              value={testValue}
                              onChange={(e) => setTestValue(e.target.value)}
                              placeholder="e.g., 150"
                              className="h-11"
                              data-testid="input-test-value"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="test-unit" className="text-sm font-medium text-foreground">
                              Unit
                            </Label>
                            <Input
                              id="test-unit"
                              value={testUnit}
                              onChange={(e) => setTestUnit(e.target.value)}
                              placeholder="e.g., mIU/mL, pg/mL"
                              className="h-11"
                              data-testid="input-test-unit"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="test-reference" className="text-sm font-medium text-foreground">
                              Reference Range
                            </Label>
                            <Input
                              id="test-reference"
                              value={testReferenceRange}
                              onChange={(e) => setTestReferenceRange(e.target.value)}
                              placeholder="e.g., 0-5 mIU/mL"
                              className="h-11"
                              data-testid="input-test-reference"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="test-notes" className="text-sm font-medium text-foreground">
                            Notes
                          </Label>
                          <Textarea
                            id="test-notes"
                            placeholder={
                              selectedTestType === 'blood-test'
                                ? 'Enter details about your blood test results...'
                                : selectedTestType === 'ultrasound'
                                  ? 'Enter details about your ultrasound findings...'
                                  : 'Enter details about your test results...'
                            }
                            value={testNotes}
                            onChange={(e) => setTestNotes(e.target.value)}
                            className="min-h-[100px] resize-none"
                            rows={4}
                            data-testid="textarea-test-notes"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        className="flex-1 h-11 font-medium"
                        data-testid="button-save-test"
                        disabled={!selectedTestType || saveTestResultMutation.isPending}
                        onClick={handleSaveTest}
                      >
                        {saveTestResultMutation.isPending ? "Saving..." : "Save Test"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-11 font-medium"
                        onClick={() => {
                          setShowAddTest(false);
                          setSelectedTestType("");
                          setTestDate(new Date());
                          setTestNotes("");
                          setTestName("");
                          setTestValue("");
                          setTestUnit("");
                          setTestReferenceRange("");
                        }}
                        data-testid="button-cancel-test"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {testResults.length === 0 ? (
                  <div className="bg-muted/40 border border-border rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground" data-testid="no-test-results">
                      No test results recorded yet. Add any appointments or results to see them listed here.
                    </p>
                  </div>
                ) : (
                  testResults.map((test: any) => (
                    <Card key={test.id} className="p-4 overflow-hidden">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-medium text-foreground break-words">
                              {formatTestName(test.name)}
                            </h5>
                            {test.name === 'endometrial_thickness' && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                Ideal: ≥7mm
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 break-words whitespace-normal">
                            Date: {new Date(test.date).toLocaleDateString('en-AU')}
                          </p>
                          {test.value && (
                            <p className="text-sm text-foreground mt-1">
                              {test.name === 'endometrial_thickness' ? 'Thickness: ' : 'Value: '}
                              {test.value} {test.unit ? test.unit : ''}
                            </p>
                          )}
                          {test.referenceRange && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Reference: {test.referenceRange}
                            </p>
                          )}
                          {test.notes && (
                            <p className="text-sm text-muted-foreground mt-2">{test.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => setEditingTestResult(test)}
                            data-testid={`button-edit-test-${test.id}`}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setTestToDelete(test)}
                            data-testid={`button-delete-test-${test.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>

            {/* Edit Test Result Dialog */}
            {editingTestResult && (
              <Dialog open={!!editingTestResult} onOpenChange={(open) => {
                if (!open && !updateTestResultMutation.isPending) {
                  setEditingTestResult(null);
                  setEditTestType("");
                  setEditTestDate(new Date());
                  setEditTestNotes("");
                  setEditTestName("");
                  setEditTestValue("");
                  setEditTestUnit("");
                  setEditTestReferenceRange("");
                }
              }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Test Result</DialogTitle>
                    <DialogDescription>
                      Update the details of your test result
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-test-type" className="text-sm font-medium text-foreground">
                          Test Type <span className="text-red-500">*</span>
                        </Label>
                        <Select value={editTestType} onValueChange={setEditTestType}>
                          <SelectTrigger className="h-11" data-testid="select-edit-test-type">
                            <SelectValue placeholder="Choose test type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="blood-test">Blood test</SelectItem>
                            <SelectItem value="ultrasound">Ultrasound</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Date <span className="text-red-500">*</span>
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-11 justify-start text-left font-normal overflow-hidden"
                              data-testid="edit-test-date-picker"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                              <span className="truncate">
                                {editTestDate ? editTestDate.toLocaleDateString('en-AU') : "Pick a date"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={editTestDate}
                              onSelect={(date) => date && setEditTestDate(date)}
                              initialFocus
                              weekStartsOn={1}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {editTestType === 'ultrasound' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900 mb-1">
                              Ultrasound Information
                            </p>
                            <p className="text-sm text-blue-800">
                              <strong>Ideal thickness: ≥7mm</strong>
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              Your endometrial lining should be at least 7mm thick for optimal embryo transfer success. Track your measurements here.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-test-name" className="text-sm font-medium text-foreground">
                          Test Name
                        </Label>
                        <Input
                          id="edit-test-name"
                          value={editTestName}
                          onChange={(e) => setEditTestName(e.target.value)}
                          placeholder="e.g., hCG, Estradiol"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-test-value" className="text-sm font-medium text-foreground">
                          Value
                        </Label>
                        <Input
                          id="edit-test-value"
                          value={editTestValue}
                          onChange={(e) => setEditTestValue(e.target.value)}
                          placeholder="e.g., 150"
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-test-unit" className="text-sm font-medium text-foreground">
                          Unit
                        </Label>
                        <Input
                          id="edit-test-unit"
                          value={editTestUnit}
                          onChange={(e) => setEditTestUnit(e.target.value)}
                          placeholder="e.g., mIU/mL, pg/mL"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-test-reference" className="text-sm font-medium text-foreground">
                          Reference Range
                        </Label>
                        <Input
                          id="edit-test-reference"
                          value={editTestReferenceRange}
                          onChange={(e) => setEditTestReferenceRange(e.target.value)}
                          placeholder="e.g., 0-5 mIU/mL"
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-test-notes" className="text-sm font-medium text-foreground">
                        Notes {editTestType === 'lining-scan' && <span className="text-muted-foreground font-normal text-xs">(include thickness measurement in mm)</span>}
                      </Label>
                      <Textarea
                        id="edit-test-notes"
                        value={editTestNotes}
                        onChange={(e) => setEditTestNotes(e.target.value)}
                        placeholder={
                          editTestType === 'blood-test'
                            ? 'Enter details about your blood test results...'
                            : editTestType === 'ultrasound'
                              ? 'Enter details about your ultrasound findings...'
                              : 'Enter details about your test results...'
                        }
                        className="min-h-[100px] resize-none"
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        className="flex-1 h-11 font-medium"
                        data-testid="button-update-test"
                        disabled={!editTestType || updateTestResultMutation.isPending}
                        onClick={handleUpdateTestResult}
                      >
                        {updateTestResultMutation.isPending ? "Updating..." : "Update Test Result"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-11 font-medium"
                        onClick={() => {
                          setEditingTestResult(null);
                          setEditTestType("");
                          setEditTestDate(new Date());
                          setEditTestNotes("");
                          setEditTestName("");
                          setEditTestValue("");
                          setEditTestUnit("");
                          setEditTestReferenceRange("");
                        }}
                        disabled={updateTestResultMutation.isPending}
                        data-testid="button-cancel-edit-test"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Upcoming Events Section */}
            <Card className="rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="text-stone-600" size={24} />
                  <h3 className="font-semibold text-foreground" data-testid="upcoming-events-title">
                    Upcoming Events
                  </h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-add-event"
                  onClick={() => setShowAddEvent(!showAddEvent)}
                >
                  <Plus size={16} className="mr-2" />
                  Add Event
                </Button>
              </div>

              {showAddEvent && (
                <div className="border border-border rounded-xl p-4 mb-6">
                  <h4 className="font-medium text-foreground mb-4" data-testid="add-event-title">
                    Add New Event
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-foreground">
                        Event Type
                      </Label>
                      <Select value={eventType} onValueChange={setEventType} disabled={isLoadingEventTypes || eventTypes.length === 0}>
                        <SelectTrigger className="mt-1" data-testid="select-event-type">
                          <SelectValue placeholder={isLoadingEventTypes ? "Loading..." : eventTypes.length === 0 ? "No event types available" : "Select event type"} />
                        </SelectTrigger>
                        <SelectContent>
                          {eventTypes.map((type: any) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {eventTypesError && (
                        <p className="text-xs text-destructive mt-1">Failed to load event types. Please refresh.</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="event-title" className="text-sm font-medium text-foreground">
                        Event Title
                      </Label>
                      <Input
                        id="event-title"
                        placeholder="e.g., Blood Test, Ultrasound, Doctor Appointment"
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        className="mt-1"
                        data-testid="input-event-title"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-foreground">
                          Date
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full mt-1 justify-start text-left font-normal overflow-hidden"
                              data-testid="event-date-picker"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                              <span className="truncate">
                                {eventDate ? eventDate.toLocaleDateString('en-AU') : "Pick a date"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={eventDate}
                              onSelect={(date) => date && setEventDate(date)}
                              initialFocus
                              weekStartsOn={1}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label htmlFor="event-time" className="text-sm font-medium text-foreground">
                          Time
                        </Label>
                        <Input
                          id="event-time"
                          type="time"
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          className="mt-1"
                          data-testid="input-event-time"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="event-location" className="text-sm font-medium text-foreground">
                        Location
                      </Label>
                      <Input
                        id="event-location"
                        placeholder="e.g., Clinic name, Hospital, Lab"
                        value={eventLocation}
                        onChange={(e) => setEventLocation(e.target.value)}
                        className="mt-1"
                        data-testid="input-event-location"
                      />
                    </div>

                    <div>
                      <Label htmlFor="event-notes" className="text-sm font-medium text-foreground">
                        Notes (optional)
                      </Label>
                      <Textarea
                        id="event-notes"
                        placeholder="Any additional details about this event..."
                        value={eventNotes}
                        onChange={(e) => setEventNotes(e.target.value)}
                        className="mt-1"
                        rows={3}
                        data-testid="textarea-event-notes"
                      />
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        className="flex-1"
                        data-testid="button-save-event"
                        disabled={!eventTitle || !eventDate || !eventTime || (editingEvent ? updateEventMutation.isPending : false)}
                        onClick={async () => {
                          if (editingEvent) {
                            // Update existing event
                            updateEventMutation.mutate({
                              id: editingEvent.id,
                              data: {
                                title: eventTitle,
                                eventType,
                                date: eventDate,
                                time: eventTime,
                                location: eventLocation,
                                personalNotes: eventNotes,
                              },
                            });
                          } else {
                            // Create new event
                            const success = await createEventRecord({
                              title: eventTitle,
                              eventType,
                              date: eventDate,
                              time: eventTime,
                              location: eventLocation,
                              notes: eventNotes,
                            });

                            if (success) {
                              setShowAddEvent(false);
                              setEventType("general_note");
                              setEventTitle("");
                              setEventDate(new Date());
                              setEventTime("");
                              setEventLocation("");
                              setEventNotes("");
                            }
                          }
                        }}
                      >
                        {editingEvent ? (updateEventMutation.isPending ? "Updating..." : "Update Event") : "Save Event"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowAddEvent(false);
                          setEditingEvent(null);
                          setEventType("general_note");
                          setEventTitle("");
                          setEventDate(new Date());
                          setEventTime("");
                          setEventLocation("");
                          setEventNotes("");
                        }}
                        disabled={editingEvent ? updateEventMutation.isPending : false}
                        data-testid="button-cancel-event"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Upcoming Events List */}
              {events.length === 0 ? (
                <div className="bg-muted/40 border border-border rounded-lg p-4">
                  <div className="flex flex-col items-center text-center">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="no-upcoming-events">
                      No upcoming events scheduled. Add your appointments and important dates to stay organized.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {events
                    .filter(event => {
                      // Show upcoming events (today or future)
                      const eventDate = new Date(event.date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      eventDate.setHours(0, 0, 0, 0);
                      return eventDate >= today;
                    })
                    .sort((a, b) => {
                      // Sort by date, earliest first
                      return new Date(a.date).getTime() - new Date(b.date).getTime();
                    })
                    .map((event) => {
                      const eventDate = new Date(event.date);
                      return (
                        <div key={event.id} className="border border-border rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium text-foreground" data-testid={`event-title-${event.id}`}>
                                  {event.title}
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => {
                                    setEditingEvent(event);
                                    setShowAddEvent(true);
                                  }}
                                  data-testid={`edit-event-${event.id}`}
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setEventToDelete(event)}
                                  data-testid={`delete-event-${event.id}`}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <CalendarIcon size={14} />
                                  <span data-testid={`event-date-${event.id}`}>
                                    {eventDate.toLocaleDateString('en-AU')}
                                  </span>
                                </div>
                                {event.time && (
                                  <div className="flex items-center gap-1">
                                    <Clock size={14} />
                                    <span data-testid={`event-time-${event.id}`}>
                                      {event.time}
                                    </span>
                                  </div>
                                )}
                                {event.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin size={14} />
                                    <span data-testid={`event-location-${event.id}`}>
                                      {event.location}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {event.personalNotes && (
                                <p className="text-sm text-muted-foreground mt-2" data-testid={`event-notes-${event.id}`}>
                                  {event.personalNotes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Cycle Summary Dialog - Moved outside tabs to ensure it always renders */}
      <Dialog open={!!summaryCycle} onOpenChange={(open) => {
        if (!open) {
          handleCloseSummary();
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {summaryCycle ? `${summaryCycle.type.toUpperCase()} cycle summary` : "Cycle summary"}
            </DialogTitle>
            <DialogDescription>
              Download, share, or review everything logged during this treatment cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => handleDownloadSummary("pdf")}
              disabled={downloadingFormat === "pdf" || !summaryCycle}
            >
              <Download size={14} className="mr-1" />
              {downloadingFormat === "pdf" ? "Preparing..." : "Download PDF"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownloadSummary("csv")}
              disabled={downloadingFormat === "csv" || !summaryCycle}
            >
              {downloadingFormat === "csv" ? "Preparing..." : "Export CSV"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCopySummaryLink()}
              disabled={!summaryCycle}
            >
              <Copy size={14} className="mr-1" />
              Copy share link
            </Button>
          </div>

          <ScrollArea className="max-h-[60vh] pr-4">
            {summaryLoading && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Gathering your cycle data...
              </div>
            )}
            {!summaryLoading && summaryError && (
              <EmptySummaryState message="Unable to load summary. Please try again." />
            )}
            {!summaryLoading && !summaryError && cycleSummaryData && (
              <div className="space-y-6">
                <SummarySection title="Cycle Overview">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Cycle type", value: cycleSummaryData.cycle.type?.toUpperCase() || "-" },
                      { label: "Status", value: toSentenceCase(cycleSummaryData.cycle.status) },
                      { label: "Result", value: cycleSummaryData.cycle.result ? toSentenceCase(cycleSummaryData.cycle.result) : "-" },
                      { label: "Start date", value: formatDisplayDate(cycleSummaryData.cycle.startDate) },
                      { label: "End date", value: cycleSummaryData.cycle.endDate ? formatDisplayDate(cycleSummaryData.cycle.endDate) : "Ongoing" },
                      { label: "Clinic", value: cycleSummaryData.cycle.clinic || "-" },
                      { label: "Doctor", value: cycleSummaryData.cycle.doctor || "-" },
                    ].map((item) => (
                      <div key={item.label} className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs uppercase text-muted-foreground tracking-wide">{item.label}</p>
                        <p className="text-sm font-medium text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {cycleSummaryData.cycle.notes && (
                    <p className="text-sm text-muted-foreground mt-3">
                      <strong>Notes:</strong> {cycleSummaryData.cycle.notes}
                    </p>
                  )}
                </SummarySection>

                <SummarySection title="Treatment Milestones">
                  {cycleSummaryData.milestones.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Milestone</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cycleSummaryData.milestones.map((milestone) => (
                          <TableRow key={milestone.id}>
                            <TableCell className="font-medium">
                              {formatMilestoneTitle(milestone.title)}
                            </TableCell>
                            <TableCell>{formatDisplayDate(milestone.date)}</TableCell>
                            <TableCell>{toSentenceCase(milestone.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptySummaryState message="No milestones recorded" />
                  )}
                </SummarySection>

                <SummarySection title="Medications">
                  {cycleSummaryData.medications.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medication</TableHead>
                          <TableHead>Dosage</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cycleSummaryData.medications.map((medication) => (
                          <TableRow key={medication.id}>
                            <TableCell className="font-medium">{medication.name}</TableCell>
                            <TableCell>{medication.dosage}</TableCell>
                            <TableCell>{medication.frequency}</TableCell>
                            <TableCell>{medication.time || "-"}</TableCell>
                            <TableCell>{formatDisplayDate(medication.startDate)}</TableCell>
                            <TableCell>{medication.endDate ? formatDisplayDate(medication.endDate) : "Ongoing"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => setEditingMedication(medication)}
                                  data-testid={`edit-medication-summary-${medication.id}`}
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setMedicationToDelete(medication)}
                                  data-testid={`delete-medication-summary-${medication.id}`}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptySummaryState message="No medications recorded" />
                  )}
                </SummarySection>

                <SummarySection title="Test Results">
                  {cycleSummaryData.testResults.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cycleSummaryData.testResults.map((test) => (
                          <TableRow key={test.id}>
                            <TableCell className="break-words whitespace-normal max-w-[120px]">{formatDisplayDate(test.date)}</TableCell>
                            <TableCell className="break-words whitespace-normal">{formatTestName(test.type)}</TableCell>
                            <TableCell className="font-medium break-words whitespace-normal">{formatTestName(test.name)}</TableCell>
                            <TableCell className="break-words whitespace-normal">{test.value ? `${test.value}${test.unit ? ` ${test.unit}` : ""}` : "-"}</TableCell>
                            <TableCell className="break-words whitespace-normal">{test.referenceRange || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptySummaryState message="No test results recorded" />
                  )}
                </SummarySection>

                <SummarySection title="Symptoms Log">
                  {cycleSummaryData.symptoms.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Mood</TableHead>
                          <TableHead>Bloating</TableHead>
                          <TableHead>Fatigue</TableHead>
                          <TableHead>Nausea</TableHead>
                          <TableHead>Headache</TableHead>
                          <TableHead>Mood Swings</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cycleSummaryData.symptoms.map((symptom) => (
                          <TableRow key={symptom.id}>
                            <TableCell>{formatDisplayDate(symptom.date)}</TableCell>
                            <TableCell>{symptom.mood || "-"}</TableCell>
                            <TableCell>{symptom.bloating ? "Yes" : "-"}</TableCell>
                            <TableCell>{symptom.fatigue ? "Yes" : "-"}</TableCell>
                            <TableCell>{symptom.nausea ? "Yes" : "-"}</TableCell>
                            <TableCell>{symptom.headache ? "Yes" : "-"}</TableCell>
                            <TableCell>{symptom.moodSwings ? "Yes" : "-"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => setEditingSymptom(symptom)}
                                  data-testid={`edit-symptom-summary-${symptom.id}`}
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setSymptomToDelete(symptom)}
                                  data-testid={`delete-symptom-summary-${symptom.id}`}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptySummaryState message="No symptoms recorded" />
                  )}
                </SummarySection>

                <SummarySection title="Appointments">
                  {cycleSummaryData.appointments.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Doctor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cycleSummaryData.appointments.map((appointment) => (
                          <TableRow key={appointment.id}>
                            <TableCell>{formatDisplayDateTime(appointment.date)}</TableCell>
                            <TableCell>{appointment.type}</TableCell>
                            <TableCell className="font-medium">{appointment.title}</TableCell>
                            <TableCell>{appointment.location || "-"}</TableCell>
                            <TableCell>{appointment.doctorName || "-"}</TableCell>
                            <TableCell>{appointment.completed ? "Completed" : "Scheduled"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => setEditingAppointment(appointment)}
                                  data-testid={`edit-appointment-${appointment.id}`}
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setAppointmentToDelete(appointment)}
                                  data-testid={`delete-appointment-${appointment.id}`}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptySummaryState message="No appointments recorded" />
                  )}
                </SummarySection>

                <SummarySection title="Events & Notes">
                  {cycleSummaryData.events.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Phase</TableHead>
                          <TableHead>Outcome</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cycleSummaryData.events.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>{formatDisplayDate(event.date)}</TableCell>
                            <TableCell>{event.eventType}</TableCell>
                            <TableCell className="font-medium">{event.title}</TableCell>
                            <TableCell>{event.phase || "-"}</TableCell>
                            <TableCell>{event.outcome ? toSentenceCase(event.outcome) : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptySummaryState message="No events recorded" />
                  )}
                </SummarySection>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Symptom Dialog */}
      <Dialog open={!!editingSymptom} onOpenChange={(open) => {
        if (!open && !updateSymptomMutation.isPending) {
          setEditingSymptom(null);
          setEditSymptomType("");
          setEditSymptomSeverity("");
          setEditSymptomDuration("");
          setEditSymptomNotes("");
          setEditSymptomDate(new Date());
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Symptom</DialogTitle>
            <DialogDescription>
              Update the symptom details below.
            </DialogDescription>
          </DialogHeader>
          {editingSymptom && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-symptom-select" className="text-sm font-medium text-foreground">
                    Select Symptom
                  </Label>
                  <Select value={editSymptomType} onValueChange={(value) => {
                    setEditSymptomType(value);
                    setEditSymptomDuration("");
                  }}>
                    <SelectTrigger className="mt-1" data-testid="edit-select-symptom">
                      <SelectValue placeholder="Choose a symptom to track" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cramping">Cramping</SelectItem>
                      <SelectItem value="bloating">Bloating</SelectItem>
                      <SelectItem value="fatigue">Fatigue</SelectItem>
                      <SelectItem value="nausea">Nausea</SelectItem>
                      <SelectItem value="breast-tenderness">Breast Tenderness</SelectItem>
                      <SelectItem value="headaches">Headaches</SelectItem>
                      <SelectItem value="mood-swings">Mood Swings</SelectItem>
                      <SelectItem value="anxiety">Anxiety</SelectItem>
                      <SelectItem value="hot-flashes">Hot Flashes</SelectItem>
                      <SelectItem value="spotting">Spotting</SelectItem>
                      <SelectItem value="discharge">Vaginal Discharge</SelectItem>
                      <SelectItem value="sleep-issues">Sleep Issues</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full mt-1 justify-start text-left font-normal"
                        data-testid="edit-symptom-date-picker"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editSymptomDate ? editSymptomDate.toLocaleDateString('en-AU') : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editSymptomDate}
                        onSelect={(date) => date && setEditSymptomDate(date)}
                        initialFocus
                        weekStartsOn={1}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {editSymptomType && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-severity-select" className="text-sm font-medium text-foreground">
                      Severity Level
                    </Label>
                    <Select value={editSymptomSeverity} onValueChange={setEditSymptomSeverity}>
                      <SelectTrigger className="mt-1" data-testid="edit-select-severity">
                        <SelectValue placeholder="Rate severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                        <SelectItem value="very-severe">Very Severe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(editSymptomType === "cramping" || editSymptomType === "headaches" || editSymptomType === "anxiety") && (
                    <div>
                      <Label htmlFor="edit-duration-select" className="text-sm font-medium text-foreground">
                        Duration
                      </Label>
                      <Select value={editSymptomDuration} onValueChange={setEditSymptomDuration}>
                        <SelectTrigger className="mt-1" data-testid="edit-select-duration">
                          <SelectValue placeholder="How long did it last?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="few-minutes">A few minutes</SelectItem>
                          <SelectItem value="30-minutes">30 minutes</SelectItem>
                          <SelectItem value="1-hour">1 hour</SelectItem>
                          <SelectItem value="few-hours">A few hours</SelectItem>
                          <SelectItem value="half-day">Half day</SelectItem>
                          <SelectItem value="all-day">All day</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editSymptomType === "discharge" || editSymptomType === "spotting") && (
                    <div>
                      <Label htmlFor="edit-appearance-select" className="text-sm font-medium text-foreground">
                        Appearance
                      </Label>
                      <Select value={editSymptomDuration} onValueChange={setEditSymptomDuration}>
                        <SelectTrigger className="mt-1" data-testid="edit-select-appearance">
                          <SelectValue placeholder="Describe appearance" />
                        </SelectTrigger>
                        <SelectContent>
                          {editSymptomType === "discharge" ? (
                            <>
                              <SelectItem value="clear">Clear</SelectItem>
                              <SelectItem value="white">White</SelectItem>
                              <SelectItem value="yellow">Yellow</SelectItem>
                              <SelectItem value="brown">Brown</SelectItem>
                              <SelectItem value="green">Green</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="light-pink">Light Pink</SelectItem>
                              <SelectItem value="brown">Brown</SelectItem>
                              <SelectItem value="red">Red</SelectItem>
                              <SelectItem value="dark-red">Dark Red</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="edit-symptom-notes" className="text-sm font-medium text-foreground">
                  Notes
                </Label>
                <Textarea
                  id="edit-symptom-notes"
                  placeholder="Any additional details about this symptom..."
                  className="mt-1"
                  rows={3}
                  value={editSymptomNotes}
                  onChange={(e) => setEditSymptomNotes(e.target.value)}
                  data-testid="edit-textarea-symptom-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingSymptom(null);
                    setEditSymptomType("");
                    setEditSymptomSeverity("");
                    setEditSymptomDuration("");
                    setEditSymptomNotes("");
                    setEditSymptomDate(new Date());
                  }}
                  disabled={updateSymptomMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingSymptom && editSymptomType && editSymptomSeverity) {
                      // Map severity to 1-5 scale
                      const severityMap: { [key: string]: number } = {
                        "mild": 1,
                        "moderate": 2,
                        "severe": 3,
                        "very-severe": 4,
                      };
                      const severityValue = severityMap[editSymptomSeverity] || 2;

                      // Map selected symptom to schema fields
                      const symptomData: any = {
                        date: formatDateForAPI(editSymptomDate),
                        // Clear all symptom fields first, then set only the relevant one
                        bloating: null,
                        fatigue: null,
                        nausea: null,
                        headache: null,
                        moodSwings: null,
                      };

                      // Map symptom type to schema field
                      const symptomFieldMap: { [key: string]: string } = {
                        "bloating": "bloating",
                        "fatigue": "fatigue",
                        "nausea": "nausea",
                        "headaches": "headache",
                        "mood-swings": "moodSwings",
                        "cramping": "bloating",
                        "breast-tenderness": "bloating",
                        "anxiety": "moodSwings",
                        "hot-flashes": "moodSwings",
                        "spotting": "moodSwings",
                        "discharge": "moodSwings",
                        "sleep-issues": "fatigue",
                      };

                      const fieldName = symptomFieldMap[editSymptomType];
                      if (fieldName) {
                        symptomData[fieldName] = severityValue;
                      }

                      // Build notes string
                      const notesParts: string[] = [];
                      const symptomName = editSymptomType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      let symptomInfo = `Symptom: ${symptomName} | Severity: ${editSymptomSeverity}`;
                      if (editSymptomDuration) {
                        const durationLabel = (editSymptomType === "discharge" || editSymptomType === "spotting") ? "Appearance" : "Duration";
                        symptomInfo += ` | ${durationLabel}: ${editSymptomDuration}`;
                      }
                      notesParts.push(symptomInfo);

                      if (editSymptomNotes) {
                        notesParts.push(editSymptomNotes);
                      }

                      symptomData.notes = notesParts.join('\n\n');

                      updateSymptomMutation.mutate({
                        id: editingSymptom.id,
                        data: symptomData,
                      });
                    }
                  }}
                  disabled={!editSymptomType || !editSymptomSeverity || updateSymptomMutation.isPending}
                >
                  {updateSymptomMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Medication Dialog */}
      <Dialog open={!!editingMedication} onOpenChange={(open) => {
        if (!open && !updateMedicationMutation.isPending) {
          setEditingMedication(null);
          setEditMedicationName("");
          setEditMedicationDosage("");
          setEditMedicationTime("");
          setEditMedicationFrequency("");
          setEditMedicationStartDate(new Date());
          setEditMedicationReminder(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Edit Medication
            </DialogTitle>
            <div className="sr-only">Configure medication dosage, timing, and reminder settings</div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium text-foreground">
                Medication Name
              </Label>
              <Input
                placeholder="Enter medication name"
                value={editMedicationName}
                onChange={(e) => setEditMedicationName(e.target.value)}
                className="mt-1"
                data-testid="edit-medication-name"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">
                Dosage & Instructions
              </Label>
              <Input
                placeholder="e.g., 75 IU, 1 tablet, 0.25mg"
                value={editMedicationDosage}
                onChange={(e) => setEditMedicationDosage(e.target.value)}
                className="mt-1"
                data-testid="edit-medication-dosage"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">
                Time to Take
              </Label>
              <Input
                type="time"
                value={editMedicationTime}
                onChange={(e) => setEditMedicationTime(e.target.value)}
                className="mt-1"
                data-testid="edit-medication-time"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">
                Frequency
              </Label>
              <Select value={editMedicationFrequency} onValueChange={setEditMedicationFrequency}>
                <SelectTrigger className="mt-1" data-testid="edit-medication-frequency">
                  <SelectValue placeholder="How often?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One-off dose</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="twice-daily">Twice daily</SelectItem>
                  <SelectItem value="three-times">Three times daily</SelectItem>
                  <SelectItem value="every-other-day">Every other day</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="as-needed">As needed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal mt-1"
                    data-testid="edit-medication-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editMedicationStartDate.toLocaleDateString()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editMedicationStartDate}
                    onSelect={(date) => date && setEditMedicationStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-medication-reminder"
                checked={editMedicationReminder}
                onChange={(e) => setEditMedicationReminder(e.target.checked)}
                className="h-4 w-4 rounded border-border"
                data-testid="edit-medication-reminder-checkbox"
              />
              <Label htmlFor="edit-medication-reminder" className="text-sm font-medium text-foreground">
                Set reminder notifications
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1 text-xs sm:text-sm px-3"
                disabled={!editMedicationDosage || !editMedicationTime || !editMedicationFrequency || updateMedicationMutation.isPending}
                onClick={async () => {
                  if (editingMedication) {
                    const year = editMedicationStartDate.getFullYear();
                    const month = String(editMedicationStartDate.getMonth() + 1).padStart(2, '0');
                    const day = String(editMedicationStartDate.getDate()).padStart(2, '0');
                    const formattedStartDate = `${year}-${month}-${day}`;

                    updateMedicationMutation.mutate({
                      id: editingMedication.id,
                      data: {
                        name: editMedicationName,
                        dosage: editMedicationDosage,
                        frequency: editMedicationFrequency,
                        time: editMedicationTime,
                        startDate: formattedStartDate,
                      },
                    });
                  }
                }}
                data-testid="save-edit-medication"
              >
                {updateMedicationMutation.isPending ? "Updating..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-xs sm:text-sm px-3"
                onClick={() => {
                  setEditingMedication(null);
                  setEditMedicationName("");
                  setEditMedicationDosage("");
                  setEditMedicationTime("");
                  setEditMedicationFrequency("");
                  setEditMedicationStartDate(new Date());
                  setEditMedicationReminder(false);
                }}
                disabled={updateMedicationMutation.isPending}
                data-testid="cancel-edit-medication"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={!!editingAppointment} onOpenChange={(open) => {
        if (!open && !updateAppointmentMutation.isPending) {
          setEditingAppointment(null);
          setEditAppointmentTitle("");
          setEditAppointmentType("");
          setEditAppointmentDate(new Date());
          setEditAppointmentTime("");
          setEditAppointmentLocation("");
          setEditAppointmentDoctorName("");
          setEditAppointmentNotes("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Edit Appointment
            </DialogTitle>
            <DialogDescription>
              Update the appointment details below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium text-foreground">
                Event Type
              </Label>
              <Select value={editAppointmentType} onValueChange={setEditAppointmentType} disabled={isLoadingEventTypes || eventTypes.length === 0}>
                <SelectTrigger className="mt-1" data-testid="edit-select-appointment-type">
                  <SelectValue placeholder={isLoadingEventTypes ? "Loading..." : eventTypes.length === 0 ? "No event types available" : "Select event type"} />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type: any) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eventTypesError && (
                <p className="text-xs text-destructive mt-1">Failed to load event types. Please refresh.</p>
              )}
            </div>

            <div>
              <Label htmlFor="edit-appointment-title" className="text-sm font-medium text-foreground">
                Event Title
              </Label>
              <Input
                id="edit-appointment-title"
                placeholder="e.g., Blood Test, Ultrasound, Doctor Appointment"
                value={editAppointmentTitle}
                onChange={(e) => setEditAppointmentTitle(e.target.value)}
                className="mt-1"
                data-testid="edit-input-appointment-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full mt-1 justify-start text-left font-normal overflow-hidden"
                      data-testid="edit-appointment-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {editAppointmentDate ? editAppointmentDate.toLocaleDateString('en-AU') : "Pick a date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editAppointmentDate}
                      onSelect={(date) => date && setEditAppointmentDate(date)}
                      initialFocus
                      weekStartsOn={1}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="edit-appointment-time" className="text-sm font-medium text-foreground">
                  Time
                </Label>
                <Input
                  id="edit-appointment-time"
                  type="time"
                  value={editAppointmentTime}
                  onChange={(e) => setEditAppointmentTime(e.target.value)}
                  className="mt-1"
                  data-testid="edit-input-appointment-time"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-appointment-location" className="text-sm font-medium text-foreground">
                Location
              </Label>
              <Input
                id="edit-appointment-location"
                placeholder="e.g., Clinic name, Hospital, Lab"
                value={editAppointmentLocation}
                onChange={(e) => setEditAppointmentLocation(e.target.value)}
                className="mt-1"
                data-testid="edit-input-appointment-location"
              />
            </div>

            <div>
              <Label htmlFor="edit-appointment-doctor" className="text-sm font-medium text-foreground">
                Doctor (optional)
              </Label>
              <Input
                id="edit-appointment-doctor"
                placeholder="Doctor name"
                value={editAppointmentDoctorName}
                onChange={(e) => setEditAppointmentDoctorName(e.target.value)}
                className="mt-1"
                data-testid="edit-input-appointment-doctor"
              />
            </div>

            <div>
              <Label htmlFor="edit-appointment-notes" className="text-sm font-medium text-foreground">
                Notes (optional)
              </Label>
              <Textarea
                id="edit-appointment-notes"
                placeholder="Any additional details about this event..."
                value={editAppointmentNotes}
                onChange={(e) => setEditAppointmentNotes(e.target.value)}
                className="mt-1"
                rows={3}
                data-testid="edit-textarea-appointment-notes"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <Button
                className="flex-1"
                data-testid="button-save-edit-appointment"
                disabled={!editAppointmentTitle || !editAppointmentDate || !editAppointmentTime || updateAppointmentMutation.isPending}
                onClick={() => {
                  if (editingAppointment) {
                    // Combine date and time
                    const dateStr = editAppointmentDate.toISOString().split('T')[0];
                    const dateTime = new Date(`${dateStr}T${editAppointmentTime}`);

                    updateAppointmentMutation.mutate({
                      id: editingAppointment.id,
                      data: {
                        title: editAppointmentTitle,
                        type: editAppointmentType,
                        date: dateTime.toISOString(),
                        location: editAppointmentLocation,
                        doctorName: editAppointmentDoctorName,
                        notes: editAppointmentNotes,
                      },
                    });
                  }
                }}
              >
                {updateAppointmentMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditingAppointment(null);
                  setEditAppointmentTitle("");
                  setEditAppointmentType("");
                  setEditAppointmentDate(new Date());
                  setEditAppointmentTime("");
                  setEditAppointmentLocation("");
                  setEditAppointmentDoctorName("");
                  setEditAppointmentNotes("");
                }}
                disabled={updateAppointmentMutation.isPending}
                data-testid="button-cancel-edit-appointment"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Symptom Confirmation Dialog */}
      <AlertDialog open={!!symptomToDelete} onOpenChange={(open) => {
        if (!open && !deleteSymptomMutation.isPending) {
          setSymptomToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Symptom</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this symptom entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSymptomMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => symptomToDelete && deleteSymptomMutation.mutate(symptomToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteSymptomMutation.isPending}
            >
              {deleteSymptomMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Medication Confirmation Dialog */}
      <AlertDialog open={!!medicationToDelete} onOpenChange={(open) => {
        if (!open && !deleteMedicationMutation.isPending) {
          setMedicationToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medication</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this medication? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMedicationMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => medicationToDelete && deleteMedicationMutation.mutate(medicationToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMedicationMutation.isPending}
            >
              {deleteMedicationMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Appointment Confirmation Dialog */}
      <AlertDialog open={!!appointmentToDelete} onOpenChange={(open) => {
        if (!open && !deleteAppointmentMutation.isPending) {
          setAppointmentToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAppointmentMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => appointmentToDelete && deleteAppointmentMutation.mutate(appointmentToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAppointmentMutation.isPending}
            >
              {deleteAppointmentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Event Confirmation Dialog */}
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => {
        if (!open && !deleteEventMutation.isPending) {
          setEventToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEventMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => eventToDelete && deleteEventMutation.mutate(eventToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Test Result Confirmation Dialog */}
      <AlertDialog open={!!testToDelete} onOpenChange={(open) => {
        if (!open && !deleteTestResultMutation.isPending) {
          setTestToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test Result</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this test result? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTestResultMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => testToDelete && deleteTestResultMutation.mutate(testToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTestResultMutation.isPending}
            >
              {deleteTestResultMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Cycle Confirmation Dialog */}
      <AlertDialog open={showCancelCycleDialog} onOpenChange={setShowCancelCycleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Cycle</AlertDialogTitle>
            <AlertDialogDescription>
              This will end your current cycle. Data will be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="cancel-reason-select" className="text-sm font-medium">
                Reason (Optional)
              </Label>
              <Select
                value={selectedCancelReason}
                onValueChange={setSelectedCancelReason}
              >
                <SelectTrigger id="cancel-reason-select" className="mt-1">
                  <SelectValue placeholder="Select a reason (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="treatment_discontinued">Treatment Discontinued</SelectItem>
                  <SelectItem value="medical_reasons">Medical Reasons</SelectItem>
                  <SelectItem value="personal_reasons">Personal Reasons</SelectItem>
                  <SelectItem value="financial_reasons">Financial Reasons</SelectItem>
                  <SelectItem value="switching_clinic">Switching Clinic/Doctor</SelectItem>
                  <SelectItem value="pregnancy_achieved">Pregnancy Achieved (Natural)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cancel-reason-notes" className="text-sm font-medium">
                Additional Notes (Optional)
              </Label>
              <Textarea
                id="cancel-reason-notes"
                placeholder="Add any additional details..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-1 min-h-[80px]"
                data-testid="textarea-cancel-reason"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setCancelReason("");
                setSelectedCancelReason("");
                setShowCancelCycleDialog(false);
              }}
              data-testid="button-cancel-cycle-dialog"
            >
              Keep Cycle
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelCycle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={finishCycleMutation.isPending}
              data-testid="button-confirm-cancel-cycle"
            >
              {finishCycleMutation.isPending ? "Cancelling..." : "Cancel Cycle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Cycle Confirmation Dialog */}
      <AlertDialog open={!!cycleToDelete} onOpenChange={(open) => !open && setCycleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cycle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this cycle? This action cannot be undone. All associated data including medications, symptoms, test results, appointments, milestones, and events will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCycleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cycleToDelete) {
                  deleteCycleMutation.mutate(cycleToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCycleMutation.isPending}
              data-testid="button-confirm-delete-cycle"
            >
              {deleteCycleMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}