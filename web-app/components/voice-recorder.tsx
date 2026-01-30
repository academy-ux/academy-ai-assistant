'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Waveform,
  MicrophoneWaveform,
  LiveMicrophoneWaveform,
  ScrollingWaveform,
  StaticWaveform,
  AudioScrubber,
  RecordingWaveform,
} from '@/components/ui/waveform'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string) => void
  onRecordingChange?: (isRecording: boolean) => void
}

export function VoiceRecorder({ onTranscriptionComplete, onRecordingChange }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  
  // Ref to hold the stream so we can access it in useEffect without re-creating functions
  const streamRef = useRef<MediaStream | null>(null)

  // Cleanup on unmount - stop any active media streams to prevent memory leaks
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Visualization refs (old implementation commented out)
  // const canvasRef = useRef<HTMLCanvasElement>(null)
  // const animationFrameRef = useRef<number>()
  // const audioContextRef = useRef<AudioContext | null>(null)
  // const analyserRef = useRef<AnalyserNode | null>(null)
  // const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
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
        
        await transcribeAudio(audioBlob)
        setIsProcessing(false)
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      onRecordingChange?.(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Could not access microphone. Please allow microphone permissions.')
    }
  }

  // Effect to handle visualization startup after state change + render
  // useEffect(() => {
  //   if (isRecording && streamRef.current && canvasRef.current) {
  //     // Initialize Audio Context
  //     const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext)
  //     const audioContext = new AudioContextClass()
  //     audioContextRef.current = audioContext
      
  //     const analyser = audioContext.createAnalyser()
  //     analyserRef.current = analyser
  //     analyser.fftSize = 2048
      
  //     const source = audioContext.createMediaStreamSource(streamRef.current)
  //     sourceRef.current = source
  //     source.connect(analyser)
      
  //     // Start loop
  //     const visualize = () => {
  //       const canvas = canvasRef.current
  //       const analyser = analyserRef.current
  //       if (!canvas || !analyser) return
    
  //       const ctx = canvas.getContext('2d')
  //       if (!ctx) return
    
  //       const bufferLength = analyser.frequencyBinCount
  //       const dataArray = new Uint8Array(bufferLength)
    
  //       const draw = () => {
  //         animationFrameRef.current = requestAnimationFrame(draw)
  //         analyser.getByteTimeDomainData(dataArray)
    
  //         const width = canvas.width
  //         const height = canvas.height
          
  //         ctx.clearRect(0, 0, width, height)
    
  //         // Get primary color
  //         const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#000'
          
  //         ctx.lineWidth = 2
  //         ctx.strokeStyle = `hsl(${primaryColor})`
  //         if (!ctx.strokeStyle || ctx.strokeStyle === '#000000') {
  //            ctx.strokeStyle = '#f97316' 
  //         }
    
  //         ctx.beginPath()
    
  //         const sliceWidth = width * 1.0 / bufferLength
  //         let x = 0
    
  //         for (let i = 0; i < bufferLength; i++) {
  //           const v = dataArray[i] / 128.0
  //           const y = v * height / 2
    
  //           if (i === 0) {
  //             ctx.moveTo(x, y)
  //           } else {
  //             ctx.lineTo(x, y)
  //           }
    
  //           x += sliceWidth
  //         }
    
  //         ctx.lineTo(canvas.width, canvas.height / 2)
  //         ctx.stroke()
  //       }
  //       draw()
  //     }
      
  //     visualize()
  //   }
    
  //   // Cleanup on unmount or when recording stops
  //   return () => {
  //       if (animationFrameRef.current) {
  //           cancelAnimationFrame(animationFrameRef.current)
  //       }
  //       if (audioContextRef.current) {
  //           audioContextRef.current.close()
  //       }
  //   }
  // }, [isRecording])

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      onRecordingChange?.(false)
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
          <Loader2 className="h-4 w-4 animate-spin-medium text-muted-foreground" />
        ) : isRecording ? (
          <Square className="h-4 w-4 text-destructive fill-current" />
        ) : (
          <Mic className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        )}
      </Button>
      
      {isRecording && (
        <div className="w-[200px] h-8 flex items-center">
          <MicrophoneWaveform 
            active={isRecording}
            height={32}
            barWidth={2}
            barGap={1}
            barRadius={2}
            className="w-full text-foreground"
          />
        </div>
      )}
    </div>
  )
}
