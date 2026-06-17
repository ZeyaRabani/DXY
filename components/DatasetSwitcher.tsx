"use client";

import { useState } from "react";
import DataExplorer from "@/components/DataExplorer";
import { V2_DATASETS, DATASETS, type DatasetId } from "@/lib/datasets";

export default function DatasetSwitcher() {
  const [dataset, setDataset] = useState<DatasetId>("daily");
  return (
    <div className="space-y-4">
      <div className="flex items-center rounded-md border border-border bg-panel p-0.5 text-sm w-fit">
        {V2_DATASETS.map((id) => (
          <button
            key={id}
            onClick={() => setDataset(id)}
            className={`rounded px-3 py-1.5 capitalize ${
              dataset === id ? "bg-panel-2 text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {DATASETS[id].label}
          </button>
        ))}
      </div>
      <DataExplorer key={dataset} dataset={dataset} />
    </div>
  );
}
