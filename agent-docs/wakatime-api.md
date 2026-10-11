# WakaTime API notes

Base URL `https://wakatime.com/api/v1`. OAuth endpoints live under
`https://wakatime.com/oauth`.

## OAuth

| Step | Request |
| --- | --- |
| Authorize | `GET /oauth/authorize?response_type=code&client_id&redirect_uri&scope&state` |
| Code exchange | `POST /oauth/token` form: `client_id, client_secret, redirect_uri, grant_type=authorization_code, code` |
| Refresh | `POST /oauth/token` form: same, with `grant_type=refresh_token, refresh_token` |
| Revoke | `POST /oauth/revoke` form: `client_id, client_secret, token` |

- `redirect_uri` must exactly match one registered on the WakaTime app.
- The token response may be form-encoded rather than JSON; the Worker sends
  `Accept: application/json` and parses either (`parseOAuthTokenResponse`).
  It carries `access_token`, `refresh_token`, `expires_in` and/or
  `expires_at`, `scope`, `uid`.
- Scopes requested: `read_stats,read_summaries` (`WAKATIME_SCOPES`). Confirm
  each new endpoint's required scope against https://wakatime.com/developers
  before using it; adding a scope means users sign in again.

## Endpoints used

| Endpoint | Used by | Notes |
| --- | --- | --- |
| `GET /users/current` | `getCurrentUser` | `{ data: { id, username, display_name, photo, … } }`; `username` can be null |

## Limits

WakaTime rate-limits API calls; check https://wakatime.com/developers for the
current limits. Rely on TanStack Query caching (`staleTime` 60 s by default)
rather than polling.
