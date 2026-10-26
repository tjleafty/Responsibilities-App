import { useState } from "react"
import { Check, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Chip, ErrorNote, Field, Sheet } from "@/components/kit"
import { Textarea } from "@/components/ui/textarea"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { reviewCompletion, SEND_BACK_REASONS } from "@/lib/choreActions"
import { firstName } from "@/lib/family"

interface ReviewContext {
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  profiles: FamilyProfile[]
  onRefresh: () => Promise<void>
}

/** Approve and send-back actions shared by the Today and Approve screens. */
export function useReview(context: ReviewContext) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendingBack, setSendingBack] = useState<ChoreCompletionRecord | null>(null)

  const approve = async (completion: ChoreCompletionRecord, celebrate = true) => {
    setBusyId(completion.id)
    setError(null)
    try {
      await reviewCompletion(completion, "approved", context, { celebrate })
      await context.onRefresh()
    } catch (caught) {
      console.error("Approve failed:", caught)
      setError("We couldn't approve that chore. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  const approveAll = async (rows: ChoreCompletionRecord[]) => {
    setBusyId("all")
    setError(null)
    try {
      for (const row of rows) await reviewCompletion(row, "approved", context, { celebrate: false })
      await context.onRefresh()
    } catch (caught) {
      console.error("Approve all failed:", caught)
      setError("Some chores weren't approved. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  const sheet = (
    <SendBackSheet
      completion={sendingBack}
      chore={context.chores.find((chore) => chore.id === sendingBack?.chore_id)}
      kid={context.profiles.find((profile) => profile.id === sendingBack?.profile_id)}
      onClose={() => setSendingBack(null)}
      onSend={async (reason, note) => {
        if (!sendingBack) return
        await reviewCompletion(sendingBack, "rejected", context, { reason, note })
        await context.onRefresh()
        setSendingBack(null)
      }}
    />
  )

  return { approve, approveAll, sendBack: setSendingBack, busyId, error, sheet }
}

function SendBackSheet({ completion, chore, kid, onClose, onSend }: {
  completion: ChoreCompletionRecord | null
  chore?: ChoreRecord
  kid?: FamilyProfile
  onClose: () => void
  onSend: (reason: string, note: string) => Promise<void>
}) {
  const [reason, setReason] = useState(SEND_BACK_REASONS[0])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = firstName(kid) || "them"

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await onSend(reason, note)
      setNote("")
      setReason(SEND_BACK_REASONS[0])
    } catch (caught) {
      console.error("Send back failed:", caught)
      setError("We couldn't send that back. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={Boolean(completion)}
      onOpenChange={(open) => { if (!open) onClose() }}
      title={`Send back to ${name}?`}
      description={chore ? `${chore.title}. ${name} will see your note and can try again.` : undefined}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => void send()} disabled={busy} className="flex-1 bg-coral text-primary-foreground hover:bg-coral/90"><RotateCcw className="h-5 w-5" />{busy ? "Sending..." : "Send back"}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-bold">What needs another try?</p>
          <div className="flex flex-wrap gap-2">
            {SEND_BACK_REASONS.map((item) => (
              <Chip key={item} active={reason === item} onClick={() => setReason(item)}>{reason === item ? <Check className="h-4 w-4" /> : null}{item}</Chip>
            ))}
          </div>
        </div>
        <Field label={`Note for ${name} (optional)`} hint="Keep it kind and specific. Kids see this on the chore.">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} placeholder="The forks go on the left side of the plate!" rows={3} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  )
}
