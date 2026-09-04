import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, autoComplete, ...props }: React.ComponentProps<"input">) {
  // Password managers (Keeper, 1Password, LastPass…) attach badges and menus to inputs they can't classify.
  // These are business-plan fields, never credentials — opt out everywhere unless a field says otherwise.
  const isCredential = type === "password" || type === "email" || autoComplete === "current-password" || autoComplete === "new-password" || autoComplete === "email" || autoComplete === "name";
  const pmIgnore = isCredential ? {} : { autoComplete: autoComplete ?? "off", "data-1p-ignore": "", "data-lpignore": "true", "data-bwignore": "", "data-form-type": "other", "data-keeper-ignore": "" };
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded border border-input bg-card px-[11px] py-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...(isCredential ? { autoComplete } : {})}
      {...pmIgnore}
      {...props}
    />
  )
}

export { Input }
