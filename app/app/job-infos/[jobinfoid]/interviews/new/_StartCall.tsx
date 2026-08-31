"use client";

import { env } from "@/app/data/env/client";
import { jobInfoTable } from "@/app/drizzle/schema";
import {
  createInterview,
  updateInterview,
} from "@/app/features/interviews/actions";
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
  const { connect, readyState, chatMetadata, callDurationTimestamp } =
    useVoice();
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const durationRef = useRef(callDurationTimestamp);
  // humeChatId is write-once server-side, so guard against a duplicate attempt
  // when this effect re-runs.
  const chatIdWrittenRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    durationRef.current = callDurationTimestamp;
  }, [callDurationTimestamp]);

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

  // Handle Disconnect
  useEffect(() => {
    if (readyState !== VoiceReadyState.CLOSED) return;
    if (interviewId == null) {
      router.push(`/app/job-infos/${jobInfo.id}/interviews`);
      return;
    }

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

  if (readyState === VoiceReadyState.IDLE) {
    return (
      <div className="flex justify-center items-center h-screen-header">
        <Button
          size="lg"
          onClick={async () => {
            // TODO Create Interview
            const res = await createInterview({ jobInfoId: jobInfo.id });

            if (res.error) {
              return errorToast(res.message);
            }
            setInterviewId(res.id);
            connect({
              auth: { type: "accessToken", value: accessToken },
              configId: env.NEXT_PUBLIC_HUME_CONFIG_ID,
              sessionSettings: {
                type: "session_settings",
                variables: {
                  userName: user.name,
                  title: jobInfo.title || "Untitled Job Info",
                  description: jobInfo.description || "No description",
                  experienceLevel: jobInfo.experienceLevel || "Unknown",
                },
              },
            });
          }}
        >
          Start Interview
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
      <div className="text-sm text-muted-foreground tabular-nums">
        {callDurationTimestamp}
      </div>
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
