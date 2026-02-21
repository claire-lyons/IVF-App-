import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Cycle, Appointment, Event, Symptom, Milestone } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { getEstimatedCycleLength } from "@/lib/cycleUtils";

interface CycleCalendarProps {
  activeCycle?: Cycle;
}

interface DaySummary {
  date: Date;
  cycleDay: number | null;
  appointments: Appointment[];
  milestones: Milestone[];
  events: Event[];
  symptoms: Symptom[];
}

const startOfDay = (value: Date) => {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const parseDateValue = (value: string | Date | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) {
    return startOfDay(value);
  }
  if (typeof value === "string") {
    if (value.includes("T")) {
      const parsed = new Date(value);
      return startOfDay(parsed);
    }
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, (month || 1) - 1, day || 1);
    return startOfDay(parsed);
  }
  return null;
};

const isSameDay = (value: string | Date | null | undefined, compare: Date) => {
  const left = parseDateValue(value);
  const right = startOfDay(compare);
  if (!left) return false;
  return left.getTime() === right.getTime();
};

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatSymptomDetails = (symptom: Symptom) => {
  const parts: string[] = [];
  if (symptom.mood) parts.push(`Mood: ${symptom.mood}`);
  if (symptom.fatigue) parts.push(`Fatigue`);
  if (symptom.bloating) parts.push(`Bloating`);
  if (symptom.nausea) parts.push(`Nausea`);
  if (symptom.headache) parts.push(`Headache`);
  if (symptom.moodSwings) parts.push(`Mood swings`);
  if (symptom.notes) parts.push(symptom.notes);
  return parts.length ? parts.join(" • ") : "Symptoms logged";
};

