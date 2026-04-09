/**
 * Icon Component
 *
 * A wrapper component for Material Icons with design system integration.
 * Supports customization of size, color, fill, and weight.
 *
 * Requirements: 10.7, 18.11, 18.12
 */

import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDesignSystem } from '../theme/useDesignSystem';
import { ColorTokens } from '../tokens';

/**
 * Icon weight variants (Material Icons supports limited weights)
 */
export type IconWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700;

/**
 * Material Icons name type
 */
export type IconName = keyof typeof MaterialIcons.glyphMap;

export interface IconProps {
  /**
   * Material Icons icon name
   */
  name: IconName;

  /**
   * Icon size in pixels
   * @default 24
   */
  size?: number;

  /**
   * Icon color - can be a design token key or hex color
   * @default 'onSurface'
   */
  color?: keyof ColorTokens | string;

  /**
   * Fill style (Material Icons doesn't support variable fill, but we keep for API consistency)
   * @default false
   */
  fill?: boolean;

  /**
   * Icon weight (Material Icons uses regular weight by default)
   * @default 400
   */
  weight?: IconWeight;

  /**
   * Custom style overrides
   */
  style?: StyleProp<TextStyle>;
}

/**
 * Icon component wrapping Material Icons with design system integration
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = 'onSurface',
  fill: _fill = false,
  weight: _weight = 400,
  style,
}) => {
  const { theme } = useDesignSystem();

  /**
   * Resolve color from design token or use as-is
   */
  const resolveColor = (): string => {
    // Check if color is a design token key
    if (color in theme.colors) {
      return theme.colors[color as keyof ColorTokens];
    }
    // Otherwise use as hex color
    return color;
  };

  const iconColor = resolveColor();

  /**
   * Note: Material Icons from @expo/vector-icons doesn't support variable fill or weight
   * like Material Symbols. These props are included for API consistency and future compatibility.
   * For now, they don't affect the rendering but can be used for conditional logic if needed.
   */

  return <MaterialIcons name={name} size={size} color={iconColor} style={style} />;
};

/**
 * Common icon names used in the app
 * This provides type-safe shortcuts for frequently used icons
 */
export const IconNames = {
  // Navigation
  home: 'home' as IconName,
  settings: 'settings' as IconName,

  // Actions
  send: 'send' as IconName,
  close: 'close' as IconName,
  check: 'check' as IconName,
  add: 'add' as IconName,
  remove: 'remove' as IconName,
  edit: 'edit' as IconName,
  delete: 'delete' as IconName,
  refresh: 'refresh' as IconName,
  search: 'search' as IconName,

  // Status
  checkCircle: 'check-circle' as IconName,
  error: 'error' as IconName,
  warning: 'warning' as IconName,
  info: 'info' as IconName,

  // Files and folders
  folder: 'folder' as IconName,
  folderOpen: 'folder-open' as IconName,
  insertDriveFile: 'insert-drive-file' as IconName,

  // Code and development
  code: 'code' as IconName,
  terminal: 'terminal' as IconName,

  // Time
  schedule: 'schedule' as IconName,

  // UI elements
  arrowBack: 'arrow-back' as IconName,
  arrowForward: 'arrow-forward' as IconName,
  arrowDropDown: 'arrow-drop-down' as IconName,
  arrowDropUp: 'arrow-drop-up' as IconName,
  menu: 'menu' as IconName,
  moreVert: 'more-vert' as IconName,
  moreHoriz: 'more-horiz' as IconName,

  // Media
  playArrow: 'play-arrow' as IconName,
  pause: 'pause' as IconName,
  stop: 'stop' as IconName,

  // Communication
  notifications: 'notifications' as IconName,
  notificationsOff: 'notifications-off' as IconName,

  // Misc
  lightbulb: 'lightbulb' as IconName,
  help: 'help' as IconName,
  link: 'link' as IconName,
  attach: 'attach-file' as IconName,
  visibility: 'visibility' as IconName,
  visibilityOff: 'visibility-off' as IconName,
} as const;
