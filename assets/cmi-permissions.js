(function (window) {
  'use strict';

  const ROLE_DASHBOARDS = {
    super_admin: '/dashboard/admin',
    staff: '/dashboard/staff',
    subcontractor: '/dashboard/subcontractor',
    vendor: '/dashboard/vendor',
    client: '/dashboard/client',
  };

  const ROLE_LABELS = {
    super_admin: 'Super Admin',
    staff: 'Staff',
    subcontractor: 'Subcontractor',
    vendor: 'Vendor',
    client: 'Client',
  };

  const SUPER_ADMIN_EMAILS = new Set([
    'jeremy@constructedmatter.com',
    'brandon@constructedmatter.com',
    'joe@constructedmatter.com',
  ]);

  const STAFF_DIRECTORY = {
    'jeremy@constructedmatter.com': {
      name: 'Jeremy Waters',
      title: 'Web Master',
      role: 'super_admin',
    },
    'brandon@constructedmatter.com': {
      name: 'Brandon Fadden',
      title: 'Principal / President',
      role: 'super_admin',
    },
    'joe@constructedmatter.com': {
      name: 'Joe Ballard',
      title: 'Managing Partner',
      role: 'super_admin',
    },
    'ben@constructedmatter.com': {
      name: 'Ben Peck',
      title: 'Project Manager',
      role: 'staff',
    },
    'angel@constructedmatter.com': {
      name: 'Angel Gutierrez',
      title: 'Field Operations Coordinator',
      role: 'staff',
    },
    'yovana@constructedmatter.com': {
      name: 'Yovana Hernanez',
      title: 'Executive Operations & Project Coordinator',
      role: 'staff',
    },
  };

  const ROLE_PERMISSIONS = {
    super_admin: ['*'],
    staff: [
      'projects.view_all',
      'projects.view_assigned',
      'projects.create',
      'projects.edit',
      'contacts.view',
      'contacts.create',
      'contacts.edit',
      'communications.view',
      'communications.send',
      'calendars.view',
      'calendars.manage',
      'quotes.view',
      'quotes.create',
      'quotes.edit',
      'bids.view',
      'sows.view',
      'sows.create',
      'documents.view',
      'documents.create',
      'documents.edit',
      'invoices.view',
      'profile.view',
      'profile.edit',
      'notifications.view',
      'files.upload',
      'files.view',
    ],
    subcontractor: [
      'projects.view_assigned',
      'communications.view',
      'communications.send',
      'calendars.view',
      'quotes.view',
      'bids.view',
      'bids.submit',
      'sows.view',
      'documents.view',
      'invoices.view',
      'invoices.create',
      'profile.view',
      'profile.edit',
      'notifications.view',
      'files.upload',
      'files.view',
    ],
    vendor: [
      'projects.view_assigned',
      'communications.view',
      'communications.send',
      'quotes.view',
      'products.view',
      'products.create',
      'products.edit',
      'products.delete',
      'profile.view',
      'profile.edit',
      'notifications.view',
      'files.upload',
      'files.view',
    ],
    client: [
      'projects.view_assigned',
      'communications.view',
      'communications.send',
      'calendars.view',
      'quotes.view',
      'sows.view',
      'documents.view',
      'invoices.view',
      'profile.view',
      'profile.edit',
      'notifications.view',
      'files.upload',
      'files.view',
    ],
  };

  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', permissions: ['profile.view'] },
    { id: 'clients', label: 'Contacts', permissions: ['contacts.view'] },
    { id: 'projects', label: 'Projects', permissions: ['projects.view_all', 'projects.view_assigned'] },
    { id: 'bookings', label: 'Bookings', permissions: ['calendars.view'] },
    { id: 'quotes', label: 'Quotes & Leads', permissions: ['quotes.view'] },
    { id: 'portfolio', label: 'Portfolio', permissions: ['projects.view_all'] },
    { id: 'blog', label: 'Blog', permissions: ['projects.view_all'] },
    { id: 'team', label: 'Team', permissions: ['users.view', 'projects.view_all'] },
    { id: 'documents', label: 'Documents', permissions: ['documents.view'] },
    { id: 'settings', label: 'Settings', permissions: ['settings.manage'] },
  ];

  function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return ROLE_PERMISSIONS[value] ? value : 'client';
  }

  function roleForEmail(email, fallbackRole) {
    const key = String(email || '').trim().toLowerCase();
    if (SUPER_ADMIN_EMAILS.has(key)) return 'super_admin';
    if (STAFF_DIRECTORY[key]) return STAFF_DIRECTORY[key].role;
    return normalizeRole(fallbackRole || 'client');
  }

  function getDirectoryUser(email) {
    return STAFF_DIRECTORY[String(email || '').trim().toLowerCase()] || null;
  }

  function hasPermission(role, permission) {
    const normalized = normalizeRole(role);
    const permissions = ROLE_PERMISSIONS[normalized] || [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  function hasAnyPermission(role, permissions) {
    if (!permissions || !permissions.length) return true;
    return permissions.some(permission => hasPermission(role, permission));
  }

  function getCurrentUser() {
    const email = localStorage.getItem('cmi-user-email') || '';
    const storedRole = localStorage.getItem('cmi-user-role') || '';
    const directoryUser = getDirectoryUser(email);
    const role = roleForEmail(email, storedRole);
    return {
      email,
      role,
      name: localStorage.getItem('cmi-user-name') || (directoryUser && directoryUser.name) || '',
      title: (directoryUser && directoryUser.title) || ROLE_LABELS[role] || '',
      label: ROLE_LABELS[role] || role,
      dashboardPath: ROLE_DASHBOARDS[role] || ROLE_DASHBOARDS.client,
      permissions: ROLE_PERMISSIONS[role] || [],
    };
  }

  function visibleNavItems(role) {
    return NAV_ITEMS.filter(item => hasAnyPermission(role, item.permissions));
  }

  window.CMI_PERMISSIONS = {
    ROLE_DASHBOARDS,
    ROLE_LABELS,
    ROLE_PERMISSIONS,
    NAV_ITEMS,
    STAFF_DIRECTORY,
    SUPER_ADMIN_EMAILS,
    normalizeRole,
    roleForEmail,
    getDirectoryUser,
    hasPermission,
    hasAnyPermission,
    getCurrentUser,
    visibleNavItems,
  };
})(window);
