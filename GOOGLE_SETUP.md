# Connecting the hub to your Google account

The hub signs in with **your own** OAuth client, not one belonging to this app. That means
the tokens live in a Google Cloud project you control, you can see exactly what was granted,
and you can revoke it from your own account page at any time.

Creating that client means signing into Google. **Do it yourself** — nothing should be
automating a sign-in to your account on your behalf, including an agent running in this repo.

It takes about five minutes, once.

---

## 1. Make a project

<https://console.cloud.google.com/projectcreate> — any name. If you already have a project
you use for personal things, that one is fine.

## 2. Turn on the APIs you actually want

<https://console.cloud.google.com/apis/library> — search for and Enable each of:

| Service  | API to enable      |
|----------|--------------------|
| Gmail    | Gmail API          |
| Drive    | Google Drive API   |
| YouTube  | YouTube Data API v3|
| Calendar | Google Calendar API|

Skip the ones you left switched off in Settings. **A granted scope is not the same as an
enabled API** — miss this step and the connection succeeds, then the first real call fails
with "has not been used in project…". The **Test** button in Settings exists to catch exactly
that, and tells you which API is missing.

## 3. Configure the consent screen

<https://console.cloud.google.com/apis/credentials/consent>

- User type **External** (unless you have a Workspace org, in which case Internal is simpler
  and skips everything below about verification).
- App name, your email for both support and developer contact. Nothing else is required.
- **Add yourself under Test users.** This is the step people miss.

Leave the app in **Testing**. You do not need to publish it, and you should not: publishing
starts a verification review. In Testing mode the app works fully for accounts on the test
user list, which for a personal hub is just you.

> **The catch, stated plainly.** Gmail and full Drive access are what Google calls
> *restricted* scopes. In Testing mode they work for your test users. To let anyone else
> sign in, the app must pass verification, and restricted scopes additionally require an
> annual third-party security assessment that costs real money. For a hub you run for
> yourself this never comes up. It is a wall if you ever want to hand this to someone else.
>
> A refresh token issued by an app in Testing mode **expires after 7 days**. You will have to
> press Connect again once a week until the app is verified. If that becomes annoying, the
> narrower `drive.file` scope plus publishing without restricted scopes avoids it — say so
> and it is a one-line change in `server/googleAuth.js`.

## 4. Create the OAuth client

<https://console.cloud.google.com/apis/credentials> → **Create credentials** → **OAuth client ID**

- Application type: **Web application**
- Authorised redirect URI: copy it from the hub's Settings → Accounts card. It is

  ```
  http://localhost:3001/oauth/google/callback
  ```

  unless you changed `PORT` or set `GOOGLE_REDIRECT_URI`. It must match **character for
  character** — a trailing slash is a different URI to Google and the error it gives you
  (`redirect_uri_mismatch`) does not say which character is wrong.

## 5. Paste the id and secret into Settings → Accounts

Hit **Save OAuth client**. The secret is stored server-side in `hub.json` and is never sent
back to the browser afterwards — the field will show dots forever, which is not a bug.

## 6. Connect

Tick the services you want, press **Connect Google**, approve in the window that opens.

You can untick individual services on Google's own consent screen. The hub reports what was
**granted**, not what it asked for, so if you untick one it will say so rather than pretending
it has access.

Then press **Test**. It makes one cheap authenticated call per service, which is the only way
to prove the whole path works end to end.

---

## What the agent can then do

Connecting is not the feature; these are. Once an account is connected the agent gets nine
tools, and only when it is connected — the docs are kept out of its context otherwise.

**Read (run on their own):** `gmail_search`, `gmail_read`, `drive_search`, `drive_read`,
`calendar_list`, `youtube_list`.

**Write (a human approves every single call, in every approval mode):** `gmail_send`,
`drive_upload`, `calendar_add`.

That split is deliberate and it is tested, not just commented. With unattended work switched
on, the agent starts runs while nobody is watching, and a confused run that can mail your
contacts is a different category of mistake from one that writes a bad file into `workspace/`.
The approval prompt names the real effect — "sends mail AS YOU to someone@example.com" —
rather than the tool name.

`drive_upload` can only read files inside `workspace/`, enforced by the same `safePath` check
that confines the agent's own file writes.

## Where things live

| Thing | Where |
|---|---|
| Client id + secret, refresh token | `server/hub.json`, under `google` |
| The flow, scopes, refresh, revoke | `server/googleAuth.js` |
| The agent's nine tools | `server/googleTools.js` |
| Tests (no network) | `node server/googleAuth.test.mjs`, `node server/googleTools.test.mjs` |
| Redirect endpoint | `/oauth/google/callback` — deliberately outside the `/api` auth gate |

`hub.json` is a plain file on disk holding a live refresh token to your Google account.
It is already where your provider API keys live, so this changes nothing about how the file
should be treated: do not commit it, do not sync it, and if the machine is shared, that
refresh token is as good as the account.

## Disconnecting

**Settings → Disconnect** drops the hub's copy *and* revokes the grant at Google. If the
revoke call fails, the hub says so rather than claiming success — in that case remove it
yourself at <https://myaccount.google.com/permissions>.

## What about OneDrive?

OneDrive is Microsoft, and no amount of Google authentication will reach it. It needs a
separate identity: an Azure app registration and a Microsoft Entra OAuth flow against
Microsoft Graph. The shape is close enough to this one that it could reuse most of
`googleAuth.js`, but it is a second connection with a second consent, not a checkbox here.
