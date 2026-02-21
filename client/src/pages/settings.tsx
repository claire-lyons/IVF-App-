import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, LogOut, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { convertJsonToCSV } from "@/lib/jsonToCsv";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<string>("profile");

  // Fetch current user data
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Profile state
  const [firstName, setFirstName] = useState((user as any)?.firstName || "");
  const [lastName, setLastName] = useState((user as any)?.lastName || "");
  const [email, setEmail] = useState((user as any)?.email || "");
  const [phone, setPhone] = useState((user as any)?.phone || "");

  // Sync state with user data when it changes
  useEffect(() => {
    if (user) {
      console.log("[Settings] Syncing form state with user data:", user);
      setFirstName((user as any)?.firstName || "");
      setLastName((user as any)?.lastName || "");
      setEmail((user as any)?.email || "");
      setPhone((user as any)?.phone || "");
      // Load notification preferences from user metadata (default to true if not set)
      setEmailNotifications((user as any)?.emailNotifications !== undefined ? (user as any).emailNotifications : true);
      setPushNotifications((user as any)?.pushNotifications !== undefined ? (user as any).pushNotifications : true);
      setMedicationReminders((user as any)?.medicationReminders !== undefined ? (user as any).medicationReminders : true);
      setAppointmentReminders((user as any)?.appointmentReminders !== undefined ? (user as any).appointmentReminders : true);
      // Load timezone from user metadata (default to Australia/Sydney if not set)
      setTimezone((user as any)?.timezone || "Australia/Sydney");
    }
  }, [user]);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [medicationReminders, setMedicationReminders] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);

  // Timezone
  const [timezone, setTimezone] = useState("Australia/Sydney");

  // Account deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Data export state
  const [isExporting, setIsExporting] = useState(false);

  const handleDeleteDialogChange = (open: boolean) => {
    if (!open && isDeletingAccount) {
      return;
    }

    setShowDeleteDialog(open);
    if (!open) {
      setDeletePassword("");
      setDeleteReason("");
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", "/api/auth/user", data);
      return response.json();
    },
    onSuccess: async (updatedUser) => {
      console.log("[Settings] Profile update successful, received user:", updatedUser);
      // Update the query cache with the new user data
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      // Also invalidate to refetch from server to ensure we have the latest
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Save notification preferences mutation
  const saveNotificationPreferencesMutation = useMutation({
    mutationFn: async (preferences: {
      emailNotifications: boolean;
      pushNotifications: boolean;
      medicationReminders: boolean;
      appointmentReminders: boolean;
    }) => {
      console.log("[Settings] Saving notification preferences:", preferences);
      const response = await apiRequest("PATCH", "/api/auth/user", preferences);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to save preferences");
      }
      const result = await response.json();
      console.log("[Settings] Save response:", result);
      return result;
    },
    onSuccess: async (updatedUser) => {
      console.log("[Settings] Notification preferences saved successfully:", updatedUser);
      // Update the query cache with the new user data
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      // Also invalidate to refetch from server to ensure we have the latest
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been saved successfully.",
      });
    },
    onError: (error: any) => {
      console.error("[Settings] Error saving notification preferences:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save notification preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle saving notification preferences
  const handleSaveNotificationPreferences = () => {
    saveNotificationPreferencesMutation.mutate({
      emailNotifications,
      pushNotifications,
      medicationReminders,
      appointmentReminders,
    });
  };

  // Save timezone mutation
  const saveTimezoneMutation = useMutation({
    mutationFn: async (timezoneValue: string) => {
      console.log("[Settings] Saving timezone:", timezoneValue);
      const response = await apiRequest("PATCH", "/api/auth/user", { timezone: timezoneValue });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to save timezone");
      }
      const result = await response.json();
      console.log("[Settings] Save timezone response:", result);
      return result;
    },
    onSuccess: async (updatedUser) => {
      console.log("[Settings] Timezone saved successfully:", updatedUser);
      // Update the query cache with the new user data
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      // Also invalidate to refetch from server to ensure we have the latest
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Timezone saved",
        description: "Your timezone has been saved successfully.",
      });
    },
    onError: (error: any) => {
      console.error("[Settings] Error saving timezone:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save timezone. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle saving timezone
  const handleSaveTimezone = () => {
    saveTimezoneMutation.mutate(timezone);
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      // Clear query cache first to stop any pending requests
      queryClient.clear();
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear any cached data
      localStorage.clear();
      sessionStorage.clear();
      
      // Small delay to ensure auth state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to login
      setLocation("/login");
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    } catch (error) {
      console.error("Error logging out:", error);
      // Still redirect even if there's an error
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      setLocation("/login");
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Use fetch directly to have better control over error handling
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      console.log("[Export] Starting data export request...");
      const response = await fetch("/api/user/export", {
        method: "GET",
        headers,
        credentials: "include",
      });

      console.log("[Export] Response status:", response.status);
      console.log("[Export] Response headers:", Object.fromEntries(response.headers.entries()));

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Export] Error response body:", errorText.substring(0, 1000));
        throw new Error(`Failed to export data: ${response.status} ${response.statusText}`);
      }

      // Check content type
      const contentType = response.headers.get("content-type") || "";
      console.log("[Export] Content-Type:", contentType);
      
      if (!contentType.includes("application/json")) {
        // Unexpected content type - might be HTML error page
        const text = await response.text();
        console.error("[Export] Unexpected content type. First 1000 chars:", text.substring(0, 1000));
        throw new Error(`Server returned ${contentType} instead of JSON. This might be an HTML error page.`);
      }

      // Parse JSON response
      const jsonData = await response.json();
      console.log("[Export] JSON data received successfully, size:", JSON.stringify(jsonData).length, "bytes");

      // Convert JSON to CSV on frontend
      console.log("[Export] Converting JSON to CSV...");
      const csvContent = convertJsonToCSV(jsonData);
      console.log("[Export] CSV conversion completed, size:", csvContent.length, "bytes");

      // Create CSV blob
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const filename = `foli-data-export-${new Date().toISOString().split("T")[0]}.csv`;

      // Download the file
      const url = URL.createObjectURL(blob);
      
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        link.setAttribute("download", filename);
        
        document.body.appendChild(link);
        
        // Trigger click
        const clickEvent = new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        link.dispatchEvent(clickEvent);
        
        // Clean up after a delay
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        }, 200);
        
        console.log("[Export] Download triggered successfully");
      } catch (downloadError) {
        console.error("[Export] Download method failed, trying alternative:", downloadError);
        // Fallback: open in new window
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      toast({
        title: "Data exported",
        description: "Your data has been downloaded successfully.",
      });
    } catch (error: any) {
      console.error("[Export] Error:", error);
      const errorMessage = error?.message || "Failed to export data. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Unable to delete account. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!deletePassword) {
      toast({
        title: "Password required",
        description: "Please enter your password to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingAccount(true);
    let deletionSuccessful = false;

    try {
      const userEmail = (user as any)?.email || email;

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: deletePassword,
      });

      if (reauthError) {
        throw new Error(reauthError.message || "Invalid password");
      }

      await apiRequest("DELETE", "/api/auth/user", {
        reason: deleteReason.trim() || undefined,
      });

      await supabase.auth.signOut();
      queryClient.clear();

      toast({
        title: "Account deleted",
        description: "Your account and data have been removed.",
      });

      deletionSuccessful = true;
      setLocation("/signup");
    } catch (error: any) {
      toast({
        title: "Deletion failed",
        description: error.message || "We couldn't delete your account. Please check your password and try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAccount(false);
      if (deletionSuccessful) {
        handleDeleteDialogChange(false);
      }
    }
  };

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth/change-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to change password. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleUpdateProfile = () => {
    const updateData = {
      firstName,
      lastName,
      email,
      phone,
    };
    console.log("[Settings] Updating profile with data:", updateData);
    updateProfileMutation.mutate(updateData);
  };

  const handleChangePassword = () => {
    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Please enter your current password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number (10-15 digits)"
                  value={phone}
                  maxLength={15}
                  onChange={(e) => {
                    // Only allow digits, max 15 characters
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 15) {
                      setPhone(value);
                    }
                  }}
                  data-testid="input-phone"
                />
                {phone && phone.replace(/\D/g, '').length > 0 && phone.replace(/\D/g, '').length < 10 && (
                  <p className="text-sm text-muted-foreground">Phone number must be at least 10 digits</p>
                )}
                {phone && phone.replace(/\D/g, '').length > 15 && (
                  <p className="text-sm text-destructive">Phone number must be 15 digits or less</p>
                )}
              </div>
              <Button
                onClick={handleUpdateProfile}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        );

      case "password":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
                <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending}
                data-testid="button-change-password"
              >
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </CardContent>
          </Card>
        );

      case "notifications":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  data-testid="switch-email-notifications"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-notifications">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive push notifications</p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                  data-testid="switch-push-notifications"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="medication-reminders">Medication Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get reminded to take medications</p>
                </div>
                <Switch
                  id="medication-reminders"
                  checked={medicationReminders}
                  onCheckedChange={setMedicationReminders}
                  data-testid="switch-medication-reminders"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="appointment-reminders">Appointment Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get reminded of upcoming appointments</p>
                </div>
                <Switch
                  id="appointment-reminders"
                  checked={appointmentReminders}
                  onCheckedChange={setAppointmentReminders}
                  data-testid="switch-appointment-reminders"
                />
              </div>
              <Button 
                data-testid="button-save-notifications"
                onClick={handleSaveNotificationPreferences}
                disabled={saveNotificationPreferencesMutation.isPending}
              >
                {saveNotificationPreferencesMutation.isPending ? "Saving..." : "Save Preferences"}
              </Button>
            </CardContent>
          </Card>
        );

      case "timezone":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Timezone Settings</CardTitle>
              <CardDescription>Set your timezone for accurate scheduling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone" data-testid="select-timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Australia/Sydney">Sydney (AEDT)</SelectItem>
                    <SelectItem value="Australia/Melbourne">Melbourne (AEDT)</SelectItem>
                    <SelectItem value="Australia/Brisbane">Brisbane (AEST)</SelectItem>
                    <SelectItem value="Australia/Perth">Perth (AWST)</SelectItem>
                    <SelectItem value="Australia/Adelaide">Adelaide (ACDT)</SelectItem>
                    <SelectItem value="Australia/Darwin">Darwin (ACST)</SelectItem>
                    <SelectItem value="Australia/Hobart">Hobart (AEDT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                data-testid="button-save-timezone"
                onClick={handleSaveTimezone}
                disabled={saveTimezoneMutation.isPending}
              >
                {saveTimezoneMutation.isPending ? "Saving..." : "Save Timezone"}
              </Button>
            </CardContent>
          </Card>
        );

      case "account":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Manage your account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Data Export</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Download all of your data in CSV format. This includes your profile, cycles, medications, symptoms, test results, and more. The CSV file can be opened in Excel or Google Sheets.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleExportData}
                    disabled={isExporting}
                    data-testid="button-export-data"
                    className="w-full sm:w-auto"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export My Data"}
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click the button below to sign out of your account. You'll need to log in again to access your data.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={handleLogout}
                    data-testid="button-logout"
                    className="w-full sm:w-auto"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log Out
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-destructive">Danger Zone</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your Foli account and remove all associated data. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  data-testid="button-open-delete-account"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full sm:w-auto"
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <>
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
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>

          <div className="space-y-4">
            {/* Section selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={activeSection === "profile" ? "default" : "outline"}
                onClick={() => setActiveSection("profile")}
                data-testid="button-section-profile"
              >
                Profile
              </Button>
              <Button
                variant={activeSection === "password" ? "default" : "outline"}
                onClick={() => setActiveSection("password")}
                data-testid="button-section-password"
              >
                Password
              </Button>
              <Button
                variant={activeSection === "notifications" ? "default" : "outline"}
                onClick={() => setActiveSection("notifications")}
                data-testid="button-section-notifications"
              >
                Notifications
              </Button>
              <Button
                variant={activeSection === "timezone" ? "default" : "outline"}
                onClick={() => setActiveSection("timezone")}
                data-testid="button-section-timezone"
              >
                Timezone
              </Button>
              <Button
                variant={activeSection === "account" ? "default" : "outline"}
                onClick={() => setActiveSection("account")}
                data-testid="button-section-account"
              >
                Account
              </Button>
            </div>

            {/* Render active section */}
            {renderSection()}
          </div>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={handleDeleteDialogChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            This action is permanent and will remove all of your cycle data, events, and personal information from Foli. Please confirm by entering your password.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-password" data-testid="label-delete-password">Password</Label>
            <Input
              id="delete-password"
              type="password"
              placeholder="Enter your password to confirm"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              data-testid="input-delete-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-reason" data-testid="label-delete-reason">Reason (optional)</Label>
            <Textarea
              id="delete-reason"
              placeholder="Let us know why you're leaving..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              data-testid="textarea-delete-reason"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Note: You will be signed out after deletion. This action cannot be undone.
          </p>
        </div>
        <DialogFooter className="sm:justify-between sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeletingAccount}
            data-testid="button-cancel-delete"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={isDeletingAccount}
            data-testid="button-confirm-delete"
          >
            {isDeletingAccount ? "Deleting..." : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
