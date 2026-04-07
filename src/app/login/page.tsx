"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter, useSearchParams } from "next/navigation";
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

function LoginForm() {
  const allowPublicSignup =
    process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("error");
    if (!q) return;
    let msg =
      q === "auth"
        ? "Sign-in link expired or invalid. Ask your admin for a new invite."
        : q;
    if (q !== "auth") {
      try {
        msg = decodeURIComponent(q);
      } catch {
        /* keep raw */
      }
    }
    setError(msg);
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="auth-page-bg flex min-h-[100dvh] flex-col items-center justify-center p-6">
      <Card className="relative w-full max-w-sm animate-fade-up border-border/80 shadow-xl ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            Warehouse penalty platform — manager or admin access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {allowPublicSignup ? (
              <>
                New user?{" "}
                <Link href="/signup" className="text-primary underline">
                  Create account
                </Link>
              </>
            ) : (
              <>Need access? Ask an admin to send an invite.</>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page-bg flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
