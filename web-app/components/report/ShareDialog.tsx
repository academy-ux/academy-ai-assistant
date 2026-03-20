'use client'

import { useState } from 'react'
import { X, Link2, Check, ChevronDown, Lock, Globe, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type Permission = 'anyone' | 'invite-only'

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  title: string
}

export function ShareDialog({ open, onClose, title }: ShareDialogProps) {
  const [permission, setPermission] = useState<Permission>('anyone')
  const [copied, setCopied] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (!open) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-[#1a1a1a] rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <Link2 className="h-4 w-4 text-white/50" />
            <h2 className="text-[15px] font-semibold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-4 w-4 text-white/50" />
          </button>
        </div>

        {/* Invite field */}
        <div className="px-6 pb-4">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-[#0d0d0d] rounded-xl border border-white/10 px-4 h-10">
              <input
                type="text"
                placeholder="Invite by name or email"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              />
              <span className="text-xs text-white/40 ml-2 flex items-center gap-1">
                Can view <ChevronDown className="h-3 w-3" />
              </span>
            </div>
            <button className="h-10 px-5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-white/90 transition-colors">
              Invite
            </button>
          </div>
        </div>

        {/* Who has access */}
        <div className="px-6 pb-4">
          <p className="text-xs text-white/40 font-medium mb-3">Who has access</p>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#272727] flex items-center justify-center text-white/80 text-sm font-bold">
              A
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Adam Perlis</p>
              <p className="text-xs text-white/40">adam.perlis@academyux.com</p>
            </div>
            <span className="text-xs text-white/50 font-medium">Owner</span>
          </div>
        </div>

        {/* Permissions dropdown */}
        <div className="px-6 pb-5">
          <div className="flex items-center justify-between">
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 h-9 bg-[#2a2a2a] rounded-xl text-sm text-white/80 hover:bg-[#333] transition-colors"
              >
                {permission === 'anyone' ? (
                  <Globe className="h-3.5 w-3.5 text-white/50" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-white/50" />
                )}
                {permission === 'anyone' ? 'Anyone with link can view' : 'Invite only'}
                <ChevronDown className="h-3 w-3 text-white/40" />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden z-10">
                  <button
                    onClick={() => { setPermission('anyone'); setDropdownOpen(false) }}
                    className="flex items-center justify-between w-full px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-white/50" />
                      Anyone with link can view
                    </span>
                    {permission === 'anyone' && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                  <button
                    onClick={() => { setPermission('invite-only'); setDropdownOpen(false) }}
                    className="flex items-center justify-between w-full px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-white/50" />
                      Invite only
                    </span>
                    {permission === 'invite-only' && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold transition-all",
                copied
                  ? "bg-green-500/20 text-green-400"
                  : "bg-white text-black hover:bg-white/90"
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>

          {permission === 'anyone' && (
            <p className="text-xs text-white/30 mt-3">
              Published to the web to let anyone access and view. No sign-in required.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
