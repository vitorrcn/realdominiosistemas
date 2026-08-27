"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtMoeda } from "@/lib/tributario/formatadores";
import { gerarArquivoAlterdata } from "@/lib/real-extratos/exportarAlterdata";
import type { ConfigRealExtratos, Lancamento } from "@/lib/real-extratos/tipos";

type Passo = "config" | "importar" | "revisar";

const CONFIG_VAZIA: ConfigRealExtratos = {
  conta_banco: "",
  conta_receita: "",
  conta_socio: "",
  conta_despesas: "",
  conta_padrao: "",
  nome_socio: "",
  rules: [],
};

interface LancamentoUI extends Lancamento {
  id: number;
  selecionado: boolean;
}

const ORIGEM_LABEL: Record<Lancamento["origem"], { texto: string; badge: string }> = {
  rule: { texto: "Regra", badge: "badge-blue" },
  fornecedor: { texto: "Fornecedor", badge: "badge-green" },
  builtin: { texto: "Automático", badge: "badge-gray" },
  padrao: { texto: "Não classificado", badge: "badge-orange" },
};

export default function RealExtratosPage() {
  const [passo, setPasso] = useState<Passo>("config");
  const [config, setConfig] = useState<ConfigRealExtratos>(CONFIG_VAZIA);
  const [banco, setBanco] = useState<{ banco: string | null; descricao: string; fornecedoresEncontrados: number } | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoUI[]>([]);

  function handleProcessado(dados: { banco: string | null; descricao: string; fornecedoresEncontrados: number; lancamentos: Lancamento[] }) {
    setBanco({ banco: dados.banco, descricao: dados.descricao, fornecedoresEncontrados: dados.fornecedoresEncontrados });
    setLancamentos(dados.lancamentos.map((l, i) => ({ ...l, id: i, selecionado: false })));
    setPasso("revisar");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/aplicacoes" className="hover:text-gray-900">Aplicações</Link>
        <span>/</span>
        <span className="text-gray-900">Real Extratos</span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">🏦 Real Extratos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Converte extrato bancário em PDF para o formato de importação contábil Alterdata — detecta o banco
          automaticamente e já sugere débito/crédito de cada lançamento.
        </p>
      </div>

      <PassosIndicador passo={passo} />

      {passo === "config" && (
        <PassoConfig
          config={config}
          onMudar={setConfig}
          onProsseguir={() => setPasso("importar")}
        />
      )}

      {passo === "importar" && (
        <PassoImportar
          config={config}
          onVoltar={() => setPasso("config")}
          onProcessado={handleProcessado}
        />
      )}

      {passo === "revisar" && banco && (
        <PassoRevisar
          banco={banco}
          config={config}
          lancamentos={lancamentos}
          onMudarLancamentos={setLancamentos}
          onNovaImportacao={() => setPasso("importar")}
        />
      )}
    </div>
  );
}

