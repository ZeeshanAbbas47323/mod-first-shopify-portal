import { create } from "zustand";

import {
  fetchMyMenus,
  type MenuPermissions,
  type NavMenuNode,
} from "@/lib/admin-api";

const NO_ACCESS: MenuPermissions = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
};

interface MenuState {
  menus: NavMenuNode[];
  /** Route → permissions, flattened from the tree for O(1) lookups. */
  permissions: Record<string, MenuPermissions>;
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
}

/** Walk the tree into a route → permissions map. */
function flatten(
  nodes: NavMenuNode[],
  into: Record<string, MenuPermissions> = {}
): Record<string, MenuPermissions> {
  for (const node of nodes) {
    // The seed stores the dashboard route in both slug and link_value.
    const route = node.link_value || node.slug;
    if (route) into[route] = node.permissions ?? NO_ACCESS;
    if (node.children?.length) flatten(node.children, into);
  }
  return into;
}

export const useMenuStore = create<MenuState>()((set, get) => ({
  menus: [],
  permissions: {},
  loading: false,
  loaded: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const menus = await fetchMyMenus();
      set({ menus, permissions: flatten(menus), loading: false, loaded: true });
    } catch {
      // A navigation failure must not blank the shell — the sidebar falls back
      // to its built-in list and the user keeps working.
      set({ loading: false, loaded: true });
    }
  },

  reset: () => set({ menus: [], permissions: {}, loading: false, loaded: false }),
}));

/**
 * Permissions for a dashboard route. Falls back to the closest parent route so
 * a detail page like /products/123 inherits what /products grants.
 *
 * Before the menus have loaded this returns full access rather than none, so
 * the UI doesn't flash a disabled state on every page load. The server is the
 * real gate — this only decides what to show.
 */
export function usePermissions(route: string): MenuPermissions {
  const { permissions, loaded } = useMenuStore();

  if (!loaded) {
    return { can_view: true, can_create: true, can_edit: true, can_delete: true };
  }

  let candidate = route;
  while (candidate) {
    const match = permissions[candidate];
    if (match) return match;
    const cut = candidate.lastIndexOf("/");
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
  }
  return permissions["/"] ?? NO_ACCESS;
}
