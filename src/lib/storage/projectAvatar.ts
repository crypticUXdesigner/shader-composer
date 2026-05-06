/**
 * Local project row appearance (avatar): node icon + bg + icon color from design tokens.
 */

import type { NodeIconIdentifier } from '../../utils/iconsNodeRegistry';
import type { ProjectMeta } from './projectRepository';
import { PROJECT_AVATAR_NODE_ICONS } from './projectAvatarIcons';
export { PROJECT_AVATAR_NODE_ICONS } from './projectAvatarIcons';

/**
 * Single user-facing palette for both background and icon colors.
 * The picker should offer the exact same options for both fields.
 */
export const PROJECT_AVATAR_COLOR_TOKENS = [
  // 12 hues as base.
  // First: 12× "-gray" in -50, then -70, -90, -110, -130. Then the same for the non "-gray" version.

  // -gray-50
  'blue-gray-50',
  'cyan-gray-50',
  'teal-gray-50',
  'leaf-gray-50',
  'yellow-gray-50',
  'orange-gray-50',
  'orange-red-gray-50',
  'red-gray-50',
  'red-purple-gray-50',
  'purple-gray-50',
  'violet-gray-50',
  'red-orange-gray-50',

  // -gray-70
  'blue-gray-70',
  'cyan-gray-70',
  'teal-gray-70',
  'leaf-gray-70',
  'yellow-gray-70',
  'orange-gray-70',
  'orange-red-gray-70',
  'red-gray-70',
  'red-purple-gray-70',
  'purple-gray-70',
  'violet-gray-70',
  'red-orange-gray-70',

  // -gray-90
  'blue-gray-90',
  'cyan-gray-90',
  'teal-gray-90',
  'leaf-gray-90',
  'yellow-gray-90',
  'orange-gray-90',
  'orange-red-gray-90',
  'red-gray-90',
  'red-purple-gray-90',
  'purple-gray-90',
  'violet-gray-90',
  'red-orange-gray-90',

  // -gray-110
  'blue-gray-110',
  'cyan-gray-110',
  'teal-gray-110',
  'leaf-gray-110',
  'yellow-gray-110',
  'orange-gray-110',
  'orange-red-gray-110',
  'red-gray-110',
  'red-purple-gray-110',
  'purple-gray-110',
  'violet-gray-110',
  'red-orange-gray-110',

  // -gray-130
  'blue-gray-130',
  'cyan-gray-130',
  'teal-gray-130',
  'leaf-gray-130',
  'yellow-gray-130',
  'orange-gray-130',
  'orange-red-gray-130',
  'red-gray-130',
  'red-purple-gray-130',
  'purple-gray-130',
  'violet-gray-130',
  'red-orange-gray-130',

  // -50
  'blue-50',
  'cyan-50',
  'teal-50',
  'leaf-50',
  'yellow-50',
  'orange-50',
  'orange-red-50',
  'red-50',
  'red-purple-50',
  'purple-50',
  'violet-50',
  'red-orange-50',

  // -70
  'blue-70',
  'cyan-70',
  'teal-70',
  'leaf-70',
  'yellow-70',
  'orange-70',
  'orange-red-70',
  'red-70',
  'red-purple-70',
  'purple-70',
  'violet-70',
  'red-orange-70',

  // -90
  'blue-90',
  'cyan-90',
  'teal-90',
  'leaf-90',
  'yellow-90',
  'orange-90',
  'orange-red-90',
  'red-90',
  'red-purple-90',
  'purple-90',
  'violet-90',
  'red-orange-90',

  // -110
  'blue-110',
  'cyan-110',
  'teal-110',
  'leaf-110',
  'yellow-110',
  'orange-110',
  'orange-red-110',
  'red-110',
  'red-purple-110',
  'purple-110',
  'violet-110',
  'red-orange-110',

  // -130
  'blue-130',
  'cyan-130',
  'teal-130',
  'leaf-130',
  'yellow-130',
  'orange-130',
  'orange-red-130',
  'red-130',
  'red-purple-130',
  'purple-130',
  'violet-130',
  'red-orange-130',
] as const;

export type ProjectAvatarColorToken = (typeof PROJECT_AVATAR_COLOR_TOKENS)[number];
export type ProjectAvatarBgToken = ProjectAvatarColorToken;
export type ProjectAvatarIconColorToken = ProjectAvatarColorToken;

const TOKEN_SET = new Set<string>(PROJECT_AVATAR_COLOR_TOKENS);
const ICON_SET = new Set<string>(PROJECT_AVATAR_NODE_ICONS);

/** Matches pre-avatar `ProjectListItem` look (tinted tile + neutral glyph). */
export const DEFAULT_PROJECT_AVATAR_NODE_ICON: NodeIconIdentifier = 'sphere';
export const DEFAULT_PROJECT_AVATAR_BG_TOKEN: ProjectAvatarBgToken = 'orange-red-gray-50';
export const DEFAULT_PROJECT_AVATAR_ICON_COLOR_TOKEN: ProjectAvatarIconColorToken = 'blue-gray-130';

