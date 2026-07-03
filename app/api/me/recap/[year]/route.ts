import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { getYearlyRecap } from "@/lib/recap";
import { withApiObservability } from "@/lib/http/api-handler";

async function yearlyRecapHandler(request: Request, { params }: { params: Promise<{ year: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { year } = await params;
  const result = await getYearlyRecap(user.id, Number(year));

  if (!result.enabled) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: result.data });
}

export const GET = withApiObservability("me.recap.yearly", yearlyRecapHandler);
