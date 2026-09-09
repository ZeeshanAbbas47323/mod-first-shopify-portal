"use client";

import * as React from "react";
import { ExportMenu } from "@/components/export-menu";
import type { ExportColumn } from "@/lib/export";

interface Row {
  name: string;
  qty: number;
}

const rows: Row[] = [
  { name: "Alpha", qty: 3 },
  { name: "Beta", qty: 7 },
];

const columns: ExportColumn<Row>[] = [
  { key: "name", label: "Name", value: (r) => r.name },
  { key: "qty", label: "Qty", value: (r) => r.qty },
];

export default function ExportTestPage() {
  return (
    <div className="flex gap-8 p-10">
      <div>
        <p id="label-none">no selection</p>
        <ExportMenu
          filename="verify"
          columns={columns}
          fetchAll={async () => rows}
          total={rows.length}
          noun="row"
        />
      </div>
      <div>
        <p id="label-some">with selection</p>
        <ExportMenu
          filename="verify"
          columns={columns}
          selected={rows}
          fetchAll={async () => rows}
          total={rows.length}
          noun="row"
        />
      </div>
    </div>
  );
}
