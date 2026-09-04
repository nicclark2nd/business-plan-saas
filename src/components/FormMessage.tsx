export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">{children}</p>;
}
