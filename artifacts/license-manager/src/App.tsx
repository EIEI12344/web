import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setupFetchInterceptor } from "@/lib/fetch-interceptor";
import { useAuthWrapper } from "@/hooks/use-auth-wrapper";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import AppDetails from "@/pages/app-details";
import AdminDashboard from "@/pages/admin";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Setup global auth interceptor
setupFetchInterceptor();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { user, isLoading, isAuthenticated } = useAuthWrapper();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation('/login');
      } else if (adminOnly && user?.role !== 'admin') {
        setLocation('/dashboard');
      } else if (!adminOnly && user?.role === 'admin' && location !== '/admin') {
        // Optional: Keep admins exclusively in admin dashboard
      }
    }
  }, [isLoading, isAuthenticated, user, setLocation, adminOnly]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || (adminOnly && user?.role !== 'admin')) {
    return null;
  }

  return <Component />;
}

function Router() {
  const [, setLocation] = useLocation();

  // Redirect root to login
  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === import.meta.env.BASE_URL) {
      setLocation('/login');
    }
  }, [setLocation]);

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      
      <Route path="/apps/:appId">
        {() => <ProtectedRoute component={AppDetails} />}
      </Route>

      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} adminOnly={true} />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
