import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, TestTube, CheckCircle2, AlertTriangle, Info, Key,
  RefreshCcw, ShieldCheck, Copy, ExternalLink, Link2, Unlink, Percent
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentStatus {
  provider: string;
  configured: boolean;
  environment: 'production' | 'test' | 'unset';
  publicKeyMasked: string;
  webhookConfigured: boolean;
}

export function MercadoPagoSettings({ userRole }: { userRole?: string | null }) {
  const isDev = userRole === 'developer';
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const serverUrl = window.location.origin.replace(':5173', ':3000');
  const webhookUrl = `${window.location.origin.replace(':5173', ':3000')}/api/webhook/mercadopago`;

  const authHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      // Protege contra getSession() travado em produção: nunca deixa o spinner girar p/ sempre.
      const headers = await Promise.race([
        authHeader(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout-sessao')), 8000)),
      ]);
      if (!headers) { setLoading(false); return; }
      const res = await fetch(`${serverUrl}/api/admin/payment-status`, { headers, signal: AbortSignal.timeout(12000) });
      if (res.ok) setStatus(await res.json());
    } catch (e) {
      console.warn('[MP Settings] Falha ao carregar status:', e);
    } finally {
      setLoading(false);
    }
  }, [authHeader, serverUrl]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const headers = await authHeader();
      if (!headers) {
        setTestStatus('error');
        setTestMessage('❌ Sessão expirada. Faça login novamente.');
        return;
      }
      // Corpo vazio: o servidor testa com as credenciais das variáveis de ambiente.
      const response = await fetch(`${serverUrl}/api/admin/test-mercadopago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (response.ok) {
        setTestStatus('success');
        setTestMessage('✓ Conexão com o Mercado Pago estabelecida com sucesso.');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Erro na conexão com o Mercado Pago.');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('❌ Erro ao conectar. Verifique o servidor/backend.');
    }
    setTimeout(() => setTestStatus('idle'), 6000);
  };

  const isProd = status?.environment === 'production';
  const isConfigured = !!status?.configured;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
          <Key className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-serif text-[#d4af37]">Mercado Pago</h2>
          <p className="text-xs uppercase tracking-widest opacity-40">Status da integração de pagamentos</p>
        </div>
      </div>

      {/* Split de pagamentos — conexão da conta do organizador (vendedor) */}
      <SplitConnection authHeader={authHeader} serverUrl={serverUrl} />

      {/* Explicação: credenciais ficam na Vercel — só developer */}
      {isDev && (
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-400/90 leading-relaxed">
          As credenciais do Mercado Pago (Access Token e Public Key) ficam guardadas com
          segurança nas <strong>variáveis de ambiente</strong> do servidor (Vercel) — não são
          editadas por esta tela. Aqui você apenas confere o status e testa a conexão. Para
          alterar as credenciais, consulte o documento <code className="bg-black/40 px-1 rounded">ENTREGA.md</code>.
        </p>
      </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCcw className="w-6 h-6 text-[#d4af37] animate-spin" />
        </div>
      ) : (
        <>
          {/* Cartão de status do ambiente */}
          <div className={`p-4 rounded-xl border-2 flex gap-4 ${
            !isConfigured ? 'border-white/20 bg-white/5'
            : isProd ? 'border-red-500/50 bg-red-500/5' : 'border-yellow-500/50 bg-yellow-500/5'}`}>
            <div className={!isConfigured ? 'text-white/40' : isProd ? 'text-red-400' : 'text-yellow-400'}>
              {!isConfigured ? <AlertTriangle className="w-5 h-5" /> : isProd ? <ShieldCheck className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-bold text-sm text-white mb-1">
                {!isConfigured ? '⚪ Não configurado'
                  : isProd ? '🔴 PRODUÇÃO — Cobranças reais' : '🟡 TESTE — Sem cobranças'}
              </p>
              <p className="text-xs text-white/60">
                {!isConfigured
                  ? 'Nenhuma credencial encontrada no servidor. Configure as variáveis de ambiente na Vercel (ver ENTREGA.md).'
                  : isProd
                    ? 'O site está cobrando pagamentos de verdade.'
                    : 'Credenciais de teste em uso. Nenhuma cobrança real será feita.'}
              </p>
            </div>
          </div>

          {/* Indicadores read-only */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatusItem label="Provedor de pagamento" value={status?.provider || '—'} ok={status?.provider === 'mercadopago'} />
            <StatusItem label="Public Key" value={status?.publicKeyMasked || 'não definida'} ok={!!status?.publicKeyMasked} mono />
            <StatusItem label="Access Token" value={isConfigured ? 'definido' : 'ausente'} ok={isConfigured} />
            <StatusItem label="Webhook (assinatura)" value={status?.webhookConfigured ? 'configurado' : 'ausente'} ok={!!status?.webhookConfigured} />
          </div>

          {/* Seções técnicas — visíveis apenas para developer */}
          {isDev && (
          <>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start gap-3">
            <Key className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white/80 mb-1">Configuração das credenciais</p>
              <p className="text-[11px] text-white/40 leading-relaxed">
                O <strong className="text-white/60">Access Token</strong> e a <strong className="text-white/60">Public Key</strong> devem ser configurados diretamente nas variáveis de ambiente do Vercel (<code className="bg-black/40 px-1 rounded">MERCADOPAGO_ACCESS_TOKEN</code> e <code className="bg-black/40 px-1 rounded">VITE_MERCADOPAGO_PUBLIC_KEY</code>). Passo a passo no <code className="bg-black/40 px-1 rounded">ENTREGA.md</code>.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <label className="block text-sm font-bold uppercase tracking-widest mb-3">
              <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-[#d4af37]" /> URL do Webhook</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text" value={webhookUrl} readOnly
                className="flex-1 bg-[#0f0f0f] border border-white/10 rounded-lg px-4 py-2 text-sm font-mono text-white/60 focus:outline-none"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(webhookUrl); }}
                className="px-3 py-2 hover:bg-white/5 rounded-lg transition text-white/40 hover:text-white"
                title="Copiar"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-white/40 mt-3">
              Registre esta URL no painel do Mercado Pago (Webhooks → Adicionar). Passo a passo no
              <code className="bg-black/40 px-1 rounded mx-1">ENTREGA.md</code>.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TestTube className="w-4 h-4 text-[#d4af37]" />
                <label className="text-sm font-bold uppercase tracking-widest">Testar Conexão</label>
              </div>
              <button
                onClick={handleTestConnection}
                disabled={!isConfigured || testStatus === 'testing'}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition ${
                  testStatus === 'testing' ? 'bg-white/10 text-white/50 cursor-not-allowed' :
                  testStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                  testStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                  !isConfigured ? 'bg-white/10 text-white/30 cursor-not-allowed' :
                  'bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37]'
                }`}
              >
                {testStatus === 'testing' && <RefreshCcw className="inline w-4 h-4 mr-2 animate-spin" />}
                {testStatus === 'success' && <CheckCircle2 className="inline w-4 h-4 mr-2" />}
                {testStatus === 'error' && <AlertCircle className="inline w-4 h-4 mr-2" />}
                {testStatus === 'idle' ? 'Testar' : testStatus === 'testing' ? 'Testando...' : 'Testado'}
              </button>
            </div>
            {testMessage && (
              <div className={`p-3 rounded-lg text-xs ${testStatus === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {testMessage}
              </div>
            )}
          </div>

          <a
            href="https://www.mercadopago.com.br/developers/panel"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-[#d4af37] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Painel de Desenvolvedor do Mercado Pago
          </a>
          </>
          )}
        </>
      )}
    </div>
  );
}

interface SplitStatus {
  connected: boolean;
  oauthConfigured: boolean;
  nickname: string | null;
  userId: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  feeManagedByEnv: boolean;
  feeType: 'percentage' | 'fixed' | null;
  feeValue: number | null;
}

function SplitConnection({
  authHeader,
  serverUrl,
}: {
  authHeader: () => Promise<{ Authorization: string } | null>;
  serverUrl: string;
}) {
  const [status, setStatus] = useState<SplitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Banner pós-redirect do OAuth (?mp=connected | ?mp=error)
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeader();
      if (!headers) { setLoading(false); return; }
      const res = await fetch(`${serverUrl}/api/admin/mp/connection-status`, { headers, signal: AbortSignal.timeout(12000) });
      if (res.ok) setStatus(await res.json());
    } catch (e) {
      console.warn('[Split] Falha ao carregar status:', e);
    } finally {
      setLoading(false);
    }
  }, [authHeader, serverUrl]);

  useEffect(() => { load(); }, [load]);

  // Lê o retorno do OAuth na URL e limpa os parâmetros.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mp = params.get('mp');
    if (mp === 'connected') setFlash({ kind: 'ok', msg: 'Conta do Mercado Pago conectada com sucesso.' });
    else if (mp === 'error') setFlash({ kind: 'err', msg: `Falha ao conectar (${params.get('reason') || 'erro'}).` });
    if (mp) {
      params.delete('mp'); params.delete('reason');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  const connect = async () => {
    setBusy(true); setError('');
    try {
      const headers = await authHeader();
      if (!headers) { setError('Sessão expirada. Faça login novamente.'); setBusy(false); return; }
      const res = await fetch(`${serverUrl}/api/admin/mp/oauth/url`, { headers });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setError(data.error || 'Não foi possível iniciar a conexão.');
    } catch {
      setError('Erro ao iniciar a conexão com o Mercado Pago.');
    }
    setBusy(false);
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar a conta do Mercado Pago? Os pagamentos voltam a usar o token único (sem split).')) return;
    setBusy(true); setError('');
    try {
      const headers = await authHeader();
      if (!headers) { setError('Sessão expirada. Faça login novamente.'); setBusy(false); return; }
      const res = await fetch(`${serverUrl}/api/admin/mp/disconnect`, { method: 'POST', headers });
      if (res.ok) await load();
      else setError('Não foi possível desconectar.');
    } catch {
      setError('Erro ao desconectar.');
    }
    setBusy(false);
  };

  const feeLabel = status?.feeManagedByEnv
    ? (status.feeType === 'fixed' ? `R$ ${Number(status.feeValue).toFixed(2)} por compra` : `${status.feeValue}% por compra`)
    : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-[#d4af37]" />
        <label className="text-sm font-bold uppercase tracking-widest">Split de Pagamentos — Conta do Organizador</label>
      </div>
      <p className="text-[11px] text-white/40 leading-relaxed">
        Conecte a conta Mercado Pago do organizador (vendedor). Os pagamentos passam a cair direto
        na conta dele e a comissão do desenvolvedor é repartida automaticamente (marketplace_fee).
      </p>

      {flash && (
        <div className={`p-3 rounded-lg text-xs ${flash.kind === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {flash.msg}
        </div>
      )}

      {feeLabel && (
        <div className="bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-lg p-3 flex items-center gap-2 text-xs text-[#d4af37]/90">
          <Percent className="w-3.5 h-3.5 shrink-0" />
          Comissão do desenvolvedor: <strong>{feeLabel}</strong> (definida pelo servidor — não editável no painel).
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 text-xs py-2"><RefreshCcw className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : !status?.oauthConfigured ? (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 flex gap-2 text-xs text-yellow-400/90">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          OAuth não configurado no servidor. Defina <code className="bg-black/40 px-1 rounded">MP_MARKETPLACE_CLIENT_ID</code>,
          <code className="bg-black/40 px-1 rounded mx-1">MP_MARKETPLACE_CLIENT_SECRET</code> e
          <code className="bg-black/40 px-1 rounded ml-1">MP_OAUTH_REDIRECT_URI</code> (ver <code className="bg-black/40 px-1 rounded">.env.example</code>).
        </div>
      ) : status.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="w-4 h-4" /> Conectado
            {status.nickname && <span className="text-white/60 font-mono text-xs">({status.nickname})</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-white/40">
            {status.userId && <div>Conta MP: <span className="text-white/60 font-mono">{status.userId}</span></div>}
            {status.connectedAt && <div>Conectado em: <span className="text-white/60">{new Date(status.connectedAt).toLocaleString('pt-BR')}</span></div>}
          </div>
          <button
            onClick={disconnect}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase bg-red-500/10 hover:bg-red-500/20 text-red-400 transition disabled:opacity-50"
          >
            <Unlink className="w-4 h-4" /> Desconectar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <AlertCircle className="w-4 h-4" /> Não conectado — pagamentos usam o token único (sem split).
          </div>
          <button
            onClick={connect}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] transition disabled:opacity-50"
          >
            {busy ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Conectar Mercado Pago
          </button>
        </div>
      )}

      {error && <div className="p-3 rounded-lg text-xs bg-red-500/10 text-red-400">{error}</div>}
    </div>
  );
}

function StatusItem({ label, value, ok, mono }: { label: string; value: string; ok?: boolean; mono?: boolean }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">{label}</p>
        <p className={`text-sm text-white/80 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-green-400' : 'bg-white/20'}`} />
    </div>
  );
}
