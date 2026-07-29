import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { withApiObservability } from "@/lib/http/api-handler";
import { listSupportRequests } from "@/lib/supporters/admin";

async function listHandler() {
  const admin = await getAdminApiUser("admin.supporters");
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const requests = await listSupportRequests();
  return NextResponse.json({ data: requests });
}

export const GET = withApiObservability("admin.support-requests.list", listHandler);
