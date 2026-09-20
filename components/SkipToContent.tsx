/**
 * WCAG 2.4.1 Bypass Blocks.
 *
 * Every page puts the navbar ahead of the content, so without this a keyboard
 * user re-tabs the logo, three nav links, the theme toggle and the account
 * menu on every single navigation before reaching anything they came for.
 *
 * Visually hidden until focused, NOT `hidden` and NOT `sr-only` on its own -
 * it has to become visible when it receives focus, or sighted keyboard users
 * get a focus ring sitting on nothing. The `sr-only focus:not-sr-only` pair is
 * what buys that: absent from the layout until tabbed to, then a real button
 * pinned to the top-left.
 *
 * Must be the first focusable thing in the DOM, so it is rendered immediately
 * inside <body> ahead of every provider's output.
 */
export const MAIN_CONTENT_ID = "main-content";

export function SkipToContent() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-primary"
    >
      Skip to main content
    </a>
  );
}
