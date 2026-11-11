"use client";

import * as React from "react";

// Shares the main sidebar's collapsed state with deeper client components (the
// job sub-nav), so the job menu can flip between horizontal (sidebar expanded)
// and vertical (sidebar collapsed). The vertical job menu can itself fold into
// an icon rail (`jobNavCollapsed`), and the layout pads the page to match.
export const SidebarContext = React.createContext<{
  collapsed: boolean;
  jobNavCollapsed: boolean;
  setJobNavCollapsed: (v: boolean) => void;
}>({ collapsed: false, jobNavCollapsed: false, setJobNavCollapsed: () => {} });

export function useSidebar() {
  return React.useContext(SidebarContext);
}
