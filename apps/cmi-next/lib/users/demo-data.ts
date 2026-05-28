import type { UsersData } from "./types";

const now = new Date().toISOString();

export function getDemoUsersData(): UsersData {
  return {
    users: [
      {
        id: "50000000-0000-4000-8000-000000000001",
        auth_user_id: null,
        contact_id: null,
        email: "jeremy@constructedmatter.com",
        first_name: "Jeremy",
        last_name: "Waters",
        display_name: "Jeremy Waters",
        phone: "4803527598",
        role_slug: "super_admin",
        status: "active",
        company_name: "Constructed Matter, Inc.",
        job_title: "Web Master",
        title: "Web Master",
        avatar_url: null,
        notes: "Primary dashboard admin.",
        invited_at: now,
        invite_email_sent_at: now,
        invite_sms_sent_at: null,
        invite_accepted_at: now,
        disabled_at: null,
        last_login_at: now,
        created_at: now,
        updated_at: now
      },
      {
        id: "50000000-0000-4000-8000-000000000002",
        auth_user_id: null,
        contact_id: null,
        email: "ben@constructedmatter.com",
        first_name: "Ben",
        last_name: "Peck",
        display_name: "Ben Peck",
        phone: null,
        role_slug: "project_manager",
        status: "invited",
        company_name: "Constructed Matter, Inc.",
        job_title: "Project Manager",
        title: "Project Manager",
        avatar_url: null,
        notes: "Can manage assigned schedules and tasks.",
        invited_at: now,
        invite_email_sent_at: now,
        invite_sms_sent_at: null,
        invite_accepted_at: null,
        disabled_at: null,
        last_login_at: null,
        created_at: now,
        updated_at: now
      },
      {
        id: "50000000-0000-4000-8000-000000000003",
        auth_user_id: null,
        contact_id: "60000000-0000-4000-8000-000000000001",
        email: "client@example.com",
        first_name: "Dana",
        last_name: "Reyes",
        display_name: "Dana Reyes",
        phone: "4805551212",
        role_slug: "client",
        status: "pending",
        company_name: "Scottsdale Master Bath",
        job_title: "Client",
        title: "Client",
        avatar_url: null,
        notes: "Client portal access will show client-visible milestones and updates.",
        invited_at: now,
        invite_email_sent_at: now,
        invite_sms_sent_at: null,
        invite_accepted_at: null,
        disabled_at: null,
        last_login_at: null,
        created_at: now,
        updated_at: now
      },
      {
        id: "50000000-0000-4000-8000-000000000004",
        auth_user_id: null,
        contact_id: "60000000-0000-4000-8000-000000000002",
        email: "vendor@example.com",
        first_name: "Rochelle",
        last_name: "Barton",
        display_name: "Rochelle Barton",
        phone: "6023126463",
        role_slug: "vendor",
        status: "active",
        company_name: "Cabinet Solutions USA",
        job_title: "Cabinet Vendor",
        title: "Cabinet Vendor",
        avatar_url: null,
        notes: "Vendor users can later confirm deliveries and upload documents.",
        invited_at: now,
        invite_email_sent_at: now,
        invite_sms_sent_at: null,
        invite_accepted_at: now,
        disabled_at: null,
        last_login_at: now,
        created_at: now,
        updated_at: now
      }
    ],
    activities: [
      {
        id: "70000000-0000-4000-8000-000000000001",
        user_id: "50000000-0000-4000-8000-000000000003",
        action: "invite.created",
        description: "Client invite prepared for project-visible updates.",
        created_at: now
      }
    ]
  };
}
