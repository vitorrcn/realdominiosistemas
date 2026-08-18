"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEmpresa } from "@/hooks/useEmpresa";
import { BadgeEmpresa, BadgeObrigacao, BadgeEvento } from "@/components/ui/StatusBadge";
import { formatCnpj, formatCpf, formatData, formatCompetencia, cn } from "@/lib/utils";
import { REGIME_LABEL, STATUS_EMPRESA_LABEL } from "@/types";
import Link from "next/link";

const ABAS = [
  { key: "360",          label: "Visão 360°"  },
  { key: "fiscal",       label: "Fiscal",     setorNome: "Fiscal" },
  { key: "contabil",     label: "Contábil",   setorNome: "Contábil" },
  { key: "dp",           label: "DP",         setorNome: "Departamento Pessoal" },
  { key: "societario",   label: "Societário", setorNome: "Societário" },
  { key: "relacionamento",label: "Relacionamento" },
  { key: "comercial",    label: "Comercial", somenteComercial: true },
];

export default function EmpresaPage({ params }: { params: { id: string } }) {
  const { empresa, carregando, erro, atualizarModulo, atualizarGeral } = useEmpresa(params.id);
  const { data: session } = useSession();
  const perfil = (session?.user as any)?.perfilGlobal ?? "";
  const podeVerComercial = perfil === "DIRETORIA" || (session?.user as any)?.podeVerComercial;
  const meusSetores: string[] = ((session?.user as any)?.setores ?? []).map((s: any) => s.nome);
  const restritoAoProprioSetor = ["OPERADOR", "LIDER"].includes(perfil);

  const abasVisiveis = ABAS.filter((a) => {
    if (a.somenteComercial && !podeVerComercial) return false;
    // Operador e Líder só veem a(s) aba(s) do(s) setor(es) deles (mais Visão 360° e Relacionamento, que não são de um setor só)
    if (restritoAoProprioSetor && a.setorNome && !meusSetores.includes(a.setorNome)) return false;
    return true;
  });
  const [aba, setAba] = useState("360");
  const searchParams = useSearchParams();
  useEffect(() => {
    const abaUrl = searchParams.get("aba");
    if (abaUrl && ABAS.some((a) => a.key === abaUrl)) setAba(abaUrl);
  }, [searchParams]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function salvar(modulo: string, dados: Record<string, any>) {
    setSalvando(true);
    setMsg(null);
    const resultado = modulo === "geral"
      ? await atualizarGeral(dados)
      : await atualizarModulo(modulo, dados);
    setMsg(resultado.ok
      ? { tipo: "ok",   texto: "Salvo com sucesso!" }
      : { tipo: "erro", texto: (resultado as any).erro ?? "Erro ao salvar. Tente novamente." });
    setSalvando(false);
    setTimeout(() => setMsg(null), 6000);
  }

  if (carregando) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <svg className="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Carregando empresa...
    </div>
  );

  if (erro || !empresa) return (
    <div className="card text-center py-12 text-red-500">
      {erro ?? "Empresa não encontrada"}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Breadcrumb + ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/empresas" className="hover:text-gray-900">Clientes</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate max-w-xs">{empresa.razaoSocial}</span>
        </div>
        <div className="flex gap-2">
          <Link href={`/empresas/${params.id}/editar`} className="btn btn-sm">
            Editar cadastro
          </Link>
        </div>
      </div>

      {/* Cabeçalho da empresa */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{empresa.razaoSocial}</h1>
            {empresa.nomeFantasia && (
              <div className="text-sm text-gray-500 mt-0.5">{empresa.nomeFantasia}</div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              <span className="font-mono font-bold text-brand-700 text-sm">{empresa.codigoInterno}</span>
              <span>·</span>
              <span className="font-mono">
                {empresa.tipoPessoa === "PF" ? formatCpf(empresa.cpf ?? "") : formatCnpj(empresa.cnpj ?? "")}
              </span>
              {empresa.tipoPessoa === "PF" && <span className="badge badge-gray text-[10px]">PF</span>}
              {empresa.municipio && <><span>·</span><span>{empresa.municipio} — {empresa.estado}</span></>}
              {empresa.dataEntrada && <><span>·</span><span>Cliente desde {formatData(empresa.dataEntrada)}</span></>}
              {empresa.dataSaida && <><span>·</span><span className="text-orange-600 font-medium">Saiu em {formatData(empresa.dataSaida)}</span></>}
              {empresa.empresaBaixada && <><span>·</span><span className="badge badge-red text-[10px]">EMPRESA BAIXADA</span></>}
            </div>
          </div>
          <BadgeEmpresa status={empresa.status} />
        </div>

        {/* Obs. crítica */}
        {empresa.obsCritica && (
          <div className="obs-critica-bar">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>
              <div className="text-xs font-semibold mb-0.5">Observação crítica</div>
              <div className="text-xs">{empresa.obsCritica}</div>
            </div>
          </div>
        )}

        {/* Responsáveis */}
        <div className="flex flex-wrap gap-4 pt-1">
          {[
            { label: "Operador",    resp: empresa.respCarteira },
            { label: "Líder",       resp: empresa.respLider },
            { label: "Supervisor",  resp: empresa.respSupervisor },
            { label: "Fiscal",      resp: empresa.respFiscal },
            { label: "Contábil",    resp: empresa.respContabil },
            { label: "DP",          resp: empresa.respDp },
            { label: "Societário",  resp: empresa.respSocietario },
          ].map(({ label, resp }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{label}:</span>
              {resp ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center text-[9px] font-bold text-brand-700">
                    {resp.nome.charAt(0)}
                  </div>
                  <span className="text-xs font-medium text-gray-700">{resp.nome}</span>
                </div>
              ) : (
                <span className="text-xs text-red-400">Não atribuído</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Toast de feedback */}
      {msg && (
        <div className={cn(
          "fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 max-w-md",
          msg.tipo === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {msg.texto}
        </div>
      )}

      {/* Abas */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {abasVisiveis.map((a) => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                aba === a.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              )}
            >
              {a.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das abas */}
      <div>
        {aba === "360"          && <Aba360          empresa={empresa} />}
        {aba === "fiscal"       && <AbaFiscal       empresa={empresa} salvar={salvar} salvando={salvando} />}
        {aba === "contabil"     && <AbaContabil     empresa={empresa} salvar={salvar} salvando={salvando} />}
        {aba === "dp"           && <AbaDp           empresa={empresa} salvar={salvar} salvando={salvando} />}
        {aba === "societario"   && <AbaSocietario   empresa={empresa} salvar={salvar} salvando={salvando} />}
        {aba === "relacionamento"&&<AbaRelacionamento empresa={empresa} salvar={salvar} salvando={salvando} />}
        {aba === "comercial"     && podeVerComercial && <AbaComercial empresa={empresa} salvar={salvar} salvando={salvando} />}
      </div>
    </div>
  );
}

// ── Visão 360° ──────────────────────────────────────────────────
function Aba360({ empresa }: { empresa: any }) {
  const pendentes = empresa.obrigacoesCompetencia?.filter(
    (o: any) => !["CONCLUIDO", "NAO_SE_APLICA"].includes(o.status)
  ) ?? [];
  const atrasadas = empresa.obrigacoesCompetencia?.filter(
    (o: any) => o.status === "EM_ATRASO"
  ) ?? [];

  return (
    <div className="space-y-4">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="metric-card">
          <div className="metric-label">Obrigações {formatCompetencia(empresa.competencia ?? "")}</div>
          <div className={cn("metric-value", pendentes.length > 0 ? "text-yellow-600" : "text-green-700")}>
            {(empresa.obrigacoesCompetencia?.length ?? 0) - pendentes.length} / {empresa.obrigacoesCompetencia?.length ?? 0}
          </div>
          <div className="metric-sub">concluídas</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Em atraso</div>
          <div className={cn("metric-value", atrasadas.length > 0 ? "text-red-600" : "text-green-700")}>
            {atrasadas.length}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Eventos abertos</div>
          <div className={cn("metric-value", empresa.eventos?.length > 0 ? "text-brand-700" : "text-gray-600")}>
            {empresa.eventos?.length ?? 0}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tarefas abertas</div>
          <div className={cn("metric-value", empresa.tarefas?.length > 0 ? "text-brand-700" : "text-gray-600")}>
            {empresa.tarefas?.length ?? 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dados setoriais resumidos */}
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumo setorial</h3>
          {empresa.fiscal && (
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
              <span className="text-xs text-gray-500">Regime tributário</span>
              <span className="text-xs font-medium text-gray-800">
                {empresa.fiscal.regimeTributario ? REGIME_LABEL[empresa.fiscal.regimeTributario as keyof typeof REGIME_LABEL] : "—"}
              </span>
            </div>
          )}
          {empresa.fiscal?.parcelamentoAtivo && (
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
              <span className="text-xs text-gray-500">Parcelamento</span>
              <span className="badge badge-yellow text-[10px]">Ativo</span>
            </div>
          )}
          {empresa.dp && (
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
              <span className="text-xs text-gray-500">Funcionários</span>
              <span className="text-xs font-medium text-gray-800">{empresa.dp.qtdFuncionarios ?? 0}</span>
            </div>
          )}
          {empresa.societario?.vencimentoCertificado && (
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
              <span className="text-xs text-gray-500">Certificado digital</span>
              <span className="text-xs font-medium text-gray-800">
                Vence {formatData(empresa.societario.vencimentoCertificado)}
              </span>
            </div>
          )}
          {empresa.relacionamento?.ultimoContato && (
            <div className="flex justify-between items-center py-1.5">
              <span className="text-xs text-gray-500">Último contato</span>
              <span className="text-xs font-medium text-gray-800">
                {formatData(empresa.relacionamento.ultimoContato)}
              </span>
            </div>
          )}
        </div>

        {/* Obrigações do mês */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Obrigações — {formatCompetencia(empresa.competencia ?? "")}
          </h3>
          {empresa.obrigacoesCompetencia?.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma obrigação cadastrada.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {empresa.obrigacoesCompetencia?.map((o: any) => (
                <div key={o.id} className="flex items-center gap-2">
                  <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                    o.status === "CONCLUIDO"         ? "bg-green-500" :
                    o.status === "EM_ATRASO"         ? "bg-red-500"   :
                    o.status === "AGUARDANDO_CLIENTE"? "bg-yellow-400": "bg-blue-400"
                  )} />
                  <span className="text-xs text-gray-700 flex-1 truncate">
                    {o.obrigacaoEmpresa.template.nome}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {o.obrigacaoEmpresa.template.setor.nome}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sócios: módulo removido a pedido do cliente */}

      {/* Eventos abertos */}
      {empresa.eventos?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Eventos abertos</h3>
          <div className="space-y-2">
            {empresa.eventos.map((ev: any) => (
              <div key={ev.id} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                <BadgeEvento status={ev.status} />
                <span className="text-sm text-gray-800 flex-1">{ev.tipoEvento?.nome ?? "Evento"}</span>
                <span className="text-xs text-gray-400">{ev.setorAtual?.nome}</span>
                {ev.prazo && (
                  <span className="text-xs text-gray-400">Prazo: {formatData(ev.prazo)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de observações */}
      {empresa.obsHistorico?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Últimas movimentações</h3>
          <div className="space-y-2">
            {empresa.obsHistorico.slice(0, 8).map((h: any) => (
              <div key={h.id} className="flex gap-3 py-1.5 border-b border-gray-100 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">{h.texto}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatData(h.dataHora)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba Fiscal ──────────────────────────────────────────────────
function AbaFiscal({ empresa, salvar, salvando }: any) {
  const f = empresa.fiscal ?? {};
  const [form, setForm] = useState({ ...f });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar("fiscal", form); }} className="space-y-5">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Regime tributário</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Regime</label>
            <select className="select" value={form.regimeTributario ?? ""} onChange={(e) => set("regimeTributario", e.target.value || null)}>
              <option value="">Selecione...</option>
              {Object.entries(REGIME_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Início do regime</label>
            <input className="input" type="date" value={form.inicioRegime?.slice(0,10) ?? ""} onChange={(e) => set("inicioRegime", e.target.value)} />
          </div>
          <div>
            <label className="label">Próxima revisão tributária</label>
            <input className="input" type="date" value={form.proximaRevisao?.slice(0,10) ?? ""} onChange={(e) => set("proximaRevisao", e.target.value)} />
          </div>
          <div>
            <label className="label">Inscrição Estadual</label>
            <input className="input" value={form.inscricaoEstadual ?? ""} onChange={(e) => set("inscricaoEstadual", e.target.value)} />
          </div>
          <div>
            <label className="label">Inscrição Municipal</label>
            <input className="input" value={form.inscricaoMunicipal ?? ""} onChange={(e) => set("inscricaoMunicipal", e.target.value)} />
          </div>
          <div>
            <label className="label">Preferência de envio de guia</label>
            <select className="select" value={form.prefEnvioGuia ?? ""} onChange={(e) => set("prefEnvioGuia", e.target.value)}>
              <option value="">Selecione...</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
              <option value="AMBOS">Ambos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Regularidade fiscal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.parcelamentoAtivo ?? false}
              onChange={(e) => set("parcelamentoAtivo", e.target.checked)} />
            <span className="text-sm text-gray-700">Possui parcelamento ativo</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.possuiDebitos ?? false}
              onChange={(e) => set("possuiDebitos", e.target.checked)} />
            <span className="text-sm text-gray-700">Possui débitos fiscais conhecidos</span>
          </label>
          {form.parcelamentoAtivo && (
            <>
              <div>
                <label className="label">Quantidade de parcelamentos</label>
                <input className="input" type="number" min={0} value={form.qtdParcelamentos ?? 0} onChange={(e) => set("qtdParcelamentos", Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Órgão do parcelamento</label>
                <input className="input" value={form.orgaoParcelamento ?? ""} onChange={(e) => set("orgaoParcelamento", e.target.value)} />
              </div>
              <div>
                <label className="label">Situação do parcelamento</label>
                <input className="input" value={form.situacaoParcelamento ?? ""} onChange={(e) => set("situacaoParcelamento", e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Observações</h3>
        <textarea className="input min-h-[80px]" value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
      </div>

      <AcessosSetor empresaId={empresa.id} setorNome="Fiscal" />
      <ObrigacoesSetorResumo empresaId={empresa.id} setorNome="Fiscal" />

      <BotaoSalvar salvando={salvando} />
    </form>
  );
}

// ── Aba Contábil ────────────────────────────────────────────────
function AbaContabil({ empresa, salvar, salvando }: any) {
  const c = empresa.contabil ?? {};
  const [form, setForm] = useState({ ...c });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const [ramos, setRamos] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    fetch("/api/ramos").then((r) => r.ok ? r.json() : []).then(setRamos).catch(() => {});
  }, []);

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar("contabil", form); }} className="space-y-5">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Fechamento contábil</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Último fechamento</label>
            <input className="input" type="date" value={form.ultimoFechamento?.slice(0,10) ?? ""} onChange={(e) => set("ultimoFechamento", e.target.value)} />
          </div>
          <div>
            <label className="label">Último resultado</label>
            <select className="select" value={form.ultimoResultado ?? ""} onChange={(e) => set("ultimoResultado", e.target.value)}>
              <option value="">Selecione...</option>
              <option value="LUCRO">Lucro</option>
              <option value="PREJUIZO">Prejuízo</option>
              <option value="EQUILIBRIO">Equilíbrio</option>
            </select>
          </div>
          <div>
            <label className="label">Confiabilidade da receita</label>
            <select className="select" value={form.confiabilidade ?? ""} onChange={(e) => set("confiabilidade", e.target.value)}>
              <option value="">Selecione...</option>
              <option value="TOTAL">Declara toda a receita</option>
              <option value="PARCIAL">Declara parcialmente</option>
              <option value="NAO_SABEMOS">Não sabemos</option>
              <option value="NAO">Não</option>
            </select>
          </div>
          <div>
            <label className="label">Ramo da empresa</label>
            <select className="select" value={form.ramoId ?? ""} onChange={(e) => set("ramoId", e.target.value)}>
              <option value="">Selecione...</option>
              {ramos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Imóvel da empresa</label>
            <select className="select" value={form.situacaoImovel ?? ""} onChange={(e) => set("situacaoImovel", e.target.value)}>
              <option value="">Selecione...</option>
              <option value="PROPRIO">Próprio</option>
              <option value="ALUGADO">Alugado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Estrutura bancária</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Quantidade de contas bancárias</label>
            <input className="input" type="number" min={0} value={form.qtdContasBancarias ?? 0} onChange={(e) => set("qtdContasBancarias", Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Conta principal</label>
            <input className="input" value={form.contaPrincipal ?? ""} onChange={(e) => set("contaPrincipal", e.target.value)} />
          </div>
          <div>
            <label className="label">Pessoa para solicitar extratos</label>
            <input className="input" value={form.pessoaExtratos ?? ""} onChange={(e) => set("pessoaExtratos", e.target.value)} />
          </div>
          <div>
            <label className="label">Forma de solicitação</label>
            <input className="input" value={form.formaExtratos ?? ""} onChange={(e) => set("formaExtratos", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Observações Gerais</label>
            <textarea className="input min-h-[80px]" value={form.obsExtratos ?? ""} onChange={(e) => set("obsExtratos", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-6 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.possuiEmprestimo ?? false} onChange={(e) => set("possuiEmprestimo", e.target.checked)} />
            <span className="text-sm text-gray-700">Possui empréstimo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.possuiFinanciamento ?? false} onChange={(e) => set("possuiFinanciamento", e.target.checked)} />
            <span className="text-sm text-gray-700">Possui financiamento</span>
          </label>
        </div>
      </div>

      <AcessosSetor empresaId={empresa.id} setorNome="Contábil" />
      <ObrigacoesSetorResumo empresaId={empresa.id} setorNome="Contábil" />

      <BotaoSalvar salvando={salvando} />
    </form>
  );
}

// ── Aba DP ──────────────────────────────────────────────────────
function AbaDp({ empresa, salvar, salvando }: any) {
  const d = empresa.dp ?? {};
  const [form, setForm] = useState({ ...d });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar("dp", form); }} className="space-y-5">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Departamento Pessoal</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 cursor-pointer md:col-span-3">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.possuiFuncionarios ?? false} onChange={(e) => set("possuiFuncionarios", e.target.checked)} />
            <span className="text-sm text-gray-700">Possui funcionários</span>
          </label>
          {form.possuiFuncionarios && (
            <div>
              <label className="label">Quantidade de funcionários</label>
              <input className="input" type="number" min={0} value={form.qtdFuncionarios ?? 0} onChange={(e) => set("qtdFuncionarios", Number(e.target.value))} />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.possuiProlabore ?? false} onChange={(e) => set("possuiProlabore", e.target.checked)} />
            <span className="text-sm text-gray-700">Possui pró-labore</span>
          </label>
          {form.possuiProlabore && (
            <div>
              <label className="label">Quantidade de sócios na folha</label>
              <input className="input" type="number" min={0} value={form.qtdSociosfolha ?? 0} onChange={(e) => set("qtdSociosfolha", Number(e.target.value))} />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.possuiInssPatronal ?? false} onChange={(e) => set("possuiInssPatronal", e.target.checked)} />
            <span className="text-sm text-gray-700">INSS Patronal</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.possuiPisFolha ?? false} onChange={(e) => set("possuiPisFolha", e.target.checked)} />
            <span className="text-sm text-gray-700">PIS sobre folha</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.terceiros ?? false} onChange={(e) => set("terceiros", e.target.checked)} />
            <span className="text-sm text-gray-700">Terceiros</span>
          </label>
          <div>
            <label className="label">RAT (%)</label>
            <input className="input" type="number" step="0.01" min={0} value={form.rat ?? ""} onChange={(e) => set("rat", e.target.value)} />
          </div>
          <div>
            <label className="label">FAP</label>
            <input className="input" type="number" step="0.0001" min={0} value={form.fap ?? ""} onChange={(e) => set("fap", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Observações</h3>
        <textarea className="input min-h-[80px]" value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
      </div>

      <AcessosSetor empresaId={empresa.id} setorNome="Departamento Pessoal" />
      <ObrigacoesSetorResumo empresaId={empresa.id} setorNome="Departamento Pessoal" />

      <BotaoSalvar salvando={salvando} />
    </form>
  );
}

// ── Aba Societário ──────────────────────────────────────────────
function AbaSocietario({ empresa, salvar, salvando }: any) {
  const s = empresa.societario ?? {};
  const [form, setForm] = useState({ ...s });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar("societario", form); }} className="space-y-5">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Contrato e certidões</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.contratoAtualizado ?? false} onChange={(e) => set("contratoAtualizado", e.target.checked)} />
            <span className="text-sm text-gray-700">Contrato social atualizado</span>
          </label>
          <div>
            <label className="label">Última alteração contratual</label>
            <input className="input" type="date" value={form.ultimaAlteracaoContr?.slice(0,10) ?? ""} onChange={(e) => set("ultimaAlteracaoContr", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Certificado digital</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.certificadoDigital ?? false} onChange={(e) => set("certificadoDigital", e.target.checked)} />
            <span className="text-sm text-gray-700">Possui certificado digital</span>
          </label>
          {form.certificadoDigital && (
            <>
              <div>
                <label className="label">Tipo</label>
                <select className="select" value={form.tipoCertificado ?? ""} onChange={(e) => set("tipoCertificado", e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="A1">e-CNPJ A1</option>
                  <option value="A3">e-CNPJ A3</option>
                </select>
              </div>
              <div>
                <label className="label">Vencimento</label>
                <input className="input" type="date" value={form.vencimentoCertificado?.slice(0,10) ?? ""} onChange={(e) => set("vencimentoCertificado", e.target.value)} />
              </div>
              <div>
                <label className="label">Situação</label>
                <select className="select" value={form.situacaoCertificado ?? ""} onChange={(e) => set("situacaoCertificado", e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="ATIVO">Ativo</option>
                  <option value="A_VENCER">A vencer</option>
                  <option value="VENCIDO">Vencido</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Procurações e acessos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: "procuracaoRF",       label: "Procuração Receita Federal" },
            { key: "procuracaoEstado",   label: "Procuração Estado" },
            { key: "procuracaoMunicipio",label: "Procuração Município" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
                checked={form[key] ?? false} onChange={(e) => set(key, e.target.checked)} />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
          <div>
            <label className="label">Licenças</label>
            <input className="input" value={form.licencas ?? ""} onChange={(e) => set("licencas", e.target.value)} />
          </div>
          <div>
            <label className="label">Alvarás</label>
            <input className="input" value={form.alvaras ?? ""} onChange={(e) => set("alvaras", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Observações</h3>
        <textarea className="input min-h-[80px]" value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
      </div>

      <AcessosSetor empresaId={empresa.id} setorNome="Societário" />
      <ObrigacoesSetorResumo empresaId={empresa.id} setorNome="Societário" />

      <BotaoSalvar salvando={salvando} />
    </form>
  );
}

// ── Aba Relacionamento ──────────────────────────────────────────
function AbaRelacionamento({ empresa, salvar, salvando }: any) {
  const r = empresa.relacionamento ?? {};
  const [form, setForm] = useState({ ...r });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const PERFIS = ["ORGANIZADO","DESORGANIZADO","TECNICO","CONSERVADOR","QUESTIONADOR","DEMORADO","OBJETIVO"];

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar("relacionamento", form); }} className="space-y-5">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Histórico de contato</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Último contato</label>
            <input className="input" type="date" value={form.ultimoContato?.slice(0,10) ?? ""} onChange={(e) => set("ultimoContato", e.target.value)} />
          </div>
          <div>
            <label className="label">Última reunião</label>
            <input className="input" type="date" value={form.ultimaReuniao?.slice(0,10) ?? ""} onChange={(e) => set("ultimaReuniao", e.target.value)} />
          </div>
          <div>
            <label className="label">Última visita</label>
            <input className="input" type="date" value={form.ultimaVisita?.slice(0,10) ?? ""} onChange={(e) => set("ultimaVisita", e.target.value)} />
          </div>
          <div>
            <label className="label">Forma preferencial de contato</label>
            <select className="select" value={form.formaPrefContato ?? ""} onChange={(e) => set("formaPrefContato", e.target.value)}>
              <option value="">Selecione...</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
              <option value="TELEFONE">Telefone</option>
              <option value="PRESENCIAL">Presencial</option>
            </select>
          </div>
          <div>
            <label className="label">Tempo de resposta</label>
            <select className="select" value={form.tempoResposta ?? ""} onChange={(e) => set("tempoResposta", e.target.value)}>
              <option value="">Selecione...</option>
              <option value="RAPIDO">Rápido</option>
              <option value="MEDIO">Médio</option>
              <option value="LENTO">Lento</option>
            </select>
          </div>
          <div>
            <label className="label">Perfil do cliente</label>
            <select className="select" value={form.perfilCliente ?? ""} onChange={(e) => set("perfilCliente", e.target.value)}>
              <option value="">Selecione...</option>
              {PERFIS.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Observações</h3>
        <div>
          <label className="label">Descrição do relacionamento</label>
          <textarea className="input min-h-[100px]" placeholder="Anote aqui qualquer observação livre sobre o relacionamento com esse cliente..."
            value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
        </div>
      </div>
      <BotaoSalvar salvando={salvando} />
    </form>
  );
}

// ── Aba Comercial (restrita) ─────────────────────────────────────
function AbaComercial({ empresa, salvar, salvando }: any) {
  const c = empresa.comercial ?? {};
  const [form, setForm] = useState({ ...c });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar("comercial", form); }} className="space-y-5">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
        <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
        <span className="text-xs text-amber-800">Dados sensíveis — acesso restrito e auditado.</span>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Origem do cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Origem</label>
            <select className="select" value={form.origem ?? ""} onChange={(e) => set("origem", e.target.value)}>
              <option value="">Selecione...</option>
              <option value="GOOGLE">Google</option>
              <option value="INDICACAO">Indicação</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div>
            <label className="label">Quem indicou</label>
            <input className="input" value={form.quemIndicou ?? ""} onChange={(e) => set("quemIndicou", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Motivo da contratação</label>
            <textarea className="input min-h-[70px]" value={form.motivoContratacao ?? ""} onChange={(e) => set("motivoContratacao", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Honorários e contrato</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Honorários (R$/mês)</label>
            <input className="input" type="number" step="0.01" min={0}
              value={form.honorarios ?? ""} onChange={(e) => set("honorarios", e.target.value)} />
          </div>
          <div>
            <label className="label">Contrato</label>
            <input className="input" value={form.contrato ?? ""} onChange={(e) => set("contrato", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Saída (se ex-cliente)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Motivo de saída</label>
            <input className="input" value={form.motivoSaida ?? ""} onChange={(e) => set("motivoSaida", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Descrição da saída</label>
            <textarea className="input min-h-[70px]" value={form.descricaoSaida ?? ""} onChange={(e) => set("descricaoSaida", e.target.value)} />
          </div>
        </div>
      </div>

      <BotaoSalvar salvando={salvando} />
    </form>
  );
}

// ── Botão salvar reutilizável ───────────────────────────────────
// ── Acessos do setor (login/senha ou anotações de acesso) ───────
function AcessosSetor({ empresaId, setorNome }: { empresaId: string; setorNome: string }) {
  const { data: session } = useSession();
  const perfil = (session?.user as any)?.perfilGlobal ?? "";
  const podeEditar = perfil && perfil !== "CONSULTA";

  const [setorId, setSetorId] = useState<string | null>(null);
  const [acessos, setAcessos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState({ nomeSistema: "", link: "", usuario: "", senha: "", observacao: "" });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [senhasReveladas, setSenhasReveladas] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/setores").then((r) => r.json()).then((lista: any[]) => {
      const s = lista.find((x) => x.nome === setorNome);
      setSetorId(s?.id ?? null);
    });
  }, [setorNome]);

  const buscar = useCallback(async () => {
    if (!setorId) return;
    setCarregando(true);
    const res = await fetch(`/api/empresas/${empresaId}/acessos?setorId=${setorId}`);
    if (res.ok) setAcessos(await res.json());
    setCarregando(false);
  }, [empresaId, setorId]);

  useEffect(() => { buscar(); }, [buscar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!setorId || !novo.nomeSistema) return;
    setSalvando(true);
    const res = await fetch(`/api/empresas/${empresaId}/acessos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...novo, setorId }),
    });
    setSalvando(false);
    if (res.ok) {
      setNovo({ nomeSistema: "", link: "", usuario: "", senha: "", observacao: "" });
      setMostrarForm(false);
      buscar();
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este acesso?")) return;
    await fetch(`/api/empresas/${empresaId}/acessos/${id}`, { method: "DELETE" });
    buscar();
  }

  async function revelarSenha(id: string) {
    if (senhasReveladas[id]) {
      setSenhasReveladas((p) => { const n = { ...p }; delete n[id]; return n; });
      return;
    }
    const res = await fetch(`/api/empresas/${empresaId}/acessos/${id}/senha`);
    if (res.ok) {
      const { senha } = await res.json();
      setSenhasReveladas((p) => ({ ...p, [id]: senha ?? "(sem senha salva)" }));
    }
  }

  if (!setorId && !carregando) return null; // setor não existe no banco — não renderiza nada

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Acessos do setor</h3>
        {podeEditar && (
          <button type="button" onClick={() => setMostrarForm((v) => !v)} className="text-xs text-brand-600 hover:underline">
            {mostrarForm ? "Cancelar" : "+ Adicionar acesso"}
          </button>
        )}
      </div>

      {carregando ? (
        <p className="text-xs text-gray-400">Carregando...</p>
      ) : acessos.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum acesso cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {acessos.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{a.nomeSistema}</div>
                {a.link && (
                  <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline break-all">
                    {a.link}
                  </a>
                )}
                {a.usuario && <div className="text-xs text-gray-500">Usuário: {a.usuario}</div>}
                {a.temSenha && (
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    Senha: {senhasReveladas[a.id] ? (
                      <span className="font-mono">{senhasReveladas[a.id]}</span>
                    ) : "••••••••"}
                    {podeEditar && (
                      <button type="button" onClick={() => revelarSenha(a.id)} className="text-brand-600 hover:underline">
                        {senhasReveladas[a.id] ? "ocultar" : "mostrar"}
                      </button>
                    )}
                  </div>
                )}
                {a.observacao && <div className="text-xs text-gray-400 mt-0.5">{a.observacao}</div>}
              </div>
              {podeEditar && (
                <button type="button" onClick={() => excluir(a.id)} className="text-xs text-red-500 hover:underline flex-shrink-0">
                  Excluir
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {mostrarForm && podeEditar && (
        <form onSubmit={criar} className="pt-2 border-t border-gray-100 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="input text-sm" placeholder="Nome do sistema (ex: e-CAC, eSocial)"
              value={novo.nomeSistema} onChange={(e) => setNovo((p) => ({ ...p, nomeSistema: e.target.value }))} required />
            <input className="input text-sm" type="url" placeholder="Link do site (ex: https://...)"
              value={novo.link} onChange={(e) => setNovo((p) => ({ ...p, link: e.target.value }))} />
            <input className="input text-sm" placeholder="Usuário / login"
              value={novo.usuario} onChange={(e) => setNovo((p) => ({ ...p, usuario: e.target.value }))} />
            <input className="input text-sm" type="text" placeholder="Senha (deixe em branco se não tiver)"
              value={novo.senha} onChange={(e) => setNovo((p) => ({ ...p, senha: e.target.value }))} />
            <input className="input text-sm" placeholder="Observação (ex: usa certificado digital)"
              value={novo.observacao} onChange={(e) => setNovo((p) => ({ ...p, observacao: e.target.value }))} />
          </div>
          <button type="submit" disabled={salvando} className="btn btn-primary btn-sm">
            {salvando ? "Salvando..." : "Salvar acesso"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Resumo de obrigações do setor para esta empresa ──────────────
function ObrigacoesSetorResumo({ empresaId, setorNome }: { empresaId: string; setorNome: string }) {
  const { data: session } = useSession();
  const podeEditar = ((session?.user as any)?.perfilGlobal ?? "") !== "CONSULTA";

  const [setorId, setSetorId] = useState<string | null>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; nome: string; vinculada: boolean }[]>([]);
  const [carregandoConfig, setCarregandoConfig] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const setoresRes = await fetch("/api/setores").then((r) => r.json());
      const setor = setoresRes.find((s: any) => s.nome === setorNome);
      if (!setor) { setCarregando(false); return; }
      setSetorId(setor.id);
      const res = await fetch(`/api/obrigacoes?empresaId=${empresaId}&setorId=${setor.id}`);
      if (res.ok) {
        const json = await res.json();
        setItens(json.data ?? json);
      }
      setCarregando(false);
    })();
  }, [empresaId, setorNome]);

  async function abrirConfig() {
    const abrir = !mostrarConfig;
    setMostrarConfig(abrir);
    if (abrir && setorId) {
      setCarregandoConfig(true);
      const res = await fetch(`/api/empresas/${empresaId}/obrigacoes-config?setorId=${setorId}`);
      if (res.ok) setTemplates(await res.json());
      setCarregandoConfig(false);
    }
  }

  async function alternarVinculo(templateId: string, vinculadaAtual: boolean) {
    setSalvandoId(templateId);
    const res = await fetch(`/api/empresas/${empresaId}/obrigacoes-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, ativa: !vinculadaAtual }),
    });
    if (res.ok) {
      setTemplates((prev) => prev.map((t) => t.id === templateId ? { ...t, vinculada: !vinculadaAtual } : t));
    }
    setSalvandoId(null);
  }

  async function marcarConcluido(id: string, concluidoAtual: boolean) {
    setSalvandoId(id);
    const novoStatus = concluidoAtual ? "NAO_INICIADO" : "CONCLUIDO";
    const res = await fetch("/api/obrigacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: novoStatus }),
    });
    if (res.ok) {
      setItens((prev) => prev.map((it) => it.id === id ? { ...it, status: novoStatus } : it));
    }
    setSalvandoId(null);
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Obrigações deste setor (mês atual)</h3>
        {podeEditar && (
          <button type="button" onClick={abrirConfig} className="text-xs text-brand-600 hover:underline">
            {mostrarConfig ? "Fechar" : "Configurar obrigações"}
          </button>
        )}
      </div>

      {mostrarConfig && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-1.5 bg-gray-50">
          <p className="text-[11px] text-gray-400 mb-1">
            Marque as obrigações que se aplicam a este cliente (funciona mesmo com cadastro incompleto).
          </p>
          {carregandoConfig ? (
            <p className="text-xs text-gray-400">Carregando...</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum template cadastrado para este setor.</p>
          ) : templates.map((t) => (
            <label key={t.id} className="flex items-center gap-2 cursor-pointer py-0.5">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-brand-600"
                checked={t.vinculada}
                disabled={salvandoId === t.id}
                onChange={() => alternarVinculo(t.id, t.vinculada)}
              />
              <span className="text-sm text-gray-700">{t.nome}</span>
            </label>
          ))}
        </div>
      )}

      {carregando ? (
        <p className="text-xs text-gray-400">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="text-xs text-gray-400">
          Nenhuma obrigação configurada para este setor ainda. Clique em &quot;Configurar obrigações&quot; acima
          e depois use o botão &quot;Gerar competência do mês&quot; na tela de Obrigações.
        </p>
      ) : (
        <div className="space-y-1.5">
          {itens.map((it: any) => {
            const concluido = it.status === "CONCLUIDO";
            return (
              <div key={it.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand-600 flex-shrink-0"
                    checked={concluido}
                    disabled={!podeEditar || salvandoId === it.id}
                    onChange={() => marcarConcluido(it.id, concluido)}
                  />
                  <span className={cn("text-gray-700 truncate", concluido && "line-through text-gray-400")}>
                    {it.obrigacaoEmpresa?.template?.nome ?? it.nome}
                  </span>
                </label>
                <BadgeObrigacao status={it.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BotaoSalvar({ salvando }: { salvando: boolean }) {
  return (
    <div className="flex justify-end">
      <button type="submit" disabled={salvando} className="btn btn-primary">
        {salvando ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Salvando...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
            Salvar alterações
          </>
        )}
      </button>
    </div>
  );
}
