import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  forgotPassword,
  loginAdmin,
  resendVerificationCode,
  resetPassword,
  signupAdmin,
  verifyAdminEmail,
} from "@/lib/api";
import { toast } from "sonner";
import { Bot, Eye, EyeOff, Lock, Mail, Shield, Sparkles } from "lucide-react";
import { SplitScreenShell } from "@/components/layout/SplitScreenShell";
import { MarketingPanel } from "@/components/layout/MarketingPanel";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { SegmentedControl } from "@/components/layout/SegmentedControl";
import { FormPanel } from "@/components/layout/FormPanel";
import { FormField } from "@/components/layout/FormField";

type AuthTab = "login" | "signup";

function authErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : "";
  const normalized = raw.toLowerCase();

  if (!normalized) return fallback;
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "An account with this email already exists. Please log in or use a different email.";
  }
  if (normalized.includes("invalid email or password")) {
    return "Incorrect email or password. Please try again.";
  }
  if (normalized.includes("not verified")) {
    return "Please verify your email before logging in. Check your inbox for a verification code.";
  }
  if (normalized.includes("invalid verification code")) {
    return "That verification code is incorrect. Please check and try again.";
  }
  if (normalized.includes("verification code expired")) {
    return "Your verification code has expired. Request a new one and try again.";
  }
  if (normalized.includes("invalid reset code")) {
    return "That reset code is incorrect. Please check and try again.";
  }
  if (normalized.includes("reset code expired")) {
    return "Your reset code has expired. Request a new one and try again.";
  }
  if (normalized.includes("admin not found")) {
    return "No account found with that email.";
  }
  if (normalized.includes("password must be at least")) {
    return "Password must be at least 8 characters.";
  }
  if (normalized.includes("email, password, and full_name") || normalized.includes("email and password are required")) {
    return "Please fill in all required fields.";
  }
  if (normalized.includes("email and code are required") || normalized.includes("email, code, and new_password")) {
    return "Please fill in all required fields.";
  }
  if (normalized.includes("email is required")) {
    return "Please enter your email address.";
  }
  if (normalized.includes("request failed") || /^status:\s*\d+/i.test(raw)) {
    return fallback;
  }
  return raw || fallback;
}

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode");
  const [tab, setTab] = useState<AuthTab>(initialMode === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotCodeSent, setForgotCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const title = useMemo(
    () => (tab === "login" ? "Admin Login" : "Admin Signup"),
    [tab]
  );

  const handlePostLoginRoute = (role: string, companyId: number | null) => {
    if (role === "super_admin") {
      navigate("/super-admin");
      return;
    }
    // Product flow requirement: always land on Add Company right after auth for admins.
    // If company already exists, Add Company API returns conflict and user can proceed to Add Bot.
    void companyId;
    navigate("/admin/add-company");
  };

  const handleSignup = async () => {
    setIsSubmitting(true);
    try {
      await signupAdmin({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
      toast.success("Account created. Check your email for a verification code.");
      setNeedsVerification(true);
      setTab("login");
    } catch (error) {
      toast.error(authErrorMessage(error, "Could not create your account. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setIsSubmitting(true);
    try {
      const session = await loginAdmin({ email: email.trim(), password });
      toast.success("Welcome back. You're signed in.");
      handlePostLoginRoute(session.admin.role, session.admin.company_id);
    } catch (error) {
      const message = authErrorMessage(error, "Could not sign you in. Please try again.");
      if (message.toLowerCase().includes("verify your email")) {
        setNeedsVerification(true);
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    setIsSubmitting(true);
    try {
      await verifyAdminEmail({ email: email.trim(), code: verificationCode.trim() });
      toast.success("Email verified. You can sign in now.");
      setNeedsVerification(false);
      setVerificationCode("");
    } catch (error) {
      toast.error(authErrorMessage(error, "Could not verify your email. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsSubmitting(true);
    try {
      await resendVerificationCode({ email: email.trim() });
      toast.success("A new verification code has been sent to your email.");
    } catch (error) {
      toast.error(authErrorMessage(error, "Could not resend the verification code. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestResetCode = async () => {
    setIsSubmitting(true);
    try {
      await forgotPassword({ email: forgotEmail.trim() });
      setForgotCodeSent(true);
      toast.success("If that email is registered, a reset code has been sent.");
    } catch (error) {
      toast.error(authErrorMessage(error, "Could not send a reset code. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setIsSubmitting(true);
    try {
      await resetPassword({
        email: forgotEmail.trim(),
        code: resetCode.trim(),
        new_password: newPassword,
      });
      toast.success("Password updated. You can sign in with your new password.");
      setShowForgotPassword(false);
      setForgotCodeSent(false);
      setResetCode("");
      setNewPassword("");
      setPassword("");
      setTab("login");
    } catch (error) {
      toast.error(authErrorMessage(error, "Could not reset your password. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SplitScreenShell
      marketing={
        <MarketingPanel
          eyebrow="Admin access"
          showBrand
          title="Your AI chatbot"
          titleAccent="control center"
          description="Secure admin portal for managing companies, bots, knowledge bases, and embeddable widgets across your organization."
          highlights={[
            {
              icon: Shield,
              title: "Role-based security",
              description: "Company admins and super admins with strict API-enforced boundaries.",
            },
            {
              icon: Bot,
              title: "Bot lifecycle",
              description: "Create, configure, test, and deploy chatbots from one workflow.",
            },
            {
              icon: Sparkles,
              title: "RAG-powered answers",
              description: "Upload documents and let your bot respond with grounded context.",
            },
          ]}
        />
      }
      topBar={
        <AppTopBar
          onBack={() => navigate("/welcome")}
          backLabel="Back to Welcome"
          backShortLabel="Welcome"
          className="mb-0"
        />
      }
    >
      <FormPanel>
        <div className="mb-8">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            {tab === "login" ? "Welcome back. Sign in to your workspace." : "Create your admin account to get started."}
          </p>
        </div>

        <SegmentedControl
          className="mb-8"
          value={tab}
          onChange={setTab}
          options={[
            { value: "login", label: "Login" },
            { value: "signup", label: "Signup" },
          ]}
        />

        <div className="space-y-5">
          {tab === "signup" && (
            <FormField label="Full name">
              <Input
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 text-base"
              />
            </FormField>
          )}
          <FormField label="Email address">
            <Input
              placeholder="you@company.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
            />
          </FormField>
          <FormField
            label="Password"
            labelAction={
              tab === "login" ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword((prev) => !prev);
                    setForgotEmail(email.trim());
                  }}
                  className="text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
                >
                  Forgot password?
                </button>
              ) : undefined
            }
          >
            <div className="relative">
              <Input
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pr-11 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <div className="pt-1">
            <Button
              variant="premium"
              size="lg"
              className="h-12 w-full text-base"
              onClick={tab === "signup" ? handleSignup : handleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Please wait..." : tab === "signup" ? "Create account" : "Login"}
            </Button>
          </div>
        </div>

        {showForgotPassword && (
          <div className="mt-8 rounded-2xl border border-border/60 bg-muted/20 p-5 sm:p-6">
            <div className="mb-5">
              <p className="font-display text-xl font-semibold text-foreground">Forgot password</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Get a reset code via email and set a new password.
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Registered email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRequestResetCode}
                disabled={isSubmitting || !forgotEmail.trim()}
              >
                Send reset code
              </Button>

              {forgotCodeSent && (
                <>
                  <Input
                    placeholder="Reset code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                  />
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="New password (min 8 chars)"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-9 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="premium"
                    className="w-full"
                    onClick={handleResetPassword}
                    disabled={isSubmitting || !resetCode.trim() || newPassword.length < 8}
                  >
                    Reset password
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {needsVerification && (
          <div className="mt-8 space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-5 sm:p-6">
            <p className="text-sm font-medium text-foreground">Verify your email</p>
            <Input
              placeholder="Verification code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="premium" className="flex-1" onClick={handleVerify} disabled={isSubmitting}>
                Verify code
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleResend} disabled={isSubmitting}>
                Resend code
              </Button>
            </div>
          </div>
        )}
      </FormPanel>
    </SplitScreenShell>
  );
};

export default AuthPage;
