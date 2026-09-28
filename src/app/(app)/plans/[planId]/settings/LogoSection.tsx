"use client";

import { ImageUpload } from "@/components/module/ImageUpload";
import { uploadLogo, removeLogo } from "./actions";

/** The plan's logo (§6.94) — the client's own, on their own business plan. */
export function LogoSection({ planId, path, url, onPending }: {
  planId: string;
  /** The stored object path, or null. */
  path: string | null;
  /** A signed URL for it, minted on the server for this request (§6.94). */
  url: string | null;
  onPending: (busy: boolean, error?: string) => void;
}) {
  return (
    <ImageUpload title="Logo" path={path} url={url} onPending={onPending}
      upload={(form) => uploadLogo(planId, form)} remove={() => removeLogo(planId)}
      blurb={<>It goes on the <b>cover of the business plan</b> and in the header of every page after it, on the screen and in the Word download.</>} />
  );
}
