import { PenaltyBulkImportPanel } from "@/components/penalty-bulk-import-panel";

export default function PenaltyImportsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Penalty imports
        </h1>
        <p className="text-sm text-muted-foreground">
          Bulk import of penalty records (CSV).
        </p>
      </div>
      <PenaltyBulkImportPanel />
    </div>
  );
}
