import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/app/GoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Sign in — ReviseWise" },
      {
        name: "description",
        content: "Sign in to ReviseWise to save your tasks, revision plans, quiz scores and chats.",
      },
      { property: "og:title", content: "Sign in — ReviseWise" },
      {
        property: "og:description",
        content: "Save your study progress to your ReviseWise account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "sign-in" | "sign-up" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in didn't work. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    toast.success("Signed in — your progress is saved to your account.");
    void navigate({ to: "/" });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in — your progress is saved to your account.");
        void navigate({ to: "/" });
      } else if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          void navigate({ to: "/" });
        } else {
          setNotice("Check your email and click the link to confirm your account, then sign in.");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If that email has an account, a link to reset your password is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create your account" : "Reset your password";

  return (
    <div className="mx-auto max-w-md py-6">
      <Card>
        <CardHeader>
          <h1 className="font-display text-xl font-semibold leading-tight tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Your tasks, revision plans, quiz scores, streaks and AI Companion chats are saved to your
            account so they're there on any device.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {mode !== "forgot" && (
            <>
              <GoogleButton onClick={() => void google()} disabled={busy} />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {notice && <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">{notice}</p>}
            <Button type="submit" variant="hero" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Send reset link"}
            </Button>
          </form>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            {mode === "sign-in" ? (
              <>
                <button type="button" className="text-primary-glow hover:underline" onClick={() => setMode("sign-up")}>
                  New here? Create an account
                </button>
                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              </>
            ) : (
              <button type="button" className="text-primary-glow hover:underline" onClick={() => setMode("sign-in")}>
                Already have an account? Sign in
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
