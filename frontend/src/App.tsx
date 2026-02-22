import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import PinLogin from "./pages/tenant/PinLogin";
import TenantLayout from "./pages/tenant/TenantLayout";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import MeterReading from "./pages/tenant/MeterReading";
import TenantHistory from "./pages/tenant/TenantHistory";
import TenantProfile from "./pages/tenant/TenantProfile";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminReadings from "./pages/admin/AdminReadings";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminMaintenance from "./pages/admin/AdminMaintenance";
import AdminTodos from "./pages/admin/AdminTodos";
import AdminTariffs from "./pages/admin/AdminTariffs";
import AdminROI from "./pages/admin/AdminROI";
import AdminSystem from "./pages/admin/AdminSystem";
import AdminSettings from "./pages/admin/AdminSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/tenant/login" element={<PinLogin />} />
          <Route path="/tenant" element={<TenantLayout />}>
            <Route index element={<TenantDashboard />} />
            <Route path="reading" element={<MeterReading />} />
            <Route path="history" element={<TenantHistory />} />
            <Route path="profile" element={<TenantProfile />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="properties" element={<AdminProperties />} />
            <Route path="readings" element={<AdminReadings />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="maintenance" element={<AdminMaintenance />} />
            <Route path="todos" element={<AdminTodos />} />
            <Route path="tariffs" element={<AdminTariffs />} />
            <Route path="roi" element={<AdminROI />} />
            <Route path="system" element={<AdminSystem />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
