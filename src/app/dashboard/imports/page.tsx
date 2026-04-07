export default function PenaltyImportsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Penalty imports
        </h1>
        <p className="text-sm text-muted-foreground">
          Bulk import of penalty records (CSV) will be added here in a future
          update.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        For now, use <span className="text-foreground">Apply penalty</span> or{" "}
        <span className="text-foreground">Penalty records</span> to manage
        penalties.
      </p>
    </div>
  );
}
