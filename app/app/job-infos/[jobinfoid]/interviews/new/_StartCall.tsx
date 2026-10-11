"use client";

import { env } from "@/app/data/env/client";
import { jobInfoTable } from "@/app/drizzle/schema";
import {
  createInterview,
  updateInterview,
} from "@/app/features/interviews/actions";
import {
  fitVariablesForConnect,
  type SessionVariables,
} from "@/app/features/interviews/connectVariables";
import {
  INTERVIEW_WARNING_SECONDS,
  MAX_INTERVIEW_SECONDS,
  formatRemaining,
  parseDurationToSeconds,
  remainingSeconds,
} from "@/app/features/interviews/duration";
import { CondensedMessages } from "@/app/services/hume/components/CondensedMessages";
import { condenseChatMessages } from "@/app/services/hume/lib/condensedChatMessages";
import { Button } from "@/components/ui/button";
import { errorToast } from "@/lib/errorToast";
import { useVoice, VoiceReadyState } from "@humeai/voice-react";
import {
  Loader2Icon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Turns a failed connect() into something the user can act on.
 *
 * By far the most likely cause is the microphone: connect() asks for it, and a
 * blocked or dismissed permission prompt is indistinguishable from a network
 * failure unless the DOMException name is read. Telling someone "something
 * went wrong" when the real answer is "your browser is blocking the mic" is
 * the difference between a fixable problem and an app that looks broken.
 */
/**
 * Turns the SDK's structured VoiceError into something the user can act on.
 *
 * Preferred over reading a DOMException name, because the SDK already tells us
 * exactly why: `mic_permission_denied` is unambiguous in a way that a generic
 * failure is not. Telling someone "something went wrong" when the real answer
 * is "your browser is blocking the mic" is the difference between a fixable
 * problem and an app that looks broken.
 */
function voiceErrorMessage(error: {
  type: string;
  reason: string;
  message?: string;
}): string {
  if (error.type === "mic_error") {
    switch (error.reason) {
      case "mic_permission_denied":
        return "We could not access your microphone. Allow microphone access for this site in your browser, then try again.";
      case "mime_types_not_supported":
        return "Your browser does not support the audio format this needs. Try Chrome, Edge or Safari.";
      default:
        return "We could not start your microphone. Check it is connected and not in use by another app, then try again.";
    }
  }

  if (error.type === "socket_error") {
    return "We could not reach the interview service. Check your connection and try again.";
  }

  if (error.type === "audio_error") {
    return "We could not start audio playback. Try again, or reload the page.";
  }

  return "We could not start the interview. Please try again.";
}

function connectErrorMessage(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "We could not access your microphone. Allow microphone access for this site in your browser, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Connect one and try again.";
    case "NotReadableError":
      return "Your microphone is in use by another app. Close it and try again.";
    default:
      return "We could not start the interview. Please try again.";
  }
}

