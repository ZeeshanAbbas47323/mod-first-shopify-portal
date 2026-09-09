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
  permissions: Record<string, MenuPermissions>;
  loading: boolean;
  loaded: boolean;
  failed: boolean;
  load: () => Promise<void>;
  reset: () => void;
}

function flatten(
  nodes: NavMenuNode[],
  into: Record<string, MenuPermissions> = {}
): Record<string, MenuPermissions> {
  for (const node of nodes) {
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
  failed: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const menus = await fetchMyMenus();
      set({ menus, permissions: flatten(menus), loading: false, loaded: true, failed: false });
    } catch {
      set({ loading: false, loaded: true, failed: true });
    }
  },

  reset: () =>
    set({ menus: [], permissions: {}, loading: false, loaded: false, failed: false }),
}));

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
