import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { getMonthlyRecap } from "@/lib/recap";
import { withApiObservability } from "@/lib/http/api-handler";

async function monthlyRecapHandler(request: Request, { params }: { params: Promise<{ year: string; month: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { year, month } = await params;
  const result = await getMonthlyRecap(user.id, Number(year), Number(month));

  if (!result.enabled) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: result.data });
}

export const GET = withApiObservability("me.recap.monthly", monthlyRecapHandler);
