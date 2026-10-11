/**
 * Keeps the Hume EVI connect URL under the size Hume will accept.
 *
 * `@humeai/voice-react` does not send the session variables passed to
 * `connect()` as a message. It serialises them into the WebSocket URL as
 * `session_settings[variables][<name>]=<encodeURIComponent(value)>` query
 * parameters, and Hume refuses the handshake outright once that URL passes
 * roughly 6.5 KB: the browser sees an `error` event and a 1006 close within
 * 300 ms, nothing is logged anywhere, and the app lands on "This interview
 * never finished connecting".
 *
 * Measured against api.hume.ai on 11 Oct 2026 with the production config: a
 * 6,072-character URL connected, a 6,784-character one was rejected. The
 * description column allows 10,000 characters, and a real 5,719-character job
 * advert encodes to 7,897 because every newline is `%0A` and every bullet or
 * curly quote is nine characters - so any detailed job description could not
 * start an interview at all, while a short one worked, which is what made it
 * look intermittent.
 *
 * The fix is in two parts. The variables that travel in the URL are bounded
 * here, so the handshake always succeeds and the interviewer's opening line
 * still has the job context. When something had to be cut, _StartCall sends
 * the complete set over the socket as a `session_settings` message as soon as
 * the call is connected; that path has no URL to overflow, and Hume applies
 * updated variables to every turn that follows.
 */

/**
 * Budget for the encoded variables, in characters as they appear in the URL.
 * The access token, config id and the SDK's own parameters add roughly 500
 * more, so this keeps the whole URL near 4.5 KB - comfortably under the
 * measured 6.1 KB-to-6.8 KB ceiling without trimming more context than needed.
 */
export const CONNECT_VARIABLES_BUDGET = 4_000;

/** Appended to a value that was cut, so the prompt can tell it is a prefix. */
export const TRUNCATION_MARKER = " […]";

export type SessionVariables = Record<string, string>;

/**
 * Characters the variables occupy in the connect URL. Mirrors the SDK's
 * query-string builder, which runs encodeURIComponent over both the bracketed
 * key and the value and joins pairs with `&`.
 */
export function encodedVariablesLength(variables: SessionVariables): number {
  let total = 0;
  for (const [key, value] of Object.entries(variables)) {
    total +=
      encodeURIComponent(`session_settings[variables][${key}]`).length +
      1 + // "="
      encodeURIComponent(value).length +
      1; // "&"
  }
  return total;
}

/**
 * Returns the variables to put in the connect URL. When they already fit, the
 * same object comes back and `truncated` is false. Otherwise the longest value
 * is cut to whatever room the others leave, at a word boundary where one is
 * near, and marked - repeating in the unlikely event one cut was not enough.
 */
export function fitVariablesForConnect(
  variables: SessionVariables,
  budget: number = CONNECT_VARIABLES_BUDGET,
): { forConnect: SessionVariables; truncated: boolean } {
  if (encodedVariablesLength(variables) <= budget) {
    return { forConnect: variables, truncated: false };
  }

  const forConnect: SessionVariables = { ...variables };
  const markerLength = encodeURIComponent(TRUNCATION_MARKER).length;

  // Bounded: each pass shrinks the longest value to exactly the room left, so
  // one pass normally suffices. The guard only exists so a pathological input
  // (every value enormous) cannot loop.
  for (let pass = 0; pass < 8; pass++) {
    if (encodedVariablesLength(forConnect) <= budget) break;

    const [longestKey] = Object.entries(forConnect).reduce((a, b) =>
      b[1].length > a[1].length ? b : a,
    );
    const withoutLongest = encodedVariablesLength({
      ...forConnect,
      [longestKey]: "",
    });
    const room = Math.max(0, budget - withoutLongest - markerLength);

    forConnect[longestKey] =
      truncateToEncodedLength(forConnect[longestKey], room) + TRUNCATION_MARKER;
  }

  return { forConnect, truncated: true };
}

/**
 * Longest prefix of `text` whose encodeURIComponent form is at most `room`
 * characters, backed off to the last whitespace when one is reasonably close
 * so the prompt does not end mid-word. Never splits a surrogate pair:
 * encodeURIComponent throws on a lone surrogate.
 */
function truncateToEncodedLength(text: string, room: number): string {
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (encodeURIComponent(codePointPrefix(text, mid)).length <= room) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  let cut = codePointPrefix(text, lo);
  const lastWhitespace = cut.search(/\s\S*$/);
  if (lastWhitespace > cut.length * 0.8) {
    cut = cut.slice(0, lastWhitespace);
  }
  return cut.trimEnd();
}

function codePointPrefix(text: string, length: number): string {
  if (
    length > 0 &&
    length < text.length &&
    /[\uD800-\uDBFF]/.test(text.charAt(length - 1))
  ) {
    return text.slice(0, length - 1);
  }
  return text.slice(0, length);
}