function PassosIndicador({ passo }: { passo: Passo }) {
  const passos: { key: Passo; label: string }[] = [
    { key: "config", label: "1. Configuração" },
    { key: "importar", label: "2. Importar extrato" },
    { key: "revisar", label: "3. Revisar e exportar" },
  ];
  const idxAtual = passos.findIndex((p) => p.key === passo);
  return (
    <div className="flex items-center gap-2 text-xs">
      {passos.map((p, i) => (
        <div key={p.key} className="flex items-center gap-2">
          <span
            className={cn(
              "px-2.5 py-1 rounded-full font-medium",
              i === idxAtual ? "bg-brand-600 text-white" : i < idxAtual ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-400"
            )}
          >
            {p.label}
          </span>
          {i < passos.length - 1 && <span className="text-gray-300">→</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Passo 1: Configuração ──────────────────────────────────────────────
function PassoConfig({
  config, onMudar, onProsseguir,
}: {
  config: ConfigRealExtratos;
  onMudar: (c: ConfigRealExtratos) => void;
  onProsseguir: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [novaRegra, setNovaRegra] = useState({ keyword: "", conta_debito: "", conta_credito: "" });

  function campo<K extends keyof ConfigRealExtratos>(chave: K, valor: ConfigRealExtratos[K]) {
    onMudar({ ...config, [chave]: valor });
  }

  function adicionarRegra() {
    const kw = novaRegra.keyword.trim().toUpperCase();
    const deb = novaRegra.conta_debito.trim();
    const cred = novaRegra.conta_credito.trim();
    if (!kw || !deb || !cred) return;
    campo("rules", [...config.rules, { keyword: kw, conta_debito: deb, conta_credito: cred, priority: 1 }]);
    setNovaRegra({ keyword: "", conta_debito: "", conta_credito: "" });
  }

  function removerRegra(idx: number) {
    campo("rules", config.rules.filter((_, i) => i !== idx));
  }

  function prosseguir() {
    const faltando: string[] = [];
    if (!config.conta_banco.trim()) faltando.push("Conta do Banco");
    if (!config.conta_receita.trim()) faltando.push("Conta Receita de Vendas");
    if (!config.conta_socio.trim()) faltando.push("Conta Lucros a Distribuir");
    if (!config.conta_despesas.trim()) faltando.push("Conta Despesas Bancárias");
    if (!config.conta_padrao.trim()) faltando.push("Conta Padrão (Coringa)");
    if (faltando.length) {
      setErro(`Preencha os campos obrigatórios: ${faltando.join(", ")}`);
      return;
    }
    setErro(null);
    onProsseguir();
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Contas contábeis</h2>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            ⚠ Lembre: débito e crédito na contabilidade é invertido em relação ao banco. Receita de Vendas é usada
            para cartão e PIX de clientes. Lucros a Distribuir é usada somente para transferências ao sócio.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Conta do Banco</label>
            <input className="input" placeholder="Ex: 2156" value={config.conta_banco} onChange={(e) => campo("conta_banco", e.target.value)} />
          </div>
          <div>
            <label className="label">Conta Lucros a Distribuir</label>
            <input className="input" placeholder="Ex: 840" value={config.conta_socio} onChange={(e) => campo("conta_socio", e.target.value)} />
          </div>
          <div>
            <label className="label">Conta Receita de Vendas</label>
            <input className="input" placeholder="Ex: 1169" value={config.conta_receita} onChange={(e) => campo("conta_receita", e.target.value)} />
          </div>
          <div>
            <label className="label">⭐ Conta Padrão (coringa)</label>
            <input className="input" placeholder="Ex: 9999" value={config.conta_padrao} onChange={(e) => campo("conta_padrao", e.target.value)} />
          </div>
          <div>
            <label className="label">Conta Despesas Bancárias</label>
            <input className="input" placeholder="Ex: 2051" value={config.conta_despesas} onChange={(e) => campo("conta_despesas", e.target.value)} />
          </div>
          <div>
            <label className="label">Nome do sócio (opcional)</label>
            <input className="input" placeholder="Como aparece no extrato" value={config.nome_socio} onChange={(e) => campo("nome_socio", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Regras personalizadas</h2>
          <span className="text-xs text-gray-400">{config.rules.length} regra(s) — valem só para esta importação</span>
        </div>
        <p className="text-xs text-gray-500">
          Se a descrição do lançamento contiver a palavra-chave, usa as contas definidas aqui (tem prioridade sobre
          tudo). Ex: se contiver &quot;ALUGUEL&quot; → conta X / conta Y.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input flex-1" placeholder="Palavra-chave (ex: ALUGUEL)" value={novaRegra.keyword} onChange={(e) => setNovaRegra((p) => ({ ...p, keyword: e.target.value }))} />
          <input className="input sm:w-32" placeholder="Conta débito" value={novaRegra.conta_debito} onChange={(e) => setNovaRegra((p) => ({ ...p, conta_debito: e.target.value }))} />
          <input className="input sm:w-32" placeholder="Conta crédito" value={novaRegra.conta_credito} onChange={(e) => setNovaRegra((p) => ({ ...p, conta_credito: e.target.value }))} />
          <button className="btn btn-primary whitespace-nowrap" onClick={adicionarRegra}>+ Adicionar</button>
        </div>
        {config.rules.length > 0 && (
          <table className="table-auto-fixed">
            <thead>
              <tr>
                <th>Palavra-chave</th>
                <th style={{ width: 110 }}>Débito</th>
                <th style={{ width: 110 }}>Crédito</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {config.rules.map((r, i) => (
                <tr key={i} className="cursor-default hover:bg-transparent">
                  <td>{r.keyword}</td>
                  <td>{r.conta_debito}</td>
                  <td>{r.conta_credito}</td>
                  <td className="sem-corte">
                    <button className="btn btn-sm btn-danger" onClick={() => removerRegra(i)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {erro && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</div>}

      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={prosseguir}>Próximo: Importar Extrato →</button>
      </div>
    </div>
  );
}

// ─── Passo 2: Importar ───────────────────────────────────────────────────
function PassoImportar({
  config, onVoltar, onProcessado,
}: {
  config: ConfigRealExtratos;
  onVoltar: () => void;
  onProcessado: (dados: { banco: string | null; descricao: string; fornecedoresEncontrados: number; lancamentos: Lancamento[] }) => void;
}) {
  const [extrato, setExtrato] = useState<File | null>(null);
  const [balancete, setBalancete] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function processar() {
    if (!extrato) { setErro("Selecione o arquivo de extrato bancário (PDF)."); return; }
    setErro(null);
    setProcessando(true);
    try {
      const formData = new FormData();
      formData.append("extrato", extrato);
      if (balancete) formData.append("balancete", balancete);
      formData.append("config", JSON.stringify(config));

      const resp = await fetch("/api/real-extratos/processar", { method: "POST", body: formData });
      const dados = await resp.json();
      if (!resp.ok) {
        setErro(dados.error || "Não foi possível processar o extrato.");
        return;
      }
      onProcessado(dados);
    } catch (e: any) {
      setErro(e?.message || "Erro inesperado ao processar o extrato.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Extrato bancário</h2>
        <p className="text-xs text-gray-500">PDF do extrato — o banco é detectado automaticamente pelo layout.</p>
        <SeletorArquivo arquivo={extrato} onSelecionar={setExtrato} placeholder="Selecionar PDF do extrato" />
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Balancete (opcional)</h2>
        <p className="text-xs text-gray-500">
          Se enviado, os fornecedores encontrados no balancete são usados para sugerir a conta contábil de cada
          pagamento pelo nome — não fica salvo em lugar nenhum, vale só para esta importação.
        </p>
        <SeletorArquivo arquivo={balancete} onSelecionar={setBalancete} placeholder="Selecionar PDF do balancete" />
      </div>

      {erro && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</div>}

      <div className="flex justify-between">
        <button className="btn" onClick={onVoltar} disabled={processando}>← Voltar</button>
        <button className="btn btn-primary" onClick={processar} disabled={processando || !extrato}>
          {processando ? "Processando..." : "Processar Extrato →"}
        </button>
      </div>
    </div>
  );
}

function SeletorArquivo({ arquivo, onSelecionar, placeholder }: { arquivo: File | null; onSelecionar: (f: File | null) => void; placeholder: string }) {
  return (
    <label
      className={cn(
        "flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 text-sm cursor-pointer transition-colors",
        arquivo ? "border-brand-300 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
      )}
    >
      <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onSelecionar(e.target.files?.[0] ?? null)} />
      {arquivo ? (
        <span className="flex items-center gap-2">
          📄 {arquivo.name}
          <button
            type="button"
            className="text-xs text-red-600 hover:underline"
            onClick={(e) => { e.preventDefault(); onSelecionar(null); }}
          >
            remover
          </button>
        </span>
      ) : (
        <span>📎 {placeholder}</span>
      )}
    </label>
  );
}

// ─── Passo 3: Revisar e exportar ────────────────────────────────────────
function PassoRevisar({
  banco, config, lancamentos, onMudarLancamentos, onNovaImportacao,
}: {
  banco: { banco: string | null; descricao: string; fornecedoresEncontrados: number };
  config: ConfigRealExtratos;
  lancamentos: LancamentoUI[];
  onMudarLancamentos: (l: LancamentoUI[]) => void;
  onNovaImportacao: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [origemFiltro, setOrigemFiltro] = useState<"" | Lancamento["origem"]>("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [editando, setEditando] = useState<LancamentoUI[] | null>(null); // 1+ lançamentos sendo editados juntos

  function paraISO(dataBr: string): string | null {
    const [d, m, a] = dataBr.split("/");
    if (!d || !m || !a) return null;
    return `${a}-${m}-${d}`;
  }

  const visiveis = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (origemFiltro && l.origem !== origemFiltro) return false;
      if (buscaLower) {
        const alvo = `${l.description} ${l.debit} ${l.credit}`.toLowerCase();
        if (!alvo.includes(buscaLower)) return false;
      }
      const iso = paraISO(l.date);
      if (dataDe && iso && iso < dataDe) return false;
      if (dataAte && iso && iso > dataAte) return false;
      return true;
    });
  }, [lancamentos, busca, origemFiltro, dataDe, dataAte]);

  const totalVisivel = useMemo(() => visiveis.reduce((s, l) => s + l.value, 0), [visiveis]);
  const selecionados = useMemo(() => lancamentos.filter((l) => l.selecionado), [lancamentos]);
  const naoClassificados = useMemo(() => lancamentos.filter((l) => l.origem === "padrao").length, [lancamentos]);

  function alternarSelecaoTodosVisiveis() {
    const idsVisiveis = new Set(visiveis.map((l) => l.id));
    const todosMarcados = visiveis.length > 0 && visiveis.every((l) => l.selecionado);
    onMudarLancamentos(lancamentos.map((l) => (idsVisiveis.has(l.id) ? { ...l, selecionado: !todosMarcados } : l)));
  }

  function alternarSelecao(id: number) {
    onMudarLancamentos(lancamentos.map((l) => (l.id === id ? { ...l, selecionado: !l.selecionado } : l)));
  }

  function salvarEdicao(campos: { debit: string; credit: string; description: string }, salvarComoRegra: boolean) {
    if (!editando) return;
    const idsEditados = new Set(editando.map((l) => l.id));
    onMudarLancamentos(
      lancamentos.map((l) =>
        idsEditados.has(l.id)
          ? { ...l, debit: campos.debit.toUpperCase(), credit: campos.credit.toUpperCase(), description: campos.description.toUpperCase(), origem: "rule" as const, categoria: "REGRA" }
          : l
      )
    );
    setEditando(null);
    if (salvarComoRegra) {
      // Regra só vale para o restante desta importação (config não é
      // persistida) — aqui só avisamos visualmente, não há onde salvar
      // globalmente porque as contas contábeis são preenchidas do zero a
      // cada importação, por escolha do escritório.
    }
  }

  function limparFiltros() {
    setBusca(""); setOrigemFiltro(""); setDataDe(""); setDataAte("");
  }

  function exportar() {
    const conteudo = gerarArquivoAlterdata(visiveis);
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lancamentos_alterdata.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-6">
        <div>
          <div className="metric-label">Banco</div>
          <div className="metric-value text-base">{banco.banco ?? "Não reconhecido"}</div>
          <div className="metric-sub">{banco.descricao}</div>
        </div>
        <div>
          <div className="metric-label">Lançamentos</div>
          <div className="metric-value text-base">{lancamentos.length}</div>
          {visiveis.length !== lancamentos.length && <div className="metric-sub">{visiveis.length} visível(is) com o filtro atual</div>}
        </div>
        <div>
          <div className="metric-label">Total (filtro atual)</div>
          <div className="metric-value text-base">{fmtMoeda(totalVisivel)}</div>
        </div>
        {naoClassificados > 0 && (
          <div>
            <div className="metric-label">Não classificados</div>
            <div className="metric-value text-base text-amber-600">{naoClassificados}</div>
          </div>
        )}
        {banco.fornecedoresEncontrados > 0 && (
          <div>
            <div className="metric-label">Fornecedores no balancete</div>
            <div className="metric-value text-base">{banco.fornecedoresEncontrados}</div>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={onNovaImportacao}>Novo extrato</button>
          <button className="btn btn-primary" onClick={exportar} disabled={!visiveis.length}>⬇ Exportar (.txt)</button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Buscar (histórico, débito, crédito)</label>
            <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex: PIX, ALUGUEL, 2156..." />
          </div>
          <div>
            <label className="label">Origem</label>
            <select className="select" value={origemFiltro} onChange={(e) => setOrigemFiltro(e.target.value as any)}>
              <option value="">Todas</option>
              <option value="rule">Regra</option>
              <option value="fornecedor">Fornecedor</option>
              <option value="builtin">Automático</option>
              <option value="padrao">Não classificado</option>
            </select>
          </div>
          <div>
            <label className="label">De</label>
            <input type="date" className="input" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          </div>
          <div>
            <label className="label">Até</label>
            <input type="date" className="input" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
          </div>
          <button className="btn btn-sm" onClick={limparFiltros}>Limpar filtros</button>
        </div>

        {selecionados.length > 0 && (
          <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800">
            <span>{selecionados.length} selecionado(s)</span>
            <button className="btn btn-sm btn-primary ml-auto" onClick={() => setEditando(selecionados)}>Editar selecionados</button>
            <button className="btn btn-sm" onClick={() => onMudarLancamentos(lancamentos.map((l) => ({ ...l, selecionado: false })))}>Desmarcar todos</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="table-auto-fixed" style={{ tableLayout: "auto" }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={visiveis.length > 0 && visiveis.every((l) => l.selecionado)} onChange={alternarSelecaoTodosVisiveis} />
                </th>
                <th style={{ width: 90 }}>Data</th>
                <th>Histórico</th>
                <th style={{ width: 90 }}>Débito</th>
                <th style={{ width: 90 }}>Crédito</th>
                <th style={{ width: 110 }}>Valor</th>
                <th style={{ width: 130 }}>Origem</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.id} onClick={() => setEditando([l])}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={l.selecionado} onChange={() => alternarSelecao(l.id)} />
                  </td>
                  <td>{l.date}</td>
                  <td className="whitespace-normal">{l.description}</td>
                  <td>{l.debit}</td>
                  <td>{l.credit}</td>
                  <td>{fmtMoeda(l.value)}</td>
                  <td className="sem-corte">
                    <span className={cn("badge", ORIGEM_LABEL[l.origem].badge)}>{ORIGEM_LABEL[l.origem].texto}</span>
                  </td>
                </tr>
              ))}
              {visiveis.length === 0 && (
                <tr className="hover:bg-transparent cursor-default">
                  <td colSpan={7} className="text-center text-gray-400 py-6">Nenhum lançamento encontrado com o filtro atual.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <ModalEditarLancamento
          lancamentos={editando}
          onFechar={() => setEditando(null)}
          onSalvar={salvarEdicao}
        />
      )}
    </div>
  );
}

// ─── Modal de edição (linha única ou em lote) ───────────────────────────
function ModalEditarLancamento({
  lancamentos, onFechar, onSalvar,
}: {
  lancamentos: LancamentoUI[];
  onFechar: () => void;
  onSalvar: (campos: { debit: string; credit: string; description: string }, salvarComoRegra: boolean) => void;
}) {
  const lote = lancamentos.length > 1;
  const base = lancamentos[0];
  const [debit, setDebit] = useState(lote ? "" : base.debit);
  const [credit, setCredit] = useState(lote ? "" : base.credit);
  const [description, setDescription] = useState(lote ? "" : base.description);
  const [salvarComoRegra, setSalvarComoRegra] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="card w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900">
          {lote ? `Editar ${lancamentos.length} lançamentos selecionados` : "Editar lançamento"}
        </h3>
        {!lote && (
          <div className="text-xs text-gray-500">{base.date} — {fmtMoeda(base.value)}</div>
        )}
        <div>
          <label className="label">Histórico</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={lote ? "Deixe em branco para manter o histórico de cada um" : undefined} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Conta débito</label>
            <input className="input" value={debit} onChange={(e) => setDebit(e.target.value)} />
          </div>
          <div>
            <label className="label">Conta crédito</label>
            <input className="input" value={credit} onChange={(e) => setCredit(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={salvarComoRegra} onChange={(e) => setSalvarComoRegra(e.target.checked)} />
          Marcar como classificado manualmente (regra)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!debit.trim() || !credit.trim()) return;
              onSalvar(
                {
                  debit: debit.trim(),
                  credit: credit.trim(),
                  description: description.trim() || (lote ? "" : base.description),
                },
                salvarComoRegra
              );
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