export interface ProjectAvatarFields {
  avatarNodeIcon: NodeIconIdentifier;
  avatarBgToken: ProjectAvatarBgToken;
  avatarIconColorToken: ProjectAvatarIconColorToken;
}

/** Full rows for new projects — one picked at random on create. */
export const PROJECT_AVATAR_PRESETS: readonly ProjectAvatarFields[] = [
  // Gray backgrounds → solid light icons
  { avatarNodeIcon: 'sphere', avatarBgToken: 'orange-red-gray-50', avatarIconColorToken: 'orange-red-130' },
  { avatarNodeIcon: 'hexagon', avatarBgToken: 'teal-gray-70', avatarIconColorToken: 'teal-130' },
  { avatarNodeIcon: 'waves', avatarBgToken: 'cyan-gray-70', avatarIconColorToken: 'cyan-130' },
  { avatarNodeIcon: 'ripple', avatarBgToken: 'blue-gray-70', avatarIconColorToken: 'blue-130' },
  { avatarNodeIcon: 'kaleidoscope', avatarBgToken: 'purple-gray-70', avatarIconColorToken: 'purple-130' },
  { avatarNodeIcon: 'blur-circle', avatarBgToken: 'red-purple-gray-70', avatarIconColorToken: 'red-purple-130' },
  { avatarNodeIcon: 'noise', avatarBgToken: 'violet-gray-70', avatarIconColorToken: 'violet-130' },
  { avatarNodeIcon: 'sunrise', avatarBgToken: 'yellow-gray-70', avatarIconColorToken: 'yellow-130' },
  { avatarNodeIcon: 'atom-2', avatarBgToken: 'leaf-gray-70', avatarIconColorToken: 'leaf-130' },
  { avatarNodeIcon: 'cube', avatarBgToken: 'orange-gray-70', avatarIconColorToken: 'orange-130' },

  // Solid backgrounds → gray-tinted light icons (keeps glyph legible without “white”)
  { avatarNodeIcon: 'gradient', avatarBgToken: 'teal-70', avatarIconColorToken: 'teal-gray-130' },
  { avatarNodeIcon: 'glow', avatarBgToken: 'cyan-70', avatarIconColorToken: 'cyan-gray-130' },
  { avatarNodeIcon: 'infinity', avatarBgToken: 'blue-70', avatarIconColorToken: 'blue-gray-130' },
  { avatarNodeIcon: 'rings', avatarBgToken: 'purple-70', avatarIconColorToken: 'purple-gray-130' },
  { avatarNodeIcon: 'sparkles-2', avatarBgToken: 'red-70', avatarIconColorToken: 'red-gray-130' },
  { avatarNodeIcon: 'spiral', avatarBgToken: 'violet-70', avatarIconColorToken: 'violet-gray-130' },
  { avatarNodeIcon: 'topology-star-ring', avatarBgToken: 'yellow-70', avatarIconColorToken: 'yellow-gray-130' },
  { avatarNodeIcon: 'ikosaedr', avatarBgToken: 'leaf-70', avatarIconColorToken: 'leaf-gray-130' },
];

export function pickRandomProjectAvatarPreset(): ProjectAvatarFields {
  const i = Math.floor(Math.random() * PROJECT_AVATAR_PRESETS.length);
  return PROJECT_AVATAR_PRESETS[i] ?? PROJECT_AVATAR_PRESETS[0]!;
}

export function projectAvatarColorVar(token: string): string {
  return `var(--color-${token})`;
}

function isNodeIconAllowed(id: string): id is NodeIconIdentifier {
  return ICON_SET.has(id);
}

function isBgToken(id: string): id is ProjectAvatarBgToken {
  return TOKEN_SET.has(id);
}

function isFgToken(id: string): id is ProjectAvatarIconColorToken {
  return TOKEN_SET.has(id);
}

/** Normalize stored meta to safe token + icon values (legacy rows → defaults). */
export function resolveProjectAvatar(meta: Partial<ProjectMeta> | undefined): ProjectAvatarFields {
  const rawIcon = meta?.avatarNodeIcon?.trim();
  const rawBg = meta?.avatarBgToken?.trim();
  const rawFg = meta?.avatarIconColorToken?.trim();
  // `grain`, `noise`, and `particle` are aliases of the same rendered Phosphor icon.
  // The avatar picker whitelist intentionally de-dupes by render identity, so only one
  // of these identifiers will be allowed. Normalize all legacy/stored values to the
  // allowed one so the choice is selectable + round-trips reliably.
  const normalizedIcon = rawIcon === 'noise' || rawIcon === 'particle' ? 'grain' : rawIcon;

  return {
    avatarNodeIcon:
      normalizedIcon && isNodeIconAllowed(normalizedIcon) ? normalizedIcon : DEFAULT_PROJECT_AVATAR_NODE_ICON,
    avatarBgToken: rawBg && isBgToken(rawBg) ? rawBg : DEFAULT_PROJECT_AVATAR_BG_TOKEN,
    avatarIconColorToken:
      rawFg && isFgToken(rawFg) ? rawFg : DEFAULT_PROJECT_AVATAR_ICON_COLOR_TOKEN,
  };
}
