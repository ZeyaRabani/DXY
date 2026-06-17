import { NextResponse } from "next/server";
import { DATASETS, type SourceId } from "@/lib/datasets";
import { runRows, validatePlan } from "@/lib/query";
import type { Filter } from "@/lib/plan";

export const dynamic = "force-dynamic";

interface Body {
  dataset?: string;
  filters?: Filter[];
  page?: number;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
  columns?: string[];
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dataset = body.dataset as SourceId;
  if (!dataset || !DATASETS[dataset]) {
    return NextResponse.json({ error: "Unknown dataset" }, { status: 400 });
  }

  const { filters, issues } = validatePlan({
    dataset,
    filters: body.filters ?? [],
  });

  try {
    const result = await runRows(dataset, filters, {
      columns: body.columns,
      page: body.page,
      pageSize: body.pageSize,
      orderBy: body.orderBy,
      ascending: body.ascending,
    });
    return NextResponse.json({ ...result, issues });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Query failed" },
      { status: 500 },
    );
  }
}
