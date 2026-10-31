'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportResult } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

const TEMPLATE = 'Full Name,Company,Email,Phone,Address,Industry,Type,Status,Source\nJane Doe,Acme Ltd,jane@acme.example,+27 11 555 0100,1 Main Street,Retail,Business,Active,Website\n';

export function ImportCustomersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { base, workspaceId } = useWorkspace();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const upload = useMutation({
    mutationFn: (f: File) => {
      const data = new FormData();
      data.append('file', f);
      return api<ImportResult>(`${base}/customers/import`, { method: 'POST', body: data });
    },
    onSuccess: (r) => {
      setResult(r);
      void client.invalidateQueries({ queryKey: wsKey(workspaceId, 'customers') });
      toast.success(`Imported ${r.created} customer${r.created === 1 ? '' : 's'}`);
    },
  });

  const close = (next: boolean) => {
    if (!next) {
      setFile(null);
      setResult(null);
    }
    onOpenChange(next);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Import customers from CSV"
      description="Up to 5,000 rows and 2 MB. Rows with an email that already exists are skipped."
      footer={
        result ? (
          <Button onClick={() => close(false)}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button disabled={!file} loading={upload.isPending} onClick={() => file && upload.mutate(file)}>
              Import
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3 text-sm" role="status">
          <dl className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">Created</dt>
              <dd className="text-xl font-semibold text-success">{result.created}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">Duplicates skipped</dt>
              <dd className="text-xl font-semibold">{result.skippedDuplicates}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">Errors</dt>
              <dd className="text-xl font-semibold text-destructive">{result.errors.length}</dd>
            </div>
          </dl>
          {result.errors.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-xs">
              {result.errors.map((e) => (
                <li key={e.row}>
                  <span className="font-medium">Row {e.row}:</span> {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/40"
          >
            <FileUp className="h-6 w-6" />
            {file ? <span className="font-medium text-foreground">{file.name}</span> : <span className="whitespace-nowrap">Choose a CSV file</span>}
          </button>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="CSV file"
            data-testid="csv-file-input"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            Required column: <strong>Full Name</strong>. Optional: Company, Email, Phone, Address, Industry, Type, Status, Source.{' '}
            <button type="button" className="font-medium text-primary hover:underline" onClick={downloadTemplate}>
              Download template
            </button>
          </p>
        </div>
      )}
    </Modal>
  );
}
