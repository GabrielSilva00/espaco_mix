import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { getAccessTokenSafe } from '../../lib/supabase';

export type EnvStatusMap = Record<string, boolean>;

let cachedStatus: EnvStatusMap | null = null;
let fetchPromise: Promise<EnvStatusMap> | null = null;

async function fetchEnvStatus(): Promise<EnvStatusMap> {
  if (cachedStatus) return cachedStatus;
  if (!fetchPromise) {
    fetchPromise = getAccessTokenSafe()
      .then(token => fetch('/api/admin/env-status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }))
      .then(r => r.ok ? r.json() : {})
      .then(data => { cachedStatus = data; return data; })
      .catch(() => ({}));
  }
  return fetchPromise;
}

export function useEnvStatus() {
  const [status, setStatus] = useState<EnvStatusMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnvStatus().then(s => { setStatus(s); setLoading(false); });
  }, []);

  return { status, loading };
}

interface BadgeProps {
  configured: boolean | undefined;
  label: string;
}

export function EnvStatusBadge({ configured, label }: BadgeProps) {
  if (configured === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 text-white/30 border border-white/10">
        <Loader2 className="w-3 h-3 animate-spin" />
        {label}
      </span>
    );
  }

  if (configured) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20">
        <CheckCircle2 className="w-3 h-3" />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      <AlertTriangle className="w-3 h-3" />
      {label}
    </span>
  );
}
