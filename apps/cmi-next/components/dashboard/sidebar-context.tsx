"use client";

import * as React from "react";

// Shares the main sidebar's collapsed state with deeper client components (the
// job sub-nav), so the job menu can flip between horizontal (sidebar expanded)
// and vertical (sidebar collapsed).
export const SidebarContext = React.createContext<{ collapsed: boolean }>({ collapsed: false });

export function useSidebar() {
  return React.useContext(SidebarContext);
}
