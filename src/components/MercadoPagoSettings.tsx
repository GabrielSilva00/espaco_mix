import React, { useState } from 'react';
import { 
  Settings, Save, Check, Eye, EyeOff, Copy, AlertCircle, 
  TestTube, CheckCircle2, AlertTriangle, Info, Key, CreditCard,
  RefreshCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export function MercadoPagoSettings() {
  const [settings, setSettings] = useState({
    accessToken: localStorage.getItem('mp_access_token') || '',
    publicKey: localStorage.getItem('mp_public_key') || '',
    webhookUrl: localStorage.getItem('mp_webhook_url') || '',
    isProduction: localStorage.getItem('mp_is_production') === 'true',
    statementDescriptor: localStorage.getItem('mp_statement_descriptor') || '',
    binaryMode: localStorage.getItem('mp_binary_mode') === 'true',
    autoReturn: localStorage.getItem('mp_auto_return') === 'true',
  });

  const [showTokens, setShowTokens] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);
  };

  const handleSave = async () => {
    localStorage.setItem('mp_access_token', settings.accessToken);
    localStorage.setItem('mp_public_key', settings.publicKey);
    localStorage.setItem('mp_webhook_url', settings.webhookUrl);
    localStorage.setItem('mp_is_production', String(settings.isProduction));
    localStorage.setItem('mp_statement_descriptor', settings.statementDescriptor);
    localStorage.setItem('mp_binary_mode', String(settings.binaryMode));
    localStorage.setItem('mp_auto_return', String(settings.autoReturn));
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setTestStatus('error');
        setTestMessage('❌ Erro: Token de autenticação não encontrado. Faça login novamente.');
        return;
      }

      // Detectar a URL do servidor (pode estar em porta diferente)
      const serverUrl = window.location.origin.replace(':5173', ':3000');
      
      const response = await fetch(`${serverUrl}/api/admin/test-mercadopago`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          accessToken: settings.accessToken,
          publicKey: settings.publicKey,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setTestStatus('success');
        setTestMessage('✓ Credenciais válidas! Conexão com Mercado Pago estabelecida.');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Erro na conexão com Mercado Pago');
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage('❌ Erro ao conectar. Verifique se o servidor backend está rodando (npm run dev:server)');
      console.error('[MercadoPagoSettings] Erro:', err);
    }

    setTimeout(() => setTestStatus('idle'), 5000);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateWebhookUrl = () => {
    // Detectar a URL do servidor (substitui porta 5173 pela 3000)
    let serverUrl = window.location.origin;
    
    if (serverUrl.includes('localhost:5173')) {
      serverUrl = serverUrl.replace(':5173', ':3000');
      setSettings(prev => ({ ...prev, webhookUrl: `${serverUrl}/api/webhook/mercadopago` }));
      alert('✓ URL gerada para TESTE LOCAL.\n\n⚠️ Para teste com Mercado Pago, use ngrok:\n\n1. Terminal: ngrok http 3000\n2. Copie a URL gerada\n3. Use no Mercado Pago');
    } else {
      // Em produção, usar o domínio real
      setSettings(prev => ({ ...prev, webhookUrl: `${serverUrl}/api/webhook/mercadopago` }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
          <Key className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-serif text-[#d4af37]">Mercado Pago</h2>
          <p className="text-xs uppercase tracking-widest opacity-40">Configure suas credenciais para processar pagamentos</p>
        </div>
      </div>

      {/* Aviso de Ambiente */}
      <div className={`p-4 rounded-xl border-2 flex gap-4 ${settings.isProduction ? 'border-red-500/50 bg-red-500/5' : 'border-yellow-500/50 bg-yellow-500/5'}`}>
        <div className={settings.isProduction ? 'text-red-400' : 'text-yellow-400'}>
          {settings.isProduction ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
        </div>
        <div>
          <p className="font-bold text-sm text-white mb-1">
            {settings.isProduction ? '🔴 PRODUÇÃO - Cobranças Reais' : '🟡 TESTE - Sem Cobranças'}
          </p>
          <p className="text-xs text-white/60">
            {settings.isProduction 
              ? 'Você está em modo de produção. Qualquer pagamento será cobrado de verdade.' 
              : 'Use credenciais de teste para desenvolvimento. Nenhuma cobrança será realizada.'}
          </p>
        </div>
      </div>

      {/* Toggle Modo */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-bold uppercase tracking-widest mb-1">Ambiente</label>
            <p className="text-xs text-white/50">Escolha entre teste e produção</p>
          </div>
          <label className="relative shrink-0">
            <input
              type="checkbox"
              checked={settings.isProduction}
              onChange={(e) => handleChange('isProduction', e.target.checked)}
              className="peer sr-only"
            />
            <div className="w-14 h-8 bg-white/10 rounded-full peer-checked:bg-red-500 transition-colors relative">
              <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.isProduction ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
          </label>
        </div>
        <div className="mt-3 text-xs text-white/40">
          <p>• TESTE: Comece aqui com credenciais de teste</p>
          <p>• PRODUÇÃO: Ative apenas quando estiver pronto para cobrar</p>
        </div>
      </div>

      {/* Access Token */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <label className="block text-sm font-bold uppercase tracking-widest mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#d4af37]" />
            Access Token
          </div>
        </label>
        <div className="relative flex gap-2">
          <input
            type={showTokens ? 'text' : 'password'}
            value={settings.accessToken}
            onChange={(e) => handleChange('accessToken', e.target.value)}
            placeholder="TEST-xxxx ou APP_USR-xxxx"
            className="flex-1 bg-[#0f0f0f] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#d4af37] transition font-mono"
          />
          <button
            onClick={() => setShowTokens(!showTokens)}
            className="px-3 py-2 hover:bg-white/5 rounded-lg transition text-white/40 hover:text-white"
          >
            {showTokens ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          {settings.accessToken && (
            <button
              onClick={() => handleCopy(settings.accessToken)}
              className="px-3 py-2 hover:bg-white/5 rounded-lg transition text-white/40 hover:text-white"
              title="Copiar"
            >
              <Copy className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-white/40 mt-3">
          📍 Obtenha em: <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" rel="noopener noreferrer" className="text-[#d4af37] hover:underline">Painel de Desenvolvedor do Mercado Pago</a>
        </p>
      </div>

      {/* Public Key */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <label className="block text-sm font-bold uppercase tracking-widest mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#d4af37]" />
            Public Key
          </div>
        </label>
        <input
          type="text"
          value={settings.publicKey}
          onChange={(e) => handleChange('publicKey', e.target.value)}
          placeholder="TEST-xxxx"
          className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#d4af37] transition font-mono"
        />
        <p className="text-xs text-white/40 mt-3">
          📍 Copie da mesma página de credenciais
        </p>
      </div>

      {/* Webhook URL */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <label className="block text-sm font-bold uppercase tracking-widest mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#d4af37]" />
            URL do Webhook
          </div>
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={settings.webhookUrl}
            readOnly
            className="flex-1 bg-[#0f0f0f] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none font-mono text-white/60"
          />
          <button
            onClick={generateWebhookUrl}
            className="px-4 py-2 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] rounded-lg transition font-bold text-xs uppercase"
          >
            Gerar
          </button>
          {settings.webhookUrl && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(settings.webhookUrl);
                alert('✓ URL copiada!');
              }}
              className="px-3 py-2 hover:bg-white/5 rounded-lg transition text-white/40 hover:text-white"
              title="Copiar webhook"
            >
              <Copy className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-white/40 mt-3">
          📍 Registre esta URL em: Suas integrações → Webhooks → Adicionar Webhook
        </p>
        
        {settings.webhookUrl && settings.webhookUrl.includes('localhost') && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-400 font-bold mb-2">⚠️ TESTE LOCAL - Use ngrok:</p>
            <ol className="text-xs text-yellow-400/80 space-y-1 ml-2 list-decimal">
              <li>Terminal: <code className="bg-black/50 px-1">ngrok http 3000</code></li>
              <li>Copie a URL gerada (ex: https://abc123.ngrok.io)</li>
              <li>Use no Mercado Pago: <code className="bg-black/50 px-1">https://abc123.ngrok.io/api/webhook/mercadopago</code></li>
            </ol>
          </div>
        )}
      </div>

      {/* Statement Descriptor + Modos Avançados */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-5">
        <label className="block text-sm font-bold uppercase tracking-widest mb-2">Configurações Avançadas</label>

        <div>
          <label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Descrição na Fatura (Statement Descriptor)</label>
          <input
            type="text"
            value={settings.statementDescriptor}
            onChange={(e) => handleChange('statementDescriptor', e.target.value)}
            placeholder="Ex: ESPACO MIX"
            maxLength={22}
            className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#d4af37] transition"
          />
          <p className="text-[10px] text-white/30 mt-1">Texto exibido na fatura do cartão (máx. 22 chars)</p>
        </div>

        <label className="flex items-start gap-4 cursor-pointer group p-3 bg-white/5 rounded-xl hover:bg-white/10 transition">
          <div className="flex-1">
            <span className="text-xs uppercase tracking-widest font-bold block mb-1">Modo Binário</span>
            <span className="text-[10px] text-white/50">Aprova ou rejeita imediatamente, sem estados intermediários</span>
          </div>
          <div className="relative shrink-0 mt-1">
            <input type="checkbox" checked={settings.binaryMode} onChange={(e) => handleChange('binaryMode', e.target.checked)} className="peer sr-only" />
            <div className="w-10 h-6 bg-white/10 rounded-full peer-checked:bg-[#d4af37] transition-colors relative">
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${settings.binaryMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </div>
          </div>
        </label>

        <label className="flex items-start gap-4 cursor-pointer group p-3 bg-white/5 rounded-xl hover:bg-white/10 transition">
          <div className="flex-1">
            <span className="text-xs uppercase tracking-widest font-bold block mb-1">Retorno Automático</span>
            <span className="text-[10px] text-white/50">Redireciona automaticamente após pagamento via redirect</span>
          </div>
          <div className="relative shrink-0 mt-1">
            <input type="checkbox" checked={settings.autoReturn} onChange={(e) => handleChange('autoReturn', e.target.checked)} className="peer sr-only" />
            <div className="w-10 h-6 bg-white/10 rounded-full peer-checked:bg-[#d4af37] transition-colors relative">
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${settings.autoReturn ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </div>
          </div>
        </label>
      </div>

      {/* Test Connection */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TestTube className="w-4 h-4 text-[#d4af37]" />
            <label className="text-sm font-bold uppercase tracking-widest">Testar Conexão</label>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={!settings.accessToken || !settings.publicKey || testStatus === 'testing'}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition ${
              testStatus === 'testing' ? 'bg-white/10 text-white/50 cursor-not-allowed' :
              testStatus === 'success' ? 'bg-green-500/20 text-green-400' :
              testStatus === 'error' ? 'bg-red-500/20 text-red-400' :
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

      {/* Save Button */}
      <button
        onClick={handleSave}
        className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition ${
          isSaved 
            ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
            : 'bg-[#d4af37] text-black hover:brightness-110 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
        }`}
      >
        {isSaved ? <><Check className="inline w-4 h-4 mr-2" /> Salvo com Sucesso</> : <><Save className="inline w-4 h-4 mr-2" /> Salvar Configurações</>}
      </button>

      {/* Info Box */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">💡 Dica</p>
        <p className="text-xs text-blue-400/80 leading-relaxed">
          As configurações são salvas localmente no navegador para segurança. Em produção, considere usar variáveis de ambiente no servidor.
        </p>
      </div>
    </div>
  );
}
