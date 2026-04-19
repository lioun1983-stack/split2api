import { useState } from "react";
import { StatsCards } from "@/components/StatsCards";
import { KeysTable } from "@/components/KeysTable";
import { AddKeyDialog } from "@/components/AddKeyDialog";
import { ImportKeysDialog } from "@/components/ImportKeysDialog";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";

export function Dashboard() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage and monitor your developer keys</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setIsImportOpen(true)} data-testid="button-import-keys">
              <Download className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={() => setIsAddOpen(true)} data-testid="button-add-key">
              <Plus className="mr-2 h-4 w-4" />
              Add Key
            </Button>
          </div>
        </div>

        <StatsCards />
        
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <KeysTable />
        </div>

        <AddKeyDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
        <ImportKeysDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      </div>
    </div>
  );
}
