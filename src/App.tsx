"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getStoredSession } from "@/lib/api";
import WelcomePage from "./views/WelcomePage.tsx";
import AuthPage from "./views/AuthPage.tsx";
import AddCompanyPage from "./views/AddCompanyPage.tsx";
import AddBotPage from "./views/AddBotPage.tsx";
import AdminBotDashboardPage from "./views/AdminBotDashboardPage.tsx";
import SuperAdminPage from "./views/SuperAdminPage.tsx";
import NotFound from "./views/NotFound.tsx";

const queryClient = new QueryClient();

const HomeRedirect = () => {
  const session = getStoredSession();
  if (!session) return <Navigate to="/welcome" replace />;
  if (session.admin.role === "super_admin") return <Navigate to="/super-admin" replace />;
  if (!session.admin.company_id) return <Navigate to="/admin/add-company" replace />;
  return <Navigate to="/admin/add-bot" replace />;
};

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const session = getStoredSession();
  if (!session) return <Navigate to="/welcome" replace />;
  return children;
};

const PublicOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const session = getStoredSession();
  if (session) return <Navigate to="/" replace />;
  return children;
};

const SuperAdminRoute = ({ children }: { children: JSX.Element }) => {
  const session = getStoredSession();
  if (!session) return <Navigate to="/welcome" replace />;
  if (session.admin.role !== "super_admin") return <Navigate to="/" replace />;
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/welcome" element={<PublicOnlyRoute><WelcomePage /></PublicOnlyRoute>} />
          <Route path="/auth" element={<PublicOnlyRoute><AuthPage /></PublicOnlyRoute>} />
          <Route path="/admin/add-company" element={<ProtectedRoute><AddCompanyPage /></ProtectedRoute>} />
          <Route path="/admin/add-bot" element={<ProtectedRoute><AddBotPage /></ProtectedRoute>} />
          <Route path="/admin/bot/:botId" element={<ProtectedRoute><AdminBotDashboardPage /></ProtectedRoute>} />
          <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminPage /></SuperAdminRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
