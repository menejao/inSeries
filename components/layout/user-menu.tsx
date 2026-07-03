"use client";

import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { LogoutMenuItem } from "@/components/auth/logout-button";
import { ThemeMenuItems } from "@/components/theme/theme-menu-items";
import { SettingsIcon, UserIcon } from "@/components/ui/icons";
import { getInitials } from "@/lib/utils";

/** Fase 6/10 — profile/account/theme/logout all live here now; nothing profile-related takes up Sidebar space. */
export function UserMenu({
  name,
  username,
  avatarUrl,
  roleLabel
}: {
  name: string;
  username: string;
  avatarUrl?: string | null;
  roleLabel?: string | null;
}) {
  return (
    <Dropdown
      trigger={
        <button type="button" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-surface-strong active:scale-95" aria-label={`Menu de ${name}`}>
          <Avatar label={getInitials(name)} name={name} src={avatarUrl} size="sm" />
          <span className="hidden text-left sm:block">
            <span className="block max-w-[9rem] truncate text-sm font-semibold leading-tight text-ink">{name}</span>
            {roleLabel ? <span className="block text-xs leading-tight text-subtle">{roleLabel}</span> : null}
          </span>
        </button>
      }
    >
      <div className="px-3 py-2">
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        <p className="truncate text-xs text-muted">@{username}</p>
      </div>
      <DropdownSeparator />
      <DropdownItem href={`/profile/${username}`}>
        <UserIcon className="h-4 w-4" />
        Meu perfil
      </DropdownItem>
      <DropdownItem href="/settings">
        <SettingsIcon className="h-4 w-4" />
        Configuracoes
      </DropdownItem>
      <DropdownSeparator />
      <div className="px-3 pb-1 pt-2">
        <p className="eyebrow">Tema</p>
      </div>
      <ThemeMenuItems />
      <DropdownSeparator />
      <LogoutMenuItem />
    </Dropdown>
  );
}
