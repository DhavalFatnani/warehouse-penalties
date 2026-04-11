import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { AuthRecoveryRedirect } from "@/components/auth-recovery-redirect";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  ArrowRight,
  FileSpreadsheet,
  Gavel,
  Sparkles,
  Users,
  Wallet
} from "lucide-react";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <div className="auth-page-bg relative min-h-[100dvh] overflow-hidden px-6 py-10 sm:px-8">
      <AuthRecoveryRedirect />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card className="animate-fade-up border-border/80 bg-background/90 shadow-xl ring-1 ring-border/50 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Operations Control Center
            </div>
            <CardTitle className="text-3xl tracking-tight sm:text-4xl">
              Warehouse payroll
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Run warehouse payroll workflows in one place: maintain staff and
              penalty definitions, apply penalties with structure rules, and run
              settlement cycles with export-ready records.
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" size="sm" asChild>
                <Link href="/dashboard/apply">Apply a penalty</Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/dashboard/settlement">Settlement preview</Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/dashboard/imports">Bulk imports</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            {user ? (
              <Button asChild size="lg" className="sm:w-auto">
                <Link href="/dashboard">
                  Go to dashboard
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="sm:w-auto">
                <Link href="/login">
                  Sign in to continue
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild size="lg" className="sm:w-auto">
              <Link href="/dashboard/staff">View staff directory</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="group border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="space-y-2 pb-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Gavel className="h-4 w-4" aria-hidden />
              </div>
              <CardTitle className="text-base">Apply penalties</CardTitle>
              <CardDescription>
                Use structured penalty definitions tied to staff roles and
                warehouse scope.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="ghost" size="sm" asChild className="px-0">
                <Link href="/dashboard/apply">
                  Open apply flow
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="space-y-2 pb-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" aria-hidden />
              </div>
              <CardTitle className="text-base">Run settlements</CardTitle>
              <CardDescription>
                Filter pending or settled records by date and export CSV for payroll
                handoff.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="ghost" size="sm" asChild className="px-0">
                <Link href="/dashboard/settlement">
                  Open settlement
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="space-y-2 pb-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
              </div>
              <CardTitle className="text-base">Bulk operations</CardTitle>
              <CardDescription>
                Import staff via CSV and keep large directories up to date quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="ghost" size="sm" asChild className="px-0">
                <Link href="/dashboard/imports">
                  Open imports
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="space-y-2 pb-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Users className="h-4 w-4" aria-hidden />
              </div>
              <CardTitle className="text-base">Staff directory</CardTitle>
              <CardDescription>
                Quickly search employees, role types, and sites in one compact
                view.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="ghost" size="sm" asChild className="px-0">
                <Link href="/dashboard/staff">
                  Open directory
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
