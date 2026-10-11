/** A non-2xx response from WakaTime (or from the Worker's proxy in front of it). */
export class WakaTimeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WakaTimeError";
  }
}

/** There is no usable session: the user has to sign in again. */
export class UnauthorizedError extends WakaTimeError {
  constructor(message = "Not signed in") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}
