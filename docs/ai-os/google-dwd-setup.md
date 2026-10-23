# Google Workspace Setup for the CMI MCP Server (Phase 2)

These steps let the CMI app read Gmail, Drive, Sheets and Calendar **read-only** on
behalf of staff, so Claude (through the CMI connector) and the briefings can use them.

**Who:** Jeremy, signed in as a **Google Workspace super admin** for constructedmatter.com.
**Time:** about 20–30 minutes.

## How it works and what it protects

- Google gives the CMI app a **service account** with **domain-wide delegation**. This
  lets the app act as a staff member, read-only, for the four scopes below. It can't
  send, delete or change anything in Google.
- The CMI app decides whose data a request may read:
  - Each person can read **only their own** mailbox, Drive and calendar.
  - People switched on for **Company-wide access** in Dashboard → Settings → Claude
    can read anyone's.
  - Every request is logged in `mcp_audit_log`, including whose mailbox was read.
- **Kill switch:** deleting the delegation entry in step 6 stops all access within
  minutes.
- The JSON key from step 4 can read every mailbox in the company. Treat it like a
  master password: keep it only in Coolify and your password manager.

---

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com and sign in with your
   **@constructedmatter.com** admin account.
2. Top bar → project picker → **New Project**.
   - Name: `CMI MCP`
   - Organization: `constructedmatter.com`
   - Click **Create**, then select the new project in the picker.

## 2. Turn on the APIs

Go to **APIs & Services → Library**. Search for each of these, open it, and click
**Enable**:

- **Gmail API**
- **Google Drive API**
- **Google Sheets API**
- **Google Calendar API**

## 3. Create the service account

1. Go to **IAM & Admin → Service Accounts → + Create service account**.
   - Name: `cmi-mcp-reader`
   - Description: `Read-only Gmail/Drive/Sheets/Calendar for the CMI app`
   - Click **Create and continue**.
2. **Grant this service account access to project:** skip it, because no roles are
   needed. Click **Continue**, then **Done**.
3. Open the new service account. On the **Details** tab, copy the **Unique ID**. It's
   a long number, and it's the **Client ID** you'll need in step 6.

## 4. Create a JSON key

1. In the service account, open the **Keys** tab → **Add key → Create new key → JSON
   → Create**. A `.json` file downloads.

**If Google says "Service account key creation is disabled":** newer Google
organizations block keys by default. Allow keys for this one project only:

1. Go to **IAM & Admin → Organization Policies**, with the `CMI MCP` project selected.
2. Search for **Disable service account key creation**
   (`iam.disableServiceAccountKeyCreation`) and open it.
3. Click **Manage policy → Override parent's policy → Add a rule → Enforcement: Off →
   Set policy**.
   - This needs the *Organization Policy Administrator* role. As the Workspace super
     admin you can grant it to yourself in **IAM & Admin → IAM**, at the organization
     level.
4. Go back to step 4.1 and create the key.

## 5. Put the key in Coolify

1. Open the downloaded `.json` file in a text editor and copy **all** of it.
2. In Coolify, open the CMI app → **Environment Variables** and add these two, both as
   **runtime only** (Build Variable = **OFF**):

| Variable | Value |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The entire JSON file contents, pasted as-is. |
| `GOOGLE_WORKSPACE_DOMAIN` | `constructedmatter.com` |

3. Save. Then **delete the downloaded `.json` file** from your computer. Keep a copy
   only in your password manager.

## 6. Authorize domain-wide delegation (Google Admin)

1. Go to https://admin.google.com → **Security → Access and data control → API
   controls**.
2. Under **Domain wide delegation**, click **Manage domain wide delegation → Add new**.
3. **Client ID:** paste the Unique ID from step 3.3.
4. **OAuth scopes:** paste this as one line:

```text
https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/spreadsheets.readonly,https://www.googleapis.com/auth/calendar.readonly
```

5. Click **Authorize**.

Changes usually take effect within minutes. Google says it can take up to 24 hours.

## 7. Redeploy and check

1. Redeploy the CMI app in Coolify. Environment variables are read at startup.
2. In the dashboard, go to **Settings → Credentials**. The **Google Workspace** card
   should show both variables as **Set**.
3. In Claude, with the CMI connector connected, try:
   - "Search my email for invoices from last week."
   - "What did I change in Drive in the last 3 days?"
   - "What's on my calendar tomorrow?"
4. If Claude says the email isn't a Google mailbox: the person's CMI dashboard login
   must be their **@constructedmatter.com** address. For example, Jeremy should
   connect Claude using `jeremy@constructedmatter.com`, not `jwaters@qallus.co`.

---

## Later

- **Rotate the key yearly, or whenever someone with access leaves:**
  1. Create a new key (step 4).
  2. Replace it in Coolify and redeploy.
  3. Delete the old key under the service account's **Keys** tab.
- **Turn it all off:** remove the entry in Google Admin → Domain wide delegation.
  Removing `GOOGLE_SERVICE_ACCOUNT_JSON` from Coolify also turns it off.
