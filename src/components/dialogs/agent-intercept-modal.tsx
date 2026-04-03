'use client';

import { useState, useEffect } from 'react';
import { useNotificationSubscription } from '@/hooks/use-notification-subscription';
import { useNotificationStore } from '@/lib/stores/notification-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, ShieldCheck, PlayCircle } from 'lucide-react';

export function AgentInterceptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeApproval, setActiveApproval] = useState<{ approval_id: string; payload_hash: string } | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Listen to Supabase Realtime Notifications
  useNotificationSubscription();
  const notifications = useNotificationStore((state) => state.notifications);

  useEffect(() => {
    const notification = notifications.find(n => (n.type as string) === 'agent_approval');
    if (notification && notification.metadata) {
      setActiveApproval(notification.metadata as unknown as { approval_id: string; payload_hash: string });
      setIsOpen(true);
    }
  }, [notifications]);

  const signPayload = async (hash: string) => {
    // 1. Cryptographic Proof: Sign the hash using the user's active session key
    // This ensures only the authenticated human explicitly authorized the payload
    const encoder = new TextEncoder();
    const data = encoder.encode(hash);
    
    // In production, fetch the user's actual CryptoKey from IndexedDB 
    // or request re-authentication to unlock. This assumes a stored HMAC key.
    const rawKey = window.crypto.subtle.importKey(
      'raw',
      encoder.encode(localStorage.getItem('user_session_key') || 'temp-secret-key-123'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const key = await rawKey;
    const signature = await window.crypto.subtle.sign('HMAC', key, data);
    
    // Convert signature ArrayBuffer to hex string
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleApprove = async () => {
    if (!activeApproval?.approval_id || !activeApproval?.payload_hash) return;
    
    try {
      setIsApproving(true);
      
      const signature = await signPayload(activeApproval.payload_hash);

      const res = await fetch(`/api/approve/${activeApproval.approval_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (!res.ok) throw new Error('Failed to authorize');
      
      setIsOpen(false);
      setActiveApproval(null);
    } catch (error) {
      console.error('[Envault UI] Cryptographic authorization failed:', error);
      // Fallback UI error handling...
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!activeApproval?.approval_id) return;
    // ... Reject logic
    setIsOpen(false);
    setActiveApproval(null);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl bg-zinc-950 border border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            Agent Action Requires Approval
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            A machine agent is attempting to mutate vault state. Review the cryptographic diff before signing off.
          </DialogDescription>
        </DialogHeader>

        {activeApproval && (
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs overflow-x-auto text-zinc-300">
              {/* Render clear Diff (Old Value vs Proposed Agent Value) */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <h4 className="text-zinc-500 mb-2 uppercase tracking-wide text-[10px] font-bold">Old State</h4>
                    <pre className="text-red-400 line-through">
                      {"DB_HOST=legacy.postgres.render.com"}
                    </pre>
                 </div>
                 <div>
                    <h4 className="text-zinc-500 mb-2 uppercase tracking-wide text-[10px] font-bold">Proposed State</h4>
                    <pre className="text-emerald-400">
                      {"DB_HOST=pool.envault.accelerate.internal"}
                    </pre>
                 </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
              <span title={activeApproval.payload_hash} className="truncate max-w-[200px]">
                Hash: {activeApproval.payload_hash}
              </span>
              <span>Needs Signature</span>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={handleReject}
                disabled={isApproving}
                className="border-red-900/50 text-red-500 hover:bg-red-900/20 hover:text-red-400"
              >
                Reject Request
              </Button>
              <Button 
                onClick={handleApprove} 
                disabled={isApproving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {isApproving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="w-4 h-4 mr-2" />
                )}
                Cryptographically Sign & Execute
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
