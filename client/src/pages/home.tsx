import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Lightbulb, Stethoscope, Activity, BookOpen, ArrowRight, ClipboardList, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Cycle } from "@shared/schema";
import { getMilestonesForCycle, getNextMilestone, calculateMilestoneDate, type CyclePhase, calculateCycleDay, getCycleTypeLabel, getEstimatedCycleLength, getMilestoneForDay, getLatestActiveMilestone, getMilestoneByType, getStageInfoFromData, getStageInfoFromMilestones, type StageReferenceData, getStageInfoWithJsonFallback, type StageDetectionResult } from "@/lib/cycleUtils";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useMemo, useState, useRef } from "react";
import CycleCalendar from "@/components/cycle-calendar";
import HamburgerMenu from "@/components/hamburger-menu";
import { getRelevantArticles, formatReadingTime, getCategoryIcon, formatCategory, type EducationArticleData } from "@/lib/educationUtils";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { startOfDay } from "date-fns";
export default function Home() {
  const [location] = useLocation();
  const calendarRef = useRef<HTMLDivElement>(null);

  interface ContentBlock {
    id: string;
    cycleTemplateId: string;
    milestoneName: string;
    milestoneType: string | null;
    notificationTitle: string | null;
    milestoneDetails: string | null;
    medicalInformation: string | null;
    whatToExpect: string | null;
    todaysTips: string | null;
    milestoneOrder: number | null;
    expectedDayOffset: number | null;
  }

  const { data: activeCycle, isLoading: isLoadingCycle } = useQuery<Cycle>({
    queryKey: ["/api/cycles/active"],
  });

  const cycleTemplateId = useMemo(() => {
    const rawType = activeCycle?.type?.toLowerCase() ?? "";
    if (rawType === "ivf-fresh" || rawType === "ivf_fresh" || rawType === "ivf") return "IVF";
    if (rawType === "ivf-frozen" || rawType === "ivf_frozen" || rawType === "fet") return "FET";
    if (rawType === "iui") return "IUI";
    if (rawType === "egg-freezing" || rawType === "egg_freezing") return "EGG_FREEZ";
    return null;
  }, [activeCycle?.type]);

  const { data: contentBlocks = [] } = useQuery<ContentBlock[]>({
    queryKey: ["/api/content-blocks", cycleTemplateId],
    enabled: Boolean(cycleTemplateId),
    queryFn: async () => {
      const response = await fetch(
        `/api/content-blocks?cycleTemplateId=${cycleTemplateId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch content blocks");
      }
      return response.json();
    },
  });

  // Scroll to calendar if hash is present in URL
  useEffect(() => {
    const scrollToCalendar = () => {
      if (window.location.hash === '#calendar') {
        // Wait a bit longer to ensure the page is fully rendered
        setTimeout(() => {
          if (calendarRef.current) {
            const elementTop = calendarRef.current.offsetTop;
            window.scrollTo({
              top: elementTop - 20, // Add some offset from top
              behavior: 'smooth'
            });
          }
        }, 500);
      }
    };

    // Check immediately and after a delay
    scrollToCalendar();

    // Also listen for hash changes
    window.addEventListener('hashchange', scrollToCalendar);

    return () => {
      window.removeEventListener('hashchange', scrollToCalendar);
    };
  }, [location, activeCycle]); // Also depend on activeCycle to ensure calendar is rendered


  const { data: rawMilestones } = useQuery<any[]>({
    queryKey: activeCycle ? ["/api/cycles", activeCycle.id, "milestones"] : [],
    enabled: !!activeCycle,
  });
  const milestones = rawMilestones ?? [];

  // Fetch stage reference data from CSV
  const { data: stageReferenceData = [], isLoading: isLoadingStages } = useQuery<StageReferenceData[]>({
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

  // Create a stable reference for milestones to avoid infinite loops
  // Only track the parts we care about: IDs, statuses, types, and titles
  const milestonesKey = useMemo(() => {
    if (!milestones || milestones.length === 0) return '';
    return milestones.map(m => `${m.id || ''}:${m.status || ''}:${m.type || ''}:${m.title || ''}`).join('|');
  }, [milestones]);

  const [nextMilestoneData, setNextMilestoneData] = useState<{ title: string, date: string } | null>(null);
  const [todaysInsights, setTodaysInsights] = useState<any>(null);
  const [cycleMilestones, setCycleMilestones] = useState<any[]>([]);
  const [currentPhase, setCurrentPhase] = useState<StageDetectionResult | null>(null);
  const [relevantArticles, setRelevantArticles] = useState<EducationArticleData[]>([]);
  const [selectedInsightDate, setSelectedInsightDate] = useState<Date>(new Date());
  const [insightsLoading, setInsightsLoading] = useState(false);
  const cycleDay = activeCycle ? calculateCycleDay(activeCycle.startDate) : 0;
  const estimatedCycleLength = activeCycle ? getEstimatedCycleLength(activeCycle.type) : 0;
  const cycleTypeLabel = activeCycle ? getCycleTypeLabel(activeCycle.type) : "Fertility Cycle";
  const cycleTypeLabelShort = activeCycle ? getCycleTypeLabel(activeCycle.type, "short") : "cycle";
  const cycleProgressPercent = activeCycle ? getCycleProgress() : 0;
  const remainingDays = estimatedCycleLength ? Math.max(estimatedCycleLength - cycleDay, 0) : 0;
  const cycleProgressMarkers = useMemo(() => {
    if (!activeCycle || !cycleMilestones.length) return [];
    const sorted = [...cycleMilestones].sort((a, b) => a.day - b.day);
    const seenNames = new Set<string>();
    const markers: { name: string; day: number }[] = [];

    for (const milestone of sorted) {
      if (!milestone?.name || seenNames.has(milestone.name)) continue;
      seenNames.add(milestone.name);
      markers.push({ name: milestone.name, day: milestone.day });
      if (markers.length === 4) break;
    }

    return markers;
  }, [activeCycle?.id, cycleMilestones]);


  useEffect(() => {
    if (!activeCycle) {
      setNextMilestoneData(null);
      setTodaysInsights(null);
      setCycleMilestones([]);
      setCurrentPhase(null);
      return;
    }

    let isMounted = true;

    const loadNextMilestone = async () => {
      try {
        const completedTypes = (milestones || [])
          .filter((m: any) => m.status === 'completed' || m.completed)
          .map((m: any) => m.type);

        const nextMilestone = await getNextMilestone(
          activeCycle.type,
          Math.max(cycleDay, 1),
          completedTypes
        );

        if (nextMilestone && isMounted) {
          const milestoneDate = calculateMilestoneDate(activeCycle.startDate, nextMilestone.day);
          setNextMilestoneData({
            title: nextMilestone.name,
            date: milestoneDate.toLocaleDateString('en-AU', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })
          });
        } else if (isMounted) {
          // Find the last milestone (by expected date)
          if (milestones && milestones.length > 0) {
            const sortedMilestones = [...milestones].sort((a: any, b: any) => {
              const dateA = new Date(a.date || 0).getTime();
              const dateB = new Date(b.date || 0).getTime();
              return dateB - dateA; // Latest first
            });

            const lastMilestone = sortedMilestones[0];
            if (lastMilestone && lastMilestone.date) {
              setNextMilestoneData({
                title: lastMilestone.title || "End Date",
                date: new Date(lastMilestone.date).toLocaleDateString('en-AU', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              });
            } else {
              // Fallback
              const collectionDate = new Date(activeCycle.startDate);
              collectionDate.setDate(collectionDate.getDate() + 14);
              setNextMilestoneData({
                title: "Expected Collection",
                date: collectionDate.toLocaleDateString('en-AU', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              });
            }
          } else {
            // Fallback
            const collectionDate = new Date(activeCycle.startDate);
            collectionDate.setDate(collectionDate.getDate() + 14);
            setNextMilestoneData({
              title: "Expected Collection",
              date: collectionDate.toLocaleDateString('en-AU', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            });
          }
        }
      } catch (error) {
        console.error('Error loading next milestone:', error);
        if (isMounted) {
          // Find the last milestone (by expected date)
          if (milestones && milestones.length > 0) {
            const sortedMilestones = [...milestones].sort((a: any, b: any) => {
              const dateA = new Date(a.date || 0).getTime();
              const dateB = new Date(b.date || 0).getTime();
              return dateB - dateA; // Latest first
            });

            const lastMilestone = sortedMilestones[0];
            if (lastMilestone && lastMilestone.date) {
              setNextMilestoneData({
                title: lastMilestone.title || "End Date",
                date: new Date(lastMilestone.date).toLocaleDateString('en-AU', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              });
            } else {
              // Fallback
              const collectionDate = new Date(activeCycle.startDate);
              collectionDate.setDate(collectionDate.getDate() + 14);
              setNextMilestoneData({
                title: "Expected Collection",
                date: collectionDate.toLocaleDateString('en-AU', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              });
            }
          } else {
            // Fallback
            const collectionDate = new Date(activeCycle.startDate);
            collectionDate.setDate(collectionDate.getDate() + 14);
            setNextMilestoneData({
              title: "Expected Collection",
              date: collectionDate.toLocaleDateString('en-AU', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            });
          }
        }
      }
    };

    const loadTemplateInsights = async () => {
      try {
        setInsightsLoading(true);
        const allMilestones = await getMilestonesForCycle(activeCycle.type);
        if (!isMounted) return;
        setCycleMilestones(allMilestones);

        // Always prioritize latest active milestone (not just for today)
        // Make sure milestones array is available (not just empty array from initial state)
        let currentMilestone: any = null;

        if (milestones && milestones.length > 0) {
          const latestActiveMilestone = getLatestActiveMilestone(milestones);
          if (latestActiveMilestone) {
            // Get the milestone template that matches the active milestone
            // Try both type and title for better matching
            currentMilestone = await getMilestoneByType(
              activeCycle.type,
              latestActiveMilestone.type,
              latestActiveMilestone.title
            );

            // If still not found, try using just the title
            if (!currentMilestone && latestActiveMilestone.title) {
              currentMilestone = await getMilestoneByType(
                activeCycle.type,
                latestActiveMilestone.title,
                latestActiveMilestone.title
              );
            }
          }
        }

        // If no active milestone found, fall back to day-based lookup
        if (!currentMilestone) {
          const selectedDate = new Date(selectedInsightDate);
          selectedDate.setHours(0, 0, 0, 0);
          const cycleStartDate = new Date(activeCycle.startDate);
          cycleStartDate.setHours(0, 0, 0, 0);

          // Check if selected date is before cycle start
          if (selectedDate < cycleStartDate) {
            if (isMounted) {
              setTodaysInsights(null);
              setInsightsLoading(false);
            }
            return;
          }

          // Calculate cycle day for selected date
          const diff = Math.floor((selectedDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const selectedCycleDay = Math.max(diff, 1);

          // Check if selected date is beyond cycle end (if cycle has end date)
          // No limit on cycle length - cycles can go for several months
          if (activeCycle.endDate) {
            const cycleEndDate = new Date(activeCycle.endDate);
            cycleEndDate.setHours(0, 0, 0, 0);
            if (selectedDate > cycleEndDate) {
              if (isMounted) {
                setTodaysInsights(null);
                setInsightsLoading(false);
              }
              return;
            }
          }

          currentMilestone = await getMilestoneForDay(
            activeCycle.type,
            selectedCycleDay,
            allMilestones
          );
        }

        if (isMounted) {
          const normalize = (value: string) =>
            value.toLowerCase().replace(/[-\s_]/g, "").trim();

          const contentBlock = currentMilestone
            ? contentBlocks.find((block) => {
              const milestoneName = normalize(currentMilestone.name);
              const blockName = normalize(block.milestoneName);
              const notificationTitle = block.notificationTitle
                ? normalize(block.notificationTitle)
                : "";
              return milestoneName === blockName || milestoneName === notificationTitle;
            })
            : null;

          const tips =
            contentBlock?.todaysTips
              ? contentBlock.todaysTips
                .split(/\r?\n/)
                .map((tip) => tip.trim())
                .filter(Boolean)
              : currentMilestone?.tips ?? [];

          const insights = currentMilestone
            ? {
              ...currentMilestone,
              medicalDetails:
                contentBlock?.medicalInformation ?? currentMilestone.medicalDetails,
              monitoringProcedures:
                contentBlock?.milestoneDetails ?? currentMilestone.monitoringProcedures,
              patientInsights:
                contentBlock?.whatToExpect ?? currentMilestone.patientInsights,
              tips,
            }
            : null;

          setTodaysInsights(insights);
          setInsightsLoading(false);
        }
      } catch (error) {
        console.error('Error loading insights:', error);
        if (isMounted) {
          setTodaysInsights(null);
          setCycleMilestones([]);
          setInsightsLoading(false);
        }
      }
    };

    const loadCurrentPhase = async () => {
      try {
        // Use the new JSON-based stage detection
        const stageResult = await getStageInfoWithJsonFallback(
          stageReferenceData,
          activeCycle,
          milestones,
          calculateCycleDay(activeCycle.startDate)
        );

        if (stageResult && isMounted) {
          setCurrentPhase(stageResult);
        }
      } catch (error) {
        console.error('Error detecting current phase:', error);
        if (isMounted) {
          setCurrentPhase(null);
        }
      }
    };

    loadNextMilestone();
    loadTemplateInsights();
    if (stageReferenceData.length > 0 || !isLoadingStages) {
      loadCurrentPhase();
    }

    return () => {
      isMounted = false;
    };
  }, [
    activeCycle?.id,
    activeCycle?.type,
    activeCycle?.startDate,
    activeCycle?.endDate,
    cycleDay,
    milestonesKey,
    selectedInsightDate,
    contentBlocks.length,
    stageReferenceData.length,
    isLoadingStages,
  ]);

  // Load relevant educational articles based on phase and cycle type
  useEffect(() => {
    const loadEducationalContent = async () => {
      try {
        if (activeCycle && currentPhase) {
          // Convert phase name to slug format (e.g., "Egg Collection" -> "egg-collection")
          const phaseSlug = currentPhase.stage.name.toLowerCase().replace(/\s+/g, '-');
          const articles = await getRelevantArticles(phaseSlug, activeCycle.type, 3);
          setRelevantArticles(articles);
        } else {
          // Don't show articles if no active cycle
          setRelevantArticles([]);
        }
      } catch (error) {
        console.error('Error loading educational content:', error);
      }
    };

    loadEducationalContent();
  }, [activeCycle?.id, currentPhase?.stage.name]);

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  function getCycleDay() {
    if (!activeCycle) return 0;
    return calculateCycleDay(activeCycle.startDate);
  }

  function getCycleProgress() {
    if (!activeCycle) {
      return 0;
    }

    // If cycle is completed or cancelled, don't show 100% unless all milestones are complete
    const isCycleEnded = activeCycle.status === 'completed' || activeCycle.status === 'cancelled';

    if (!cycleMilestones.length || !milestones.length) {
      // Fallback to day-based calculation if no milestone data
      const day = getCycleDay();
      const estimate = activeCycle ? getEstimatedCycleLength(activeCycle.type) : 28;
      const dayBasedProgress = Math.min((day / estimate) * 100, 100);
      // Don't show 100% if cycle is ended
      return isCycleEnded ? Math.min(dayBasedProgress, 99) : dayBasedProgress;
    }

    // Calculate progress based on completed milestones
    const totalMilestones = cycleMilestones.length;
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
        // If cycle is ended or not all milestones complete, cap at 99%
        return Math.min(milestoneProgress, 99);
      }
    }

    return Math.min(milestoneProgress, 100);
  }

  const getGreeting = () => {
    if (isLoadingUser) {
      return 'Loading...';
    }
    const hour = new Date().getHours();
    const firstName = (user as any)?.firstName || 'there';
    if (hour < 12) return `Good Morning, ${firstName}`;
    if (hour < 17) return `Good Afternoon, ${firstName}`;
    return `Good Evening, ${firstName}`;
  };

  const getTodayDate = () => {
    return new Date().toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStartDate = () => {
    if (!activeCycle) return "Feb 15, 2025"; // Default for demo

    // Find 'Cycle started' milestone
    const cycleStartedMilestone = milestones.find((m: any) =>
      m.type === 'cycle-start' ||
      m.type === 'cycle_start' ||
      m.title?.toLowerCase().includes('cycle start') ||
      m.title?.toLowerCase().includes('cycle day 1') ||
      m.title?.toLowerCase() === 'cycle started'
    );

    if (cycleStartedMilestone && cycleStartedMilestone.date) {
      return new Date(cycleStartedMilestone.date).toLocaleDateString('en-AU', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    // Fallback to cycle startDate if no milestone found
    return new Date(activeCycle.startDate).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getNextUpcomingMilestone = () => {
    if (nextMilestoneData) {
      return nextMilestoneData;
    }

    // Find the last milestone (by expected date/order)
    if (activeCycle && milestones.length > 0) {
      // Sort milestones by date (expected date)
      const sortedMilestones = [...milestones].sort((a: any, b: any) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA; // Latest first
      });

      const lastMilestone = sortedMilestones[0];
      if (lastMilestone && lastMilestone.date) {
        return {
          title: lastMilestone.title || "End Date",
          date: new Date(lastMilestone.date).toLocaleDateString('en-AU', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        };
      }
    }

    // Fallback while loading
    const collectionDate = new Date(activeCycle?.startDate || new Date());
    collectionDate.setDate(collectionDate.getDate() + 14);
    return {
      title: "Expected Collection",
      date: collectionDate.toLocaleDateString('en-AU', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    };
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with Greeting Box */}
      <div className="px-6 pt-8 pb-4">
        <Card className="rounded-2xl p-6 shadow-sm relative" style={{ backgroundColor: 'hsl(74, 17%, 78%)' }}>
          <HamburgerMenu className="absolute top-6 right-3 text-white hover:bg-white/10" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-1" data-testid="greeting-display">
              {isLoadingUser ? (
                <span className="inline-block animate-pulse">Loading...</span>
              ) : (
                getGreeting()
              )}
            </h1>
            <p className="text-sm text-white/80" data-testid="date-display">
              {getTodayDate()}
            </p>
          </div>
        </Card>
      </div>

      {/* Dashboard Content */}
      <div className="px-6 space-y-3">
        {/* Cycle Summary Card */}
        <Card className="rounded-2xl p-6 shadow-sm">
          {isLoadingCycle ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : activeCycle ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="text-muted-foreground" size={20} />
                  <h3 className="font-semibold text-card-foreground" data-testid="cycle-title">
                    {cycleTypeLabel}
                  </h3>
                </div>
                <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium" data-testid="cycle-status">
                  Active
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-2" data-testid="cycle-day-info">
                Day {cycleDay} of {cycleTypeLabelShort}
              </p>
              {estimatedCycleLength > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>
                    {estimatedCycleLength} day plan
                  </span>
                  <span>
                    {remainingDays > 0 ? `${remainingDays} days remaining` : "Waiting for summary"}
                  </span>
                </div>
              )}

              <div className="w-full bg-muted rounded-full h-2 mb-4">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${cycleProgressPercent}%` }}
                  data-testid="cycle-progress-bar"
                ></div>
              </div>

              {cycleProgressMarkers.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5" data-testid="cycle-progress-markers">
                  {cycleProgressMarkers.map((marker) => (
                    <div key={`${marker.name}-${marker.day}`} className="flex flex-col items-center text-center px-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full mb-1 ${cycleDay >= marker.day ? "bg-primary" : "bg-muted-foreground/40"}`}
                        aria-hidden="true"
                      />
                      <p className="text-[10px] font-medium text-muted-foreground leading-tight line-clamp-2">
                        {marker.name}
                      </p>
                      <span className="text-[10px] text-muted-foreground/70">
                        Day {marker.day}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Current Phase Indicator */}
              {currentPhase && (
                <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border" data-testid="phase-indicator">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg" role="img" aria-label="phase-icon">🔄</span>
                    <h4 className="font-semibold text-slate-600" data-testid="phase-name">
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
                    <div className="mb-2">
                      <ul className="text-xs text-muted-foreground space-y-1" data-testid="phase-description">
                        {currentPhase.stage.description.split('\n').filter(line => line.trim()).map((line, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-primary mt-0.5 text-xs">•</span>
                            <span>{line.trim()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Additional context for fallback scenarios */}
                  {currentPhase.source === 'fallback_milestone' && currentPhase.fallbackMilestone && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Based on recent progress from {currentPhase.fallbackMilestone.title}
                    </p>
                  )}
                  {currentPhase.confidence === 'low' && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Stage information pending - continue following your treatment plan
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium text-card-foreground" data-testid="cycle-start-date">
                    {getStartDate()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">{getNextUpcomingMilestone().title}</p>
                  <p className="font-medium text-card-foreground" data-testid="cycle-next-milestone">
                    {getNextUpcomingMilestone().date}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="text-muted-foreground" size={20} />
                  <h3 className="font-semibold text-card-foreground" data-testid="cycle-title">
                    No Active Cycle
                  </h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                You don't have an active treatment cycle at the moment.
              </p>
              <Link href="/tracking?tab=cycle">
                <Button className="w-full" data-testid="button-start-cycle">
                  <Plus size={16} className="mr-2" />
                  Start New Cycle
                </Button>
              </Link>
            </>
          )}
        </Card>

        {/* Personalized Insights */}
        {!isLoadingCycle && activeCycle && (
          <Card className="rounded-2xl p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-3">
                <Lightbulb className="text-muted-foreground" size={20} />
                <h3 className="font-semibold text-card-foreground" data-testid="insights-title">
                  Personalized Insights
                </h3>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-left font-normal"
                    data-testid="insight-date-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedInsightDate.toLocaleDateString('en-AU')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedInsightDate}
                    onSelect={(date) => date && setSelectedInsightDate(date)}
                    initialFocus
                    weekStartsOn={1}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {(() => {
              const selectedDateStart = startOfDay(selectedInsightDate);
              const cycleStartDate = startOfDay(new Date(activeCycle.startDate));
              const estimatedLength = getEstimatedCycleLength(activeCycle.type);

              // Check if date is before cycle start
              const isBeforeCycle = selectedDateStart < cycleStartDate;

              // Check if date is after cycle end (if cycle has end date)
              // No limit on cycle length - cycles can go for several months
              let isAfterCycle = false;
              if (activeCycle.endDate) {
                const cycleEndDate = startOfDay(new Date(activeCycle.endDate));
                isAfterCycle = selectedDateStart > cycleEndDate;
              }

              if (isBeforeCycle) {
                return (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="insights-before-cycle-message">
                      Insights are only available from the cycle start date ({new Date(activeCycle.startDate).toLocaleDateString('en-AU')}). Please select a date within your cycle range.
                    </p>
                  </div>
                );
              }

              if (isAfterCycle && activeCycle.endDate) {
                const endDateText = new Date(activeCycle.endDate).toLocaleDateString('en-AU');
                return (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="insights-after-cycle-message">
                      Insights are only available up to the cycle end date ({endDateText}). Please select a date within your cycle range.
                    </p>
                  </div>
                );
              }

              if (insightsLoading) {
                return (
                  <p className="text-sm text-muted-foreground" data-testid="insights-loading">
                    Loading insights for your current cycle stage...
                  </p>
                );
              }

              if (todaysInsights) {
                return (
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                        {todaysInsights.name}
                      </span>
                      {todaysInsights.dayLabel && (
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                          {todaysInsights.dayLabel}
                        </Badge>
                      )}
                    </div>
                    {/* Medical Details */}
                    <div className="mb-4">
                      <h4 className="font-medium text-card-foreground mb-2 flex items-center space-x-2">
                        <Stethoscope size={14} className="text-primary" />
                        <span>Medical Information</span>
                      </h4>
                      <p className="text-sm text-muted-foreground" data-testid="insights-medical">
                        {todaysInsights.medicalDetails}
                      </p>
                    </div>

                    {/* Monitoring Procedures */}
                    {todaysInsights.monitoringProcedures && (
                      <div className="mb-4">
                        <h4 className="font-medium text-card-foreground mb-2 flex items-center space-x-2">
                          <ClipboardList size={14} className="text-sky-500" />
                          <span>Monitoring & Procedures</span>
                        </h4>
                        <p className="text-sm text-muted-foreground" data-testid="insights-monitoring">
                          {todaysInsights.monitoringProcedures}
                        </p>
                      </div>
                    )}

                    {/* Patient Insights */}
                    <div className="mb-4">
                      <h4 className="font-medium text-card-foreground mb-2 flex items-center space-x-2">
                        <Activity size={14} className="text-blue-500" />
                        <span>What to Expect</span>
                      </h4>
                      <p className="text-sm text-muted-foreground" data-testid="insights-patient">
                        {todaysInsights.patientInsights}
                      </p>
                    </div>

                    {/* Tips */}
                    {todaysInsights.tips && todaysInsights.tips.length > 0 && (
                      <div>
                        <h4 className="font-medium text-card-foreground mb-3 flex items-center space-x-2">
                          <Lightbulb size={14} className="text-yellow-500" />
                          <span>Today's Tips</span>
                        </h4>
                        <ul className="space-y-2">
                          {todaysInsights.tips.map((tip: string, index: number) => (
                            <li key={index} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                              <span className="text-sm text-muted-foreground" data-testid={`suggestion-${index}`}>
                                {tip}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              }

              return (
                <p className="text-sm text-muted-foreground" data-testid="insights-no-data">
                  No insights available for the selected date.
                </p>
              );
            })()}
          </Card>
        )}

        {/* Calendar */}
        {!isLoadingCycle && (
          <div id="cycle-calendar" ref={calendarRef}>
            <CycleCalendar activeCycle={activeCycle} />
          </div>
        )}
      </div>
    </div>
  );
}
