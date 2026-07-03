"use client";

import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { LogoutMenuItem } from "@/components/auth/logout-button";
import { SettingsIcon, UserIcon } from "@/components/ui/icons";
import { getInitials } from "@/lib/utils";

export function UserMenu({ name, username, avatarUrl }: { name: string; username: string; avatarUrl?: string | null }) {
  return (
    <Dropdown
      trigger={
        <button type="button" className="rounded-full transition active:scale-95" aria-label={`Menu de ${name}`}>
          <Avatar label={getInitials(name)} name={name} src={avatarUrl} size="sm" />
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
      <LogoutMenuItem />
    </Dropdown>
  );
}
