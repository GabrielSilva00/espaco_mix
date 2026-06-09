import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, TestTube, CheckCircle2, AlertTriangle, Info, Key,
  RefreshCcw, ShieldCheck, Copy, ExternalLink, Eye, EyeOff, Save, Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentStatus {
  provider: string;
  configured: boolean;
  environment: 'production' | 'test' | 'unset';
  publicKeyMasked: string;
  webhookConfigured: boolean;
}

export function MercadoPagoSettings() {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Edição de credenciais (salvas criptografadas no servidor)
  const [editToken, setEditToken] = useState('');
  const [editPublicKey, setEditPublicKey] = useState('');
  const [editEnv, setEditEnv] = useState<'production' | 'test'>('production');
  const [showToken, setShowToken] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [savedCreds, setSavedCreds] = useState(false);

  const serverUrl = window.location.origin.replace(':5173', ':3000');
  const webhookUrl = `${window.location.origin.replace(':5173', ':3000')}/api/webhook/mercadopago`;

  const authHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeader();
      if (!headers) { setLoading(false); return; }
      const res = await fetch(`${serverUrl}/api/admin/payment-status`, { headers });
      if (res.ok) setStatus(await res.json());
    } catch (e) {
      console.warn('[MP Settings] Falha ao carregar status:', e);
    } finally {
      setLoading(false);
    }
  }, [authHeader, serverUrl]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status?.environment === 'production' || status?.environment === 'test') setEditEnv(status.environment); }, [status?.environment]);

  const handleSaveCreds = async () => {
    setSavingCreds(true);
    try {
      const headers = await authHeader();
      if (!headers) { setSavingCreds(false); return; }
      const res = await fetch(`${serverUrl}/api/admin/payment-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ accessToken: editToken || undefined, publicKey: editPublicKey || undefined, environment: editEnv }),
      });
      if (res.ok) {
        setEditToken(''); setSavedCreds(true);
        setTimeout(() => setSavedCreds(false), 2500);
        await loadStatus();
      }
    } finally {
      setSavingCreds(false);
    }
  };

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

      {/* Explicação: credenciais ficam na Vercel */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-400/90 leading-relaxed">
          As credenciais do Mercado Pago (Access Token e Public Key) ficam guardadas com
          segurança nas <strong>variáveis de ambiente</strong> do servidor (Vercel) — não são
          editadas por esta tela. Aqui você apenas confere o status e testa a conexão. Para
          alterar as credenciais, consulte o documento <code className="bg-black/40 px-1 rounded">ENTREGA.md</code>.
        </p>
      </div>

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

          {/* Editar credenciais (salvas criptografadas no servidor) */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <label className="block text-sm font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2"><Key className="w-4 h-4 text-[#d4af37]" /> Credenciais (produção)</span>
            </label>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300 leading-relaxed">Use somente credenciais de <strong>produção</strong> (<code>APP_USR-…</code>). O Access Token é guardado criptografado e nunca volta para a tela.</p>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Access Token {isConfigured && <span className="text-green-400 normal-case tracking-normal">— já salvo (preencha só para trocar)</span>}</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'} value={editToken}
                  onChange={e => setEditToken(e.target.value)} placeholder="APP_USR-…"
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm font-mono text-white focus:outline-none focus:border-[#d4af37]/50"
                />
                <button onClick={() => setShowToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">{showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Public Key</label>
                <input value={editPublicKey} onChange={e => setEditPublicKey(e.target.value)} placeholder="APP_USR-…"
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-4 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#d4af37]/50" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Ambiente</label>
                <select value={editEnv} onChange={e => setEditEnv(e.target.value as any)}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]/50">
                  <option value="production">Produção</option>
                  <option value="test">Teste</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleSaveCreds}
              disabled={savingCreds || (!editToken && !editPublicKey)}
              className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 ${savedCreds ? 'bg-green-500/20 text-green-400' : 'bg-[#d4af37] text-black hover:brightness-110 disabled:opacity-50'}`}
            >
              {savingCreds ? <RefreshCcw className="w-4 h-4 animate-spin" /> : savedCreds ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savedCreds ? 'Salvo' : 'Salvar credenciais'}
            </button>
          </div>

          {/* Webhook URL (apenas leitura, para registrar no MP) */}
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

          {/* Testar conexão (usa credenciais do servidor) */}
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
