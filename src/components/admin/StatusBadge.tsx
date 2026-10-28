import { ACCOUNT_STATUS, type AccountStatus } from "@/lib/companyAdmin"
import { cn } from "@/lib/utils"

export function StatusBadge({ status, className }: { status: AccountStatus; className?: string }) {
  const { label, tone } = ACCOUNT_STATUS[status]
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold", tone, className)}>{label}</span>
}
