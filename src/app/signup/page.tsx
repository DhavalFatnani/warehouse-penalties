"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function SignupPage() {
  const allowPublicSignup =
    process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allowPublicSignup) {
      setError(
        "Public signup is disabled. Ask an admin to invite your account."
      );
      return;
    }
    setError(null);
    setStatus(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      setStatus("Signup successful. Redirecting to dashboard...");
      window.location.assign("/dashboard");
      return;
    }

    setStatus("Signup successful. Check your email to confirm your account.");
  }

  return (
    <div className="auth-page-bg flex min-h-[100dvh] flex-col items-center justify-center p-6">
      <Card className="relative w-full max-w-sm animate-fade-up border-border/80 shadow-xl ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Create account</CardTitle>
          <CardDescription>
            Manager access to the warehouse penalty platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!allowPublicSignup ? (
            <p className="mb-4 text-sm text-muted-foreground">
              Public signup is disabled in this environment. Ask an admin for an
              invite.
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={!allowPublicSignup}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!allowPublicSignup}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                disabled={!allowPublicSignup}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {status ? (
              <p className="text-sm text-muted-foreground" role="status">
                {status}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={!allowPublicSignup}
            >
              Sign up
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
