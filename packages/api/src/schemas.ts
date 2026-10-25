import { z } from "zod";

/** `GET /users/current`. Only the fields the app reads; the rest is dropped. */
export const currentUserSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  display_name: z.string(),
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  photo: z.string(),
  timezone: z.string().optional(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const currentUserResponseSchema = z.object({ data: currentUserSchema });

/**
 * WakaTime's OAuth token response (`POST /oauth/token`), for both the
 * authorization-code and refresh-token grants. WakaTime may answer
 * form-encoded, where every value is a string, so numbers are coerced.
 */
export const oauthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.coerce.number().optional(),
  expires_at: z.string().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  uid: z.string().optional(),
});
export type OAuthTokenResponse = z.infer<typeof oauthTokenResponseSchema>;

/** Parse a token response body whatever its content type (JSON or form-encoded). */
export function parseOAuthTokenResponse(body: string, contentType: string | null) {
  const raw = contentType?.includes("json")
    ? JSON.parse(body)
    : Object.fromEntries(new URLSearchParams(body));
  return oauthTokenResponseSchema.parse(raw);
}
