import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backend } from "@/lib/data/backend";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — ReviseWise" },
      { name: "description", content: "Set a new password for your ReviseWise account." },
      { property: "og:title", content: "Choose a new password — ReviseWise" },
      { property: "og:description", content: "Set a new password for your ReviseWise account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = backend();
    if (!supabase) {
      toast.error("Accounts are unavailable right now. Please try again later.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("This reset link has expired. Please request a new one.");
      return;
    }
    toast.success("Password updated.");
    void navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={busy}>
              Save new password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
