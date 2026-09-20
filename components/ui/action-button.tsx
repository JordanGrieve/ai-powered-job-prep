"use client"

import { type ComponentProps, type ReactNode, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { errorToast } from "@/lib/errorToast"
import { LoadingSwap } from "@/components/ui/loading-swap"
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function ActionButton({
  action,
  requireAreYouSure = false,
  areYouSureDescription = "This action cannot be undone.",
  ...props
}: ComponentProps<typeof Button> & {
  action: () => Promise<{ error: boolean; message?: string }>
  requireAreYouSure?: boolean
  areYouSureDescription?: ReactNode
}) {
  const [isLoading, startTransition] = useTransition()
  const router = useRouter()

  function performAction() {
    startTransition(async () => {
      // Without the catch, a rejected action leaves the button silently
      // un-spinning with nothing but an opaque digest in the server logs.
      try {
        const data = await action()
        if (data.error) {
          errorToast(data.message ?? "Error")
          return
        }

        // revalidateTag inside the action clears the SERVER data cache, but
        // the browser still holds the rendered RSC payload for this route, so
        // the page keeps showing pre-action state until something refetches
        // it. Generating interview feedback looked like it did nothing at all:
        // the work succeeded, 6227 characters were written, and the button
        // still said "Generate Feedback". The user then ran it a second time -
        // a second full Hume + Gemini pipeline - because the UI gave them no
        // reason to think the first had worked.
        router.refresh()
      } catch (error) {
        console.error("[action-button] action threw", error)
        errorToast("Something went wrong. Please try again.")
      }
    })
  }

  if (requireAreYouSure) {
    return (
      <AlertDialog open={isLoading ? true : undefined}>
        <AlertDialogTrigger asChild>
          <Button {...props} />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {areYouSureDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={performAction}>
              <LoadingSwap isLoading={isLoading}>Yes</LoadingSwap>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <Button
      {...props}
      disabled={props.disabled ?? isLoading}
      onClick={e => {
        performAction()
        props.onClick?.(e)
      }}
    >
      <LoadingSwap
        isLoading={isLoading}
        className="inline-flex items-center gap-2"
      >
        {props.children}
      </LoadingSwap>
    </Button>
  )
}