export default function CycleCalendar({ activeCycle }: CycleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DaySummary | null>(null);

  const { data: rawAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments/upcoming"],
  });

  // Deduplicate appointments and filter by cycle status
  const appointments = useMemo(() => {
    if (!rawAppointments || rawAppointments.length === 0) return [];
    
    // Filter appointments based on activeCycle status
    // If there's an activeCycle and it's not active (cancelled/completed), don't show appointments
    if (activeCycle && activeCycle.status !== "active") {
      return []; // Don't show appointments for cancelled/completed cycles
    }
    
    // If there's an activeCycle, only show appointments from that cycle
    // Otherwise, show all appointments (backend already filters to active cycles only)
    let filtered = rawAppointments;
    if (activeCycle) {
      filtered = rawAppointments.filter(apt => apt.cycleId === activeCycle.id);
    }
    
    const seenIds = new Set<string>();
    const unique: Appointment[] = [];
    
    for (const apt of filtered) {
      if (!seenIds.has(apt.id)) {
        seenIds.add(apt.id);
        unique.push(apt);
      }
    }
    
    // If still duplicates by content (different IDs but same data), deduplicate by title+date+location
    const seenKeys = new Set<string>();
    const final: Appointment[] = [];
    
    for (const apt of unique) {
      const aptDate = apt.date instanceof Date ? apt.date : new Date(apt.date);
      const key = `${apt.title}|${aptDate.getTime()}|${apt.location || ''}`;
      
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        final.push(apt);
      }
    }
    
    return final;
  }, [rawAppointments, activeCycle]);

  const { data: milestones = [] } = useQuery<Milestone[]>({
    queryKey: activeCycle ? ["/api/cycles", activeCycle.id, "/milestones"] : [],
    enabled: !!activeCycle,
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: activeCycle ? ["/api/cycles", activeCycle.id, "events"] : [],
    enabled: !!activeCycle,
  });

  const { data: symptoms = [] } = useQuery<Symptom[]>({
    queryKey: activeCycle ? ["/api/cycles", activeCycle.id, "symptoms"] : [],
    enabled: !!activeCycle,
  });

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  ).getDate();

  const firstDayOfMonth =
    (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) %
    7;

  const monthName = currentDate.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  const getCycleDay = (date: Date) => {
    if (!activeCycle) return null;
    
    const start = startOfDay(new Date(activeCycle.startDate));
    const target = startOfDay(date);
    
    // Don't calculate cycle day for dates before cycle start (this causes Day 0 issue)
    if (target < start) return null;

    const diff =
      Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check if date is within cycle bounds
    if (activeCycle.endDate) {
      const end = startOfDay(new Date(activeCycle.endDate));
      if (target > end) return null;
    } else {
      // For cycles without end date, allow dates within estimated length + buffer
      const estimatedLength = getEstimatedCycleLength(activeCycle.type);
      if (estimatedLength && diff > estimatedLength + 7) {
        return null;
      }
    }

    return diff;
  };

  const hasAppointment = (date: Date) =>
    appointments.some((apt) => isSameDay(apt.date, date));

  const hasMilestone = (date: Date) =>
    milestones.some((milestone) => isSameDay(milestone.date, date));

  const hasLoggedData = (date: Date) =>
    events.some((event) => isSameDay(event.date, date)) ||
    symptoms.some((symptom) => isSameDay(symptom.date, date));

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const openSummary = (date: Date, cycleDay: number | null) => {
    const dayAppointments = appointments.filter((apt) => isSameDay(apt.date, date));
    const dayMilestones = milestones.filter((milestone) =>
      isSameDay(milestone.date, date),
    );
    // Show ALL events including doctor_visit events
    const dayEvents = events.filter((event) => isSameDay(event.date, date));
    const daySymptoms = symptoms.filter((symptom) => isSameDay(symptom.date, date));

    setSelectedDay({
      date,
      cycleDay,
      appointments: dayAppointments,
      milestones: dayMilestones,
      events: dayEvents,
      symptoms: daySymptoms,
    });
  };

  const days = useMemo(() => {
    const daysArray: Array<{
      day: number;
      date: Date;
      isToday: boolean;
      hasAppointment: boolean;
      hasMilestone: boolean;
      hasLoggedData: boolean;
      cycleDay: number | null;
    } | null> = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      daysArray.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day,
      );
      daysArray.push({
        day,
        date,
        isToday: isToday(date),
        hasAppointment: hasAppointment(date),
        hasMilestone: hasMilestone(date),
        hasLoggedData: hasLoggedData(date),
        cycleDay: getCycleDay(date),
      });
    }

    return daysArray;
  }, [
    currentDate,
    appointments,
    milestones,
    events,
    symptoms,
    activeCycle?.id,
    activeCycle?.startDate,
    activeCycle?.endDate,
    activeCycle?.type,
  ]);

  const hasActiveCycle = Boolean(activeCycle);

  const renderSummaryContent = () => {
    if (!selectedDay) return null;

    const hasAppointments = selectedDay.appointments.length > 0;
    const hasMilestones = selectedDay.milestones.length > 0;
    const hasLogs =
      selectedDay.events.length > 0 || selectedDay.symptoms.length > 0;
    const noData = !hasAppointments && !hasMilestones && !hasLogs;

    return (
      <>
        {selectedDay.cycleDay && (
          <div className="mb-4">
            <Badge variant="secondary" className="text-xs">
              Cycle Day {selectedDay.cycleDay}
            </Badge>
          </div>
        )}

        {hasAppointments && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2 text-card-foreground">
              Scheduled Appointments
            </h4>
            <div className="space-y-2">
              {selectedDay.appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="rounded-lg border border-border p-2 text-sm"
                >
                  <p className="font-medium">{appointment.title}</p>
                  <p className="text-muted-foreground">
                    {appointment.location || "Clinic"} •{" "}
                    {new Date(appointment.date).toLocaleTimeString("en-AU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasMilestones && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2 text-card-foreground">
              Cycle Milestones
            </h4>
            <div className="space-y-2">
                {selectedDay.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="rounded-lg border p-2 text-sm"
                  style={{ 
                    borderColor: '#CEBEB7',
                    backgroundColor: '#ECE9E0'
                  }}
                >
                  <p className="font-medium" style={{ color: '#6C5C4D' }}>{milestone.title}</p>
                  <p className="text-xs capitalize" style={{ color: '#B7A694' }}>
                    {milestone.status || "pending"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasLogs && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2 text-card-foreground">
              Logged Data
            </h4>
            <div className="space-y-2">
              {selectedDay.events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border p-2 text-sm"
                  style={{ 
                    borderColor: '#CEBEB7',
                    backgroundColor: '#E2DACF'
                  }}
                >
                  <p className="font-medium" style={{ color: '#6C5C4D' }}>
                    {event.title}
                  </p>
                  <p className="text-xs capitalize" style={{ color: '#B7A694' }}>
                    {event.eventType.replace(/_/g, " ")}{" "}
                    {event.time ? `• ${event.time}` : ""}
                  </p>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              ))}
              {selectedDay.symptoms.map((symptom) => (
                <div
                  key={symptom.id}
                  className="rounded-lg border p-2 text-sm"
                  style={{ 
                    borderColor: '#CEBEB7',
                    backgroundColor: '#E2DACF'
                  }}
                >
                  <p className="font-medium" style={{ color: '#6C5C4D' }}>Symptoms logged</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSymptomDetails(symptom)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {noData && (
          <p className="text-sm text-muted-foreground">
            No logs, appointments, or milestones recorded for this date yet.
          </p>
        )}
      </>
    );
  };

  return (
    <>
      <Card className="rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-card-foreground">Cycle Calendar</h3>
            <p className="text-xs text-muted-foreground">
              Tap a date to review logs, milestones, and appointments.
            </p>
          </div>
          <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={previousMonth}
          className="h-8 w-8"
          data-testid="button-prev-month"
              type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
            <div className="text-sm font-medium min-w-[120px] text-center">
          {monthName}
            </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          className="h-8 w-8"
          data-testid="button-next-month"
              type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
        </div>

        {!hasActiveCycle && (
          <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Start a treatment cycle to unlock cycle day numbers, milestone flags,
            and logged data summaries.
          </div>
        )}

      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

        <div className="grid grid-cols-7 gap-1" data-testid="calendar-grid">
        {days.map((dayData, index) => {
          if (!dayData) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          return (
            <button
              key={dayData.day}
              type="button"
              onClick={() => openSummary(dayData.date, dayData.cycleDay)}
              className={`
                aspect-square rounded-lg text-xs font-medium relative
                transition-colors flex flex-col items-center justify-start pt-1 pb-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80
                ${dayData.isToday ? "text-white" : "hover:bg-[#E3DBD6]"}
              `}
              style={dayData.isToday ? { backgroundColor: '#6C5C4D' } : {}}
              aria-label={`View details for ${dayData.day} ${monthName}`}
              data-testid={`calendar-day-${dayData.day}`}
            >
              <span className="text-xs leading-tight">{dayData.day}</span>
              
              <div className="h-[18px] flex items-center justify-center">
                {dayData.cycleDay && (
                  <span className="text-[10px] font-semibold" style={{ color: '#6C5C4D' }}>
                    Day {dayData.cycleDay}
                  </span>
                )}
              </div>

              <div className="flex gap-0.5 mt-0.5 min-h-[8px]">
                {dayData.hasLoggedData && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#BFBFAE' }}
                    data-testid={`log-indicator-${dayData.day}`}
                  />
                )}
                {dayData.hasAppointment && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#CEBEB7' }}
                    data-testid={`appointment-indicator-${dayData.day}`}
                  />
                )}
                {dayData.hasMilestone && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#6C5C4D' }}
                    data-testid={`milestone-indicator-${dayData.day}`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground justify-center">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#BFBFAE' }} />
            <span>Logged data</span>
          </div>
        <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#CEBEB7' }} />
          <span>Appointment</span>
        </div>
        <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6C5C4D' }} />
          <span>Milestone</span>
        </div>
      </div>
    </Card>

      <Dialog
        open={!!selectedDay}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDay(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-w-[95vw] px-4 py-4">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg leading-tight break-words">
                  {formatDisplayDate(selectedDay.date)}
                </DialogTitle>
                <DialogDescription className="text-sm sm:text-base leading-snug break-words">
                  {selectedDay.cycleDay
                    ? `Cycle Day ${selectedDay.cycleDay}`
                    : activeCycle
                    ? "No active cycle data for this date yet."
                    : "No active cycle."}
                </DialogDescription>
              </DialogHeader>

              {renderSummaryContent()}

              <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground sm:text-left text-center leading-snug break-words">
                  Need to adjust or add notes for this date?
                </p>
                <Link
                  href={`/tracking?tab=events&action=add-event&date=${formatDateParam(
                    selectedDay.date,
                  )}`}
                >
                  <Button size="sm" className="w-full sm:w-auto">
                    <NotebookPen className="h-4 w-4 mr-2" />
                    Edit this day's data
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
