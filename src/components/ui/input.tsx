"use client";

import * as React from "react"
import { cn } from "cn"
import { useEffect, useRef } from "react"

/** Some password-manager injectors (Psono / SecurePass) re-style inputs and rewrite autocomplete; undo that whenever it happens. */
function useInjectorDefence(ref: React.RefObject<HTMLInputElement | null>, expectedAutocomplete: string | undefined) {
  useEffect(() => {
    const input = ref.current
    if (!input) return
    const isModified = () => input.classList.contains("psono-icon-injected") || Array.from(input.classList).some((c) => c.startsWith("securepass-"))
    const clean = () => {
      if (!isModified()) return
      for (const prop of ["background-image", "background-position", "background-repeat", "background-size"]) input.style.removeProperty(prop)
      if (expectedAutocomplete && input.getAttribute("autocomplete") !== expectedAutocomplete) input.setAttribute("autocomplete", expectedAutocomplete)
    }
    clean()
    const obs = new MutationObserver(clean)
    obs.observe(input, { attributes: true, attributeFilter: ["class", "style", "autocomplete"] })
    return () => obs.disconnect()
  }, [ref, expectedAutocomplete])
}

function Input({ className, type, autoComplete, onClickCapture, ...props }: React.ComponentProps<"input">) {
  const ref = useRef<HTMLInputElement>(null)
  // Password managers (Keeper, 1Password, LastPass…) attach badges and menus to inputs they can't classify.
  // These are business-plan fields, never credentials — opt out everywhere unless a field says otherwise.
  const isCredential = type === "password" || type === "email" || autoComplete === "current-password" || autoComplete === "new-password" || autoComplete === "email" || autoComplete === "name";
  // Chrome ignores autocomplete="off" on name/address-looking fields and offers saved addresses; a value it
  // does not recognise as fillable ("one-time-code") suppresses that menu.
  const pmIgnore = isCredential ? {} : { autoComplete: autoComplete ?? "off", "data-1p-ignore": "", "data-lpignore": "true", "data-bwignore": "", "data-form-type": "other", "data-keeper-ignore": "" };
  const expected = isCredential ? autoComplete : (autoComplete ?? "off")
  useInjectorDefence(ref, expected)
  const handleClickCapture: React.MouseEventHandler<HTMLInputElement> = (e) => {
    onClickCapture?.(e)
    const el = e.currentTarget
    const modified = el.classList.contains("psono-icon-injected") || Array.from(el.classList).some((c) => c.startsWith("securepass-"))
    if (modified && e.clientX >= el.getBoundingClientRect().right - 52) e.stopPropagation()
  }
  return (
    <input
      suppressHydrationWarning
      ref={ref}
      onClickCapture={handleClickCapture}
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
