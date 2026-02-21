import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Home from "@/pages/home";
import Onboarding from "@/pages/onboarding";
import Tracking from "@/pages/tracking";
import Doctors from "@/pages/doctors";
import DoctorDetail from "@/pages/doctor-detail";
import AddDoctor from "@/pages/add-doctor";
import Community from "@/pages/community";
import Chat from "@/pages/chat";
import Settings from "@/pages/settings";
import About from "@/pages/about";
import Help from "@/pages/help";
import FAQs from "@/pages/faqs";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import EducationPage, { ArticleViewPage } from "@/pages/education";
import EventsPage from "@/pages/events";
import ShareSummary from "@/pages/share-summary";
import Messages from "@/pages/messages";
import Layout from "@/components/layout";

function Router() {
  const { isAuthenticated, isLoading, user } = useSupabaseAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, clear any pending queries to prevent errors
  if (!isAuthenticated) {
    queryClient.clear();
  }

  return (
    <Switch>
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/share/:token" component={ShareSummary} />
      {!isAuthenticated ? (
        <>
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/" component={Login} />
        </>
      ) : (
        <>
          {user && (user as any).user_metadata?.onboarding_completed !== true ? (
            <Route path="/" component={Onboarding} />
          ) : (
            <Layout>
              <Route path="/" component={Home} />
              <Route path="/tracking" component={Tracking} />
              <Route path="/events" component={EventsPage} />
              <Route path="/doctors" component={Doctors} />
              <Route path="/doctors/:id" component={DoctorDetail} />
              <Route path="/add-doctor" component={AddDoctor} />
              <Route path="/community" component={Community} />
              <Route path="/chat" component={Chat} />
              <Route path="/messages" component={Messages} />
              <Route path="/education" component={EducationPage} />
              <Route path="/education/:slug" component={ArticleViewPage} />
              <Route path="/settings" component={Settings} />
              <Route path="/about" component={About} />
              <Route path="/help" component={Help} />
              <Route path="/faqs" component={FAQs} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/terms" component={Terms} />
            </Layout>
          )}
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
