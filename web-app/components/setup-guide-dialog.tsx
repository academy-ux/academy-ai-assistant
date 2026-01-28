'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HelpCircle, FileText, FolderOpen } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function SetupGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="default" className="px-4 gap-2 text-muted-foreground">
          <HelpCircle className="h-4 w-4" />
          Setup Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">How It Works</DialogTitle>
          <DialogDescription>
            Your meetings are automatically transcribed and ready for feedback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Automatic Recording */}
          <div className="flex gap-4">
            <div className="flex-none">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Automatic Transcription</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Any Google Meet meeting you have will be <strong>automatically recorded and transcribed</strong>. Once the meeting ends, the transcript will appear in your <strong>History</strong> and be ready for AI analysis in the <strong>Feedback</strong> section.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                No setup required—just have your meetings as usual and they'll show up here.
              </p>
            </div>
          </div>

          <Separator />

          {/* Import Old Meetings */}
          <div className="flex gap-4">
            <div className="flex-none">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FolderOpen className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Importing Old Meetings</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Have existing meeting transcripts in Google Drive that you'd like to analyze? You can import them:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                <li>Click the <strong>Import from Drive</strong> button.</li>
                <li>Search for the folder containing your old transcripts (e.g., "Meet Recordings").</li>
                <li>Select the files you want to import.</li>
              </ul>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Once imported, these transcripts will also be available for AI feedback.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