export function StartCall({
  jobInfo,
  user,
  accessToken,
}: {
  accessToken: string;
  jobInfo: Pick<
    typeof jobInfoTable.$inferSelect,
    "id" | "title" | "description" | "experienceLevel"
  >;
  user: {
    name: string;
    imageUrl: string;
  };
}) {
  const {
    connect,
    disconnect,
    readyState,
    chatMetadata,
    callDurationTimestamp,
    // The SDK reports most failures through this rather than by rejecting
    // connect(). A refused microphone arrives here as
    // { type: "mic_error", reason: "mic_permission_denied" } while connect()
    // resolves normally, so a try/catch around connect() alone never fires for
    // the single most likely way starting an interview fails.
    error: voiceError,
    status,
    sendSessionSettings,
  } = useVoice();
  const [interviewId, setInterviewId] = useState<string | null>(null);
  // Guards the window between the click and readyState leaving IDLE. Without
  // it the button stays live during the server round trip and the Hume
  // handshake, so a second click creates a second interview row and spends a
  // second rate-limit token.
  const [starting, setStarting] = useState(false);
  // Toast each distinct voice error once. The effect below reports and does
  // nothing else, so it needs its own idempotence rather than relying on a
  // state change to stop it re-firing.
  const toastedErrorRef = useRef<unknown>(null);
  const durationRef = useRef(callDurationTimestamp);
  // humeChatId is write-once server-side, so guard against a duplicate attempt
  // when this effect re-runs.
  const chatIdWrittenRef = useRef(false);
  // disconnect() is not instantaneous - without this the effect re-fires on
  // every duration tick between the call to disconnect and CLOSED arriving.
  const capReachedRef = useRef(false);
  // The complete session variables, held back when they were too large for
  // the connect URL and delivered over the socket once the call is up. Null
  // whenever the URL carried everything.
  const deferredVariablesRef = useRef<SessionVariables | null>(null);
  const router = useRouter();

  useEffect(() => {
    durationRef.current = callDurationTimestamp;
  }, [callDurationTimestamp]);

  // Second half of the connect-URL fix (see connectVariables.ts). The SDK
  // puts whatever connect() is given into the WebSocket URL, and Hume refuses
  // the handshake once that URL passes ~6.5 KB - which a detailed job advert
  // does on its own. So the URL carries a bounded prefix, enough for the
  // interviewer's opening line, and the full text follows here as a
  // session_settings message, which has no URL to overflow. Hume applies
  // updated variables to every turn after it arrives.
  //
  // Keyed on `status` rather than readyState: "connected" is set only after
  // the SDK has marked its own socket resource connected, which is the gate
  // sendSessionSettings checks before it will send anything.
  useEffect(() => {
    if (status.value !== "connected") return;
    const variables = deferredVariablesRef.current;
    if (variables == null) return;
    deferredVariablesRef.current = null;
    // The SDK adds the `type: "session_settings"` discriminator itself.
    sendSessionSettings({ variables });
  }, [status.value, sendSessionSettings]);

  // Surface a failure the SDK reported through state rather than by rejecting.
  //
  // This is the path that actually fires when someone refuses the microphone
  // prompt: connect() resolves, readyState goes back to IDLE, and the only
  // evidence is `error`. Without this the user is returned to a Start button
  // that looks untouched, which is the bug this whole change exists to fix.
  //
  // Guarded on interviewId so a failure arriving mid-call cannot discard a
  // connected interview. Discarding is safe anyway - the DELETE carries
  // `humeChatId IS NULL` - but there is no reason to issue the request.
  useEffect(() => {
    if (voiceError == null || interviewId == null) return;
    if (chatMetadata?.chatId != null) return;

    // Reporting only - no state is touched here, and the row is left alone.
    //
    // An earlier version deleted the interview as tidiness and cleared the id.
    // That turned a handled state into a 404: the disconnect effect below
    // navigates to /interviews/{id} whenever there is an id, so the user was
    // sent to a page whose row was being deleted in the same moment.
    // Reproduced on production 11 Oct 2026 - two interview ids from a failed
    // run answered "We couldn't find that".
    //
    // The detail page already handles a null chat id, and says the useful
    // thing: "This interview never finished connecting, so there is no
    // transcript to show. You have not been charged for it." That message was
    // written for exactly this state; deleting the row destroyed the thing
    // that explained it.
    //
    // Orphans cost nothing. The interviews list filters on a non-null
    // humeChatId so they never appear, and the plan limit counts the same
    // column so they never consume quota.
    if (toastedErrorRef.current === voiceError) return;
    toastedErrorRef.current = voiceError;

    console.error("[interview] voice error", voiceError);
    errorToast(voiceErrorMessage(voiceError));
  }, [voiceError, interviewId, chatMetadata?.chatId]);

  // Sync chat ID.
  //
  // This is the ONLY place humeChatId is ever set, and it gates everything
  // downstream: a null humeChatId makes the detail page notFound(), excludes
  // the interview from the list, and permanently blocks feedback generation.
  // Firing and forgetting it meant a failed write burned a paid voice call and
  // handed the user an unexplained 404 with no way to recover.
  useEffect(() => {
    const chatId = chatMetadata?.chatId;
    if (chatId == null || interviewId == null) return;
    if (chatIdWrittenRef.current) return;

    let cancelled = false;
    chatIdWrittenRef.current = true;

    (async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await updateInterview(interviewId, {
            humeChatId: chatId,
          });
          if (cancelled) return;
          if (!res.error) return;
          if (attempt === 2) {
            chatIdWrittenRef.current = false;
            errorToast(res.message);
          }
        } catch (error) {
          console.error("[interview] failed to attach chat id", error);
          if (cancelled) return;
          if (attempt === 2) {
            chatIdWrittenRef.current = false;
            errorToast("We couldn't save this interview. Please try again.");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatMetadata?.chatId, interviewId]);

  // Sync Duration
  useEffect(() => {
    if (interviewId == null) return;
    const intervalId = setInterval(() => {
      if (durationRef.current == null) return;
      // Best-effort: the authoritative write happens on disconnect. Catch so a
      // transient failure does not surface as an unhandled rejection.
      updateInterview(interviewId, { duration: durationRef.current }).catch(
        (error) => console.error("[interview] duration sync failed", error),
      );
    }, 10000);
    return () => clearInterval(intervalId);
  }, [chatMetadata?.chatId, interviewId]);

  // Enforce the duration cap.
  //
  // Hume bills per connected minute and nothing else stops a call, so this is
  // the only thing standing between `unlimited_interviews` and an unbounded
  // bill. Hanging up here lands in the CLOSED branch below, which writes the
  // final duration and navigates - the same path as pressing End Call, so a
  // capped interview is saved and gets feedback exactly like any other.
  //
  // A null timestamp means "unknown", never "0 elapsed": ignoring it would be
  // fine, but treating it as 0 would hold a call open indefinitely.
  useEffect(() => {
    if (interviewId == null) return;
    if (readyState !== VoiceReadyState.OPEN) return;
    if (capReachedRef.current) return;

    const elapsed = parseDurationToSeconds(callDurationTimestamp);
    if (elapsed == null || elapsed < MAX_INTERVIEW_SECONDS) return;

    capReachedRef.current = true;
    disconnect();
  }, [callDurationTimestamp, disconnect, interviewId, readyState]);

  // Handle Disconnect
  useEffect(() => {
    if (readyState !== VoiceReadyState.CLOSED) return;

    // No interview id means the call closed without one ever being created, or
    // it was discarded because the connection failed. There is nothing to
    // navigate to: the error toast is already on screen here, and the user is
    // one click from trying again.
    //
    // This used to push to the interviews list. That was the other half of the
    // loop fixed alongside this - the list redirected straight back when it
    // was empty, and readyState and interviewId were unchanged on arrival, so
    // the push fired again immediately. Staying put is both correct and the
    // end of that cycle.
    if (interviewId == null) return;

    let cancelled = false;

    (async () => {
      // Await before navigating - the previous code raced router.push and
      // routinely lost the final duration segment.
      if (durationRef.current != null) {
        try {
          await updateInterview(interviewId, {
            duration: durationRef.current,
          });
        } catch (error) {
          console.error("[interview] final duration write failed", error);
        }
      }
      if (cancelled) return;
      router.push(`/app/job-infos/${jobInfo.id}/interviews/${interviewId}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [interviewId, readyState, router, jobInfo.id]);

  // CLOSED with no interview id is not a call in progress - it is a call that
  // ended without ever becoming one, which is where a failed connect lands.
  // Treated as startable rather than falling through to the spinner below,
  // because that spinner has no retry in it: the Start button used to render
  // only for IDLE, so breaking the redirect loop without this would have
  // traded a loop for a dead end that spins forever.
  const canStart =
    readyState === VoiceReadyState.IDLE ||
    (readyState === VoiceReadyState.CLOSED && interviewId == null);

  /**
   * One source of truth for "a start attempt is currently in flight".
   *
   * `starting` alone is not that, because nothing resets it once a voice error
   * has been surfaced - the error effect reports and touches no state on
   * purpose, to stay clear of setState-in-effect. A surfaced error means the
   * attempt is over, so it ends the in-flight window.
   *
   * Named and used in all three places rather than repeated inline. The
   * previous two commits each updated some of those places and not others:
   * first the label disagreed with `disabled`, leaving a button that was
   * enabled and still read "Starting…"; then the click guard disagreed with
   * both, leaving a button that looked ready, was enabled, and returned at
   * `if (starting)` without doing anything. Three copies of one condition is
   * how that keeps happening.
   */
  const attemptInFlight = starting && voiceError == null;

  if (canStart) {
    return (
      <div className="flex justify-center items-center h-screen-header">
        <Button
          size="lg"
          // Derived rather than reset in the error effect: a surfaced voice
          // error means the attempt is over, so the button must come back even
          // though `starting` was never cleared. Keeping this out of an effect
          // avoids setState-in-effect, and avoids the stuck-disabled button
          // that an un-reset flag would otherwise leave behind.
          disabled={attemptInFlight}
          onClick={async () => {
            if (attemptInFlight) return;
            setStarting(true);

            // createInterview is awaited OUTSIDE the connect() try below, so
            // its own rejection needs handling here. Without this a throw -
            // rather than a returned { error: true } - left `starting` stuck
            // true and the Start button permanently disabled with nothing on
            // screen: the same silent dead end this change set out to remove,
            // reintroduced by the loading flag that fixed the double click.
            let res: Awaited<ReturnType<typeof createInterview>>;
            try {
              res = await createInterview({ jobInfoId: jobInfo.id });
            } catch (error) {
              console.error("[interview] createInterview threw", error);
              setStarting(false);
              return errorToast("We could not start the interview. Please try again.");
            }

            if (res.error) {
              setStarting(false);
              return errorToast(res.message);
            }
            setInterviewId(res.id);

            // SOURCE OF TRUTH for the Hume EVI contract. The config named by
            // NEXT_PUBLIC_HUME_CONFIG_ID must declare these exact four
            // template variables in its prompt. Hume silently DROPS session
            // variables it does not recognise, so a mismatch produces an
            // interviewer that ignores the job context with no error
            // anywhere. See the README's "Hume EVI configuration" section.
            // Confirmed working 11 Oct 2026: the interviewer opened by naming
            // the role and the company.
            const variables: SessionVariables = {
              userName: user.name,
              title: jobInfo.title || "Untitled Job Info",
              description: jobInfo.description || "No description",
              experienceLevel: jobInfo.experienceLevel || "Unknown",
            };
            // The SDK serialises these into the WebSocket URL, and Hume
            // refuses the handshake once that URL passes ~6.5 KB. A 5,719
            // character job advert encoded to 7,897, so every detailed job
            // description failed to connect - silently, with a 1006 close -
            // while short ones worked. Reproduced on production 11 Oct 2026.
            // The URL gets a bounded prefix; the full set follows over the
            // socket in the effect above once the call is connected.
            const { forConnect, truncated } = fitVariablesForConnect(variables);
            deferredVariablesRef.current = truncated ? variables : null;

            try {
              // AWAITED. This used to be fire-and-forget, so every way a call
              // can fail to start - microphone permission refused, an expired
              // access token, a wrong config id, Hume being down - rejected
              // into nothing. The row had already been written by then, so the
              // user was left looking at an unchanged Start button with no
              // error anywhere, and an interview in their history reading
              // "never finished connecting". Observed in production on
              // 11 Oct 2026.
              await connect({
                auth: { type: "accessToken", value: accessToken },
                configId: env.NEXT_PUBLIC_HUME_CONFIG_ID,
                sessionSettings: {
                  type: "session_settings",
                  variables: forConnect,
                },
              });
            } catch (error) {
              console.error("[interview] connect failed", error);
              errorToast(connectErrorMessage(error));

              // Row left in place on purpose - see the note on the voice-error
              // effect above. Deleting it is what produced 404s.
              deferredVariablesRef.current = null;
              setInterviewId(null);
              setStarting(false);
            }
          }}
        >
          {/* Keyed to the same condition as `disabled`. Deriving one and not
              the other left the button enabled but still reading "Starting…"
              after a failed attempt - clickable and lying about it. */}
          {attemptInFlight ? "Starting…" : "Start Interview"}
        </Button>
      </div>
    );
  }

  if (
    readyState === VoiceReadyState.CONNECTING ||
    readyState === VoiceReadyState.CLOSED
  ) {
    return (
      <div className="h-screen-header flex items-center justify-center">
        <Loader2Icon className="animate-spin size-24" />
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-screen-header flex flex-col-reverse">
      <div className="container py-6 gap-4 flex flex-col items-center justify-end">
        <Messages user={user} />
        <Controls />
      </div>
    </div>
  );
}

function Messages({
  user,
}: {
  user: { name: string; imageUrl: string };
}) {
  const { messages, fft } = useVoice();

  const condensedMessages = useMemo(() => {
    return condenseChatMessages(messages);
  }, [messages]);
  return (
    <CondensedMessages
      messages={condensedMessages}
      user={user}
      maxFft={Math.max(...fft)}
      className="max-w-5xl"
    />
  );
}

function Controls() {
  const { disconnect, isMuted, mute, unmute, micFft, callDurationTimestamp } =
    useVoice();

  return (
    <div className="flex gap-5 rounded border px-5 py-2 w-fit sticky bottom-6 bg-background items-center">
      <Button
        variant="ghost"
        size="icon"
        className="-mx-3"
        onClick={() => (isMuted ? unmute() : mute())}
      >
        {isMuted ? <MicOffIcon className="text-destructive" /> : <MicIcon />}
        <span className="sr-only">{isMuted ? "Unmute" : "Mute"}</span>
      </Button>
      <div className="self-stretch">
        <FftVisualizer fft={micFft} />
      </div>
      <TimeRemaining timestamp={callDurationTimestamp} />
      <Button
        variant="ghost"
        size="icon"
        onClick={disconnect}
        className="-mx-3"
      >
        <PhoneOffIcon className="text-destructive" />
        <span className="sr-only">End Call</span>
      </Button>
    </div>
  );
}

/**
 * Counts DOWN to the cap rather than up from zero. The call ends on its own at
 * MAX_INTERVIEW_SECONDS, so the number that matters to the person talking is
 * how long they have left - an elapsed timer gives no warning at all.
 *
 * Falls back to the raw elapsed timestamp if Hume sends something unparseable,
 * which is what this showed before the cap existed.
 */
function TimeRemaining({ timestamp }: { timestamp: string | null }) {
  const elapsed = parseDurationToSeconds(timestamp);

  if (elapsed == null) {
    return (
      <div className="text-sm text-muted-foreground tabular-nums">
        {timestamp}
      </div>
    );
  }

  const left = remainingSeconds(elapsed);
  const isWarning = left <= INTERVIEW_WARNING_SECONDS;

  return (
    <div
      className={`text-sm tabular-nums ${
        isWarning ? "text-destructive font-medium" : "text-muted-foreground"
      }`}
      title={`Interviews are capped at ${MAX_INTERVIEW_SECONDS / 60} minutes`}
    >
      {formatRemaining(left)} left
    </div>
  );
}

function FftVisualizer({ fft }: { fft: number[] }) {
  return (
    <div className="flex gap-1 items-center h-full">
      {fft.map((value, index) => {
        const percent = (value / 4) * 100;

        return (
          <div
            key={index}
            className="min-h-0.5 bg-primary/75 w-0.5 rounded"
            style={{ height: `${percent < 10 ? 0 : percent}%` }}
          />
        );
      })}
    </div>
  );
}
