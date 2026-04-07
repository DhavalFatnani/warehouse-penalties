import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="auth-page-bg flex min-h-[100dvh] flex-col items-center justify-center p-6">
      <Card className="relative w-full max-w-md animate-fade-up border-border/80 shadow-xl ring-1 ring-border/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl tracking-tight">
            Warehouse Penalty Management
          </CardTitle>
          <CardDescription>
            Internal operations console for staff penalties, settlement cycles, and
            imports.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
