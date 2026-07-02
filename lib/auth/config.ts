export const authCapabilities = {
  login: true,
  register: true,
  passwordRecovery: true,
  accountManagement: true
} as const;

export function hashPasswordPlaceholder(password: string) {
  return `hash::${password.length}`;
}
