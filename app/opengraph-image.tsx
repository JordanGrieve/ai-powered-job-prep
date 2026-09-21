import { ImageResponse } from "next/og";

/**
 * The social card. This is the piece of SEO work with the highest return for
 * this app by a wide margin: the link gets pasted into job applications,
 * LinkedIn posts and messages far more often than it gets found through
 * search, and without this it renders as an empty grey rectangle.
 *
 * Deliberately no external font fetch. Satori needs font data at render time,
 * and a build that reaches out to Google Fonts is a build that can fail for
 * reasons unrelated to the code. The default font is good enough for six
 * words.
 */
export const alt =
  "Callback - practise a live voice mock interview against the exact job you are applying for";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b0b0f",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          Callback
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 40,
            lineHeight: 1.3,
            color: "#a1a1aa",
            maxWidth: 900,
          }}
        >
          A live voice mock interview against the exact job you&apos;re applying
          for — then scored, specific feedback.
        </div>

        <div
          style={{
            marginTop: 56,
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: "#71717a",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#22c55e",
            }}
          />
          Voice interview · Practice questions · CV review
        </div>
      </div>
    ),
    size,
  );
}
