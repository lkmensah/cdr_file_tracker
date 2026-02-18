import { saveAs } from "file-saver";
import type { CorrespondenceFile, InternalDraft } from "./types";

/**
 * Client-side utility to trigger server-side DOCX generation and download.
 */
export async function downloadLegalDoc(draft: InternalDraft, file: CorrespondenceFile, type: 'letter' | 'memo') {
  const res = await fetch("/api/generate-draft", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ draft, file, type }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to generate document");
  }

  const blob = await res.blob();
  const filename = `${draft.title.replace(/[^a-z0-9]/gi, '_')}.docx`;
  saveAs(blob, filename);
}