import { Redirect } from "expo-router";

/**
 * `wakalyst://auth` is the sign-in return URL. The auth session in
 * session.ts reads it; if the router also opens it, go home.
 */
export default function AuthReturn() {
  return <Redirect href="/" />;
}
