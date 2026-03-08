

## Extend Refresh Token Expiry to 30 Days

### What
Update the authentication configuration so refresh tokens last 30 days (2,592,000 seconds) instead of the default 7 days. This means users won't need to re-login as long as they open the app at least once every 30 days.

### How
The refresh token lifetime is controlled by the `[auth]` section in `supabase/config.toml`. I'll add:

```toml
[auth]
refresh_token_rotation_enabled = true
refresh_token_reuse_interval = 10

[auth.sessions]
timebox = 0
inactivity_timeout = 0
```

However, since `config.toml` is auto-managed and shouldn't be edited directly, I'll use the `configure_auth` tool (or the appropriate backend configuration) to set the JWT expiry and refresh token lifetime to 30 days (2,592,000 seconds).

**Important caveat**: The refresh token expiry is a server-side Supabase configuration. In Lovable Cloud, this setting is managed at the project level. I'll configure it by updating the auth settings to set the refresh token lifetime to 2,592,000 seconds (30 days).

No frontend code changes are needed — the client is already configured with `persistSession: true` and `autoRefreshToken: true`.

### Steps
1. Configure the backend auth settings to extend the refresh token lifetime to 30 days (2,592,000 seconds)

