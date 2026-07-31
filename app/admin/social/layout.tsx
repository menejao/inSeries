import type { PropsWithChildren } from "react";
import { requireAdminUser } from "@/lib/admin/rbac";
import { SocialSubNav } from "@/components/admin/social/social-sub-nav";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — nests under app/admin/layout.tsx (sidebar + admin shell) and
 * adds only the section's own sub-navigation, following the Tabs pattern used elsewhere.
 *
 * `requireAdminUser("admin.social")` is the access gate for every page in this subtree: only ADMIN
 * holds that permission (see lib/admin/rbac.ts), so a MODERATOR who passes middleware's
 * ADMIN|MODERATOR check is redirected to /admin here. Each API route repeats the check with
 * getAdminApiUser("admin.social") — a page gate is never the only gate.
 */
export default async function AdminSocialLayout({ children }: PropsWithChildren) {
  await requireAdminUser("admin.social");

  return (
    <div className="space-y-6">
      <SocialSubNav />
      {children}
    </div>
  );
}
