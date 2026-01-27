'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string) => void
}

export function VoiceRecorder({ onTranscriptionComplete }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  
  // Visualization refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Setup Audio Context for visualization
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext)
      const audioContext = new AudioContextClass()
      audioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyserRef.current = analyser
      analyser.fftSize = 64 // Lower fftSize for fewer, chunkier bars
      
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source
      source.connect(analyser)
      
      // Start visualizer loop
      visualize()

      mediaRecorderRef.current = new MediaRecorder(stream)
      chunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsProcessing(true)
        
        // Cleanup visualization
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
        }
        if (audioContextRef.current) {
            audioContextRef.current.close()
        }

        await transcribeAudio(audioBlob)
        setIsProcessing(false)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Could not access microphone. Please allow microphone permissions.')
    }
  }

  const visualize = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      const width = canvas.width
      const height = canvas.height
      
      ctx.clearRect(0, 0, width, height)

      // Get primary color from CSS variable if possible, or fallback
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#000'
      // Since we can't easily parse HSL in canvas fillStyle without conversion if it's just numbers, 
      // let's try to use the raw value if it's a color, otherwise fallback to a known dark/light compatible color.
      // Usually --primary is HSL numbers "222.2 47.4% 11.2%". 
      // Safest is to use `hsl(...)` string construction:
      ctx.fillStyle = `hsl(${primaryColor})`
      if (!ctx.fillStyle || ctx.fillStyle === '#000000') {
         // Fallback if variable didn't work
         ctx.fillStyle = '#f97316' // Orange-ish
      }

      const barWidth = (width / bufferLength) * 2
      let barHeight
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height
        // Draw centered bars
        const y = (height - barHeight) / 2
        
        // Rounded bars
        roundRect(ctx, x, y, barWidth - 1, barHeight, 2)
        ctx.fill()
        
        x += barWidth
      }
    }
    draw()
  }
  
  // Helper for rounded rect in canvas
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (data.text) {
        onTranscriptionComplete(data.text)
      } else {
        console.error('Transcription failed:', data.error)
      }
    } catch (error) {
      console.error('Error uploading audio:', error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-muted"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        title={isRecording ? "Stop recording" : "Record voice memo"}
        type="button"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : isRecording ? (
          <Square className="h-4 w-4 text-destructive fill-current" />
        ) : (
          <Mic className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        )}
      </Button>
      
      {isRecording && (
        <canvas 
          ref={canvasRef} 
          width={100} 
          height={24} 
          className="rounded opacity-80"
        />
      )}
    </div>
  )
}
