# Direct Google and Microsoft sign-in

The game uses direct provider login. It does not require a ChatGPT account. Use the same provider and provider account on each device to resume the same expedition. Google and Microsoft identities are kept separate; matching email addresses do not automatically link accounts.

## Google

1. In Google Cloud Console, select the project that should own the game login. Open Google Auth Platform, configure the app's branding/audience and add your support contact.
2. Create an OAuth client with application type **Web application**.
3. Add this exact authorized redirect URI:

   `https://slugterra-cavern-expeditions.talloginn.chatgpt.site/auth/callback/google`

4. If the console requests an authorized JavaScript origin, use `https://slugterra-cavern-expeditions.talloginn.chatgpt.site`.
5. Add the app's client ID and client secret to the Site's server runtime configuration as **GOOGLE_CLIENT_ID** and **GOOGLE_CLIENT_SECRET**. Keep the secret out of chat, source control and client code.
6. While Google marks the app as Testing, add the players who will test it. Publish the OAuth consent configuration when you want general access. The game requests only OpenID/profile/email, without Drive or Gmail access.

## Microsoft

1. In Microsoft Entra admin center, open **App registrations → New registration**.
2. For both work/school and personal Microsoft accounts, select **Accounts in any organizational directory and personal Microsoft accounts**. Add a **Web** platform.
3. Add this exact redirect URI:

   `https://slugterra-cavern-expeditions.talloginn.chatgpt.site/auth/callback/microsoft-entra-id`

4. Create a client secret under **Certificates & secrets**. Store its **Value**, rather than its secret ID, as **MICROSOFT_CLIENT_SECRET** in the Site's server runtime configuration. Store the Application (client) ID as **MICROSOFT_CLIENT_ID**.
5. The default authority is `common`. For a deliberately tenant-restricted app, configure **MICROSOFT_TENANT_ID** with that tenant's ID instead. Do not grant Graph file/mail permissions; basic OpenID/profile/email is sufficient.
6. Note the Microsoft secret's expiry and replace it in runtime configuration before it expires.

## Runtime and activation

The application also requires a randomly generated **AUTH_SECRET** of at least 32 bytes, held only in server runtime configuration. This encrypts the HttpOnly session cookie. It must remain stable across deployments. No provider secret belongs in `.openai/hosting.json`, a Vite `VITE_*` variable, a repository file, a shell argument, or a browser bundle.

The hosting integration must deploy the Worker build and apply the tracked D1 migration. Configure runtime values securely, then publish the matching saved Site version to apply the configuration revision. Unconfigured providers stay unavailable in the account panel. Guest play continues to save on the device.

Before release, use each configured provider to sign in, play until a cloud save completes, and sign in with the same provider/account in a fresh browser. Automated tests can check protocol handling with test providers and account isolation, but cannot approve the real Google or Microsoft consent screen on behalf of a player.
