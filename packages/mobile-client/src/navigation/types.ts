/**
 * Navigation Types
 *
 * TypeScript type definitions for navigation routes and parameters.
 */

/**
 * Bottom tab navigator route parameter list.
 * Defines the available routes and their parameters.
 */
export type BottomTabParamList = {
  Dashboard: undefined;
  Diffs: undefined;
  Compose: undefined;
  Settings: undefined;
};

/**
 * Navigation route names
 */
export type RouteNames = keyof BottomTabParamList;
