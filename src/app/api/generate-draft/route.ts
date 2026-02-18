import { NextResponse } from "next/server";
import { generateLegalDocBuffer } from "@/server/docx/generate-draft";

export async function POST(req: Request) {
  try {
    const { draft, file, type } = await req.json();
    
    if (!draft || !file || !type) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    const buffer = await generateLegalDocBuffer(draft, file, type);
    const filename = `${draft.title.replace(/[^a-z0-9]/gi, '_')}.docx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Doc generation error:", error);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}