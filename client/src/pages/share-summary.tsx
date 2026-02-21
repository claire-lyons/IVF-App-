import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface CycleSummary {
  cycle: any;
  medications: any[];
  symptoms: any[];
  testResults: any[];
  milestones: any[];
  appointments: any[];
  events: any[];
}

export default function ShareSummary() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token;
  const [summary, setSummary] = useState<CycleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        // Get session for API call (but this endpoint doesn't require auth)
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/summary/share/${token}`, {
          headers,
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to load summary");
        }

        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error("Error fetching summary:", err);
        setError(err instanceof Error ? err.message : "Failed to load summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [token]);

  const handleDownload = async (format: "pdf" | "csv") => {
    if (!token) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/summary/share/${token}?export=${format}`, {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = `cycle-summary.${format}`;
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
      console.error("Error downloading:", error);
      toast({
        title: "Download failed",
        description: "Unable to download the summary. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleOpenInBrowser = async () => {
    if (!token) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/summary/share/${token}?format=html`, {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to open summary");
      }

      const html = await response.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 100);

      toast({
        title: "Summary opened",
        description: "The summary has been opened in a new window.",
      });
    } catch (error) {
      console.error("Error opening summary:", error);
      toast({
        title: "Error",
        description: "Failed to open summary. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateTime = (date: string | Date | null | undefined): string => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6">
          <h1 className="text-2xl font-bold mb-4">Summary Not Available</h1>
          <p className="text-muted-foreground">{error || "The summary you're looking for could not be found."}</p>
          <p className="text-sm text-muted-foreground mt-4">
            The link may have expired or been invalidated. Please contact the person who shared this link.
          </p>
        </Card>
      </div>
    );
  }

  const { cycle, medications, symptoms, testResults, milestones, appointments, events } = summary;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Treatment Cycle Summary Report</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Shared cycle summary • {formatDate(new Date())}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleOpenInBrowser()}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Browser
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownload("pdf")}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownload("csv")}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Cycle Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Cycle Type</p>
              <p className="font-medium">{cycle.type?.toUpperCase() || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{cycle.status || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">{formatDate(cycle.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-medium">{cycle.endDate ? formatDate(cycle.endDate) : "Ongoing"}</p>
            </div>
            {cycle.result && (
              <div>
                <p className="text-sm text-muted-foreground">Result</p>
                <p className="font-medium capitalize">{cycle.result}</p>
              </div>
            )}
            {cycle.clinic && (
              <div>
                <p className="text-sm text-muted-foreground">Clinic</p>
                <p className="font-medium">{cycle.clinic}</p>
              </div>
            )}
          </div>
          {cycle.notes && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">Notes:</p>
              <p className="text-sm">{cycle.notes}</p>
            </div>
          )}
        </Card>

        {milestones.length > 0 && (
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Milestones ({milestones.length})</h2>
            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.id} className="border-b pb-3 last:border-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{m.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Expected: {formatDate(m.date)} • Status: <span className="capitalize">{m.status}</span>
                      </p>
                      {m.notes && <p className="text-sm text-muted-foreground mt-1">{m.notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {medications.length > 0 && (
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Medications ({medications.length})</h2>
            <div className="space-y-3">
              {medications.map((m) => (
                <div key={m.id} className="border-b pb-3 last:border-0">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.dosage} • {m.frequency} • {m.time || "As needed"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(m.startDate)} - {m.endDate ? formatDate(m.endDate) : "Ongoing"}
                  </p>
                  {m.notes && <p className="text-sm text-muted-foreground mt-1">{m.notes}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {testResults.length > 0 && (
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Test Results ({testResults.length})</h2>
            <div className="space-y-3">
              {testResults.map((t) => (
                <div key={t.id} className="border-b pb-3 last:border-0">
                  <p className="font-medium">{t.name} ({t.type})</p>
                  <p className="text-sm text-muted-foreground">
                    Date: {formatDate(t.date)} • Value: {t.value || "N/A"} {t.unit || ""}
                  </p>
                  {t.referenceRange && (
                    <p className="text-sm text-muted-foreground">Reference: {t.referenceRange}</p>
                  )}
                  {t.notes && <p className="text-sm text-muted-foreground mt-1">{t.notes}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {appointments.length > 0 && (
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Appointments ({appointments.length})</h2>
            <div className="space-y-3">
              {appointments.map((a) => (
                <div key={a.id} className="border-b pb-3 last:border-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(a.date)} • {a.type}
                  </p>
                  {a.location && <p className="text-sm text-muted-foreground">Location: {a.location}</p>}
                  {a.doctorName && <p className="text-sm text-muted-foreground">Doctor: {a.doctorName}</p>}
                  {a.notes && <p className="text-sm text-muted-foreground mt-1">{a.notes}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {events.length > 0 && (
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Events & Notes ({events.length})</h2>
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="border-b pb-3 last:border-0">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(e.date)} • {e.eventType}
                  </p>
                  {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
                  {e.doctorNotes && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium">Doctor Notes:</span> {e.doctorNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 mt-4">
          <p className="text-sm text-muted-foreground text-center">
            This report was generated by Foli - Your fertility journey companion
          </p>
          <p className="text-xs text-muted-foreground text-center mt-2">
            For medical advice, please consult your healthcare provider
          </p>
        </Card>
      </div>
    </div>
  );
}

