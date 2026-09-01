"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatCompetencia, competenciaAtual, navegarCompetencia, calcularVencimento, formatData } from "@/lib/utils";
import { STATUS_OBRIGACAO_LABEL, type ObrigacaoComContexto } from "@/types";
import { StatusObrigacao } from "@prisma/client";

const STATUS_COR: Record<StatusObrigacao, string> = {
  NAO_INICIADO:          "badge badge-gray",
  EM_ANDAMENTO:          "badge badge-blue",
  AGUARDANDO_CLIENTE:    "badge badge-yellow",
  RECEBIDO_PARCIALMENTE: "badge badge-yellow",
  RECEBIDO:              "badge badge-blue",
  ENVIADO:               "badge badge-blue",
  CONCLUIDO:             "badge badge-green",
  NAO_SE_APLICA:         "badge badge-gray",
  EM_ATRASO:             "badge badge-red",
};

export default function ObrigacoesPage() {
  const { data: session } = useSession();
  const isDiretoria = (session?.user as any)?.perfilGlobal === "DIRETORIA";
  const [gerando, setGerando] = useState(false);
  const [msgGerar, setMsgGerar] = useState<string | null>(null);

  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [dados, setDados] = useState<ObrigacaoComContexto[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [semObrigacaoVinculada, setSemObrigacaoVinculada] = useState<{ id: string; codigoInterno: string; razaoSocial: string }[]>([]);
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false);

  // Filtros
  const [setorId, setSetorId] = useState("");
  const [status, setStatus] = useState("");
  const [minhaCarteira, setMinhaCarteira] = useState(false);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    fetch("/api/setores").then((r) => r.json()).then(setSetores).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams({ competencia, pageSize: "200" });
    if (setorId)        params.set("setorId", setorId);
    if (status)         params.set("status", status);
    if (minhaCarteira)  params.set("minhaCarteira", "true");

    const res = await fetch(`/api/obrigacoes?${params}`);
    if (res.ok) {
      const json = await res.json();
      setDados(json.data);
      setTotal(json.total);
      setSemObrigacaoVinculada(json.semObrigacaoVinculada ?? []);
    }
    setCarregando(false);
  }, [competencia, setorId, status, minhaCarteira]);

  useEffect(() => { buscar(); }, [buscar]);

  async function atualizarStatus(id: string, novoStatus: StatusObrigacao) {
    setSalvando(id);
    await fetch("/api/obrigacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: novoStatus }),
    });
    setSalvando(null);
    buscar();
  }

  async function gerarCompetencia() {
    setGerando(true);
    setMsgGerar(null);
    const res = await fetch("/api/obrigacoes/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competencia }),
    });
    setGerando(false);
    if (res.ok) {
      const json = await res.json();
      setMsgGerar(`${json.criadas} nova(s) obrigação(ões) gerada(s) para ${formatCompetencia(competencia)} (${json.jaExistiam} já existiam).`);
      buscar();
    } else {
      setMsgGerar("Erro ao gerar competência.");
    }
    setTimeout(() => setMsgGerar(null), 6000);
  }

  // Agrupar por empresa
  const porEmpresa = dados.reduce((acc, item) => {
    const empId = item.obrigacaoEmpresa.empresa.id;
    if (!acc[empId]) acc[empId] = { empresa: item.obrigacaoEmpresa.empresa, itens: [] };
    acc[empId].itens.push(item);
    return acc;
  }, {} as Record<string, { empresa: any; itens: ObrigacaoComContexto[] }>);

  const resumo = {
    concluido:   dados.filter((d) => d.status === "CONCLUIDO").length,
    pendente:    dados.filter((d) => !["CONCLUIDO", "NAO_SE_APLICA"].includes(d.status)).length,
    emAtraso:    dados.filter((d) => d.status === "EM_ATRASO").length,
    naoIniciado: dados.filter((d) => d.status === "NAO_INICIADO").length,
  };

  return (
    <div className="space-y-5">
      {msgGerar && (
        <div className="fixed bottom-6 right-6 max-w-md px-4 py-3 rounded-xl shadow-lg text-sm font-medium bg-gray-900 text-white z-50">
          {msgGerar}
        </div>
      )}

      {isDiretoria && (
        <div className="card flex items-center justify-between bg-blue-50/50 border-blue-200">
          <div className="text-sm text-gray-700">
            Ainda não gerou as obrigações de <strong>{formatCompetencia(competencia)}</strong>? Clique para criar
            as pendências do mês a partir dos vínculos configurados em cada cliente.
          </div>
          <button onClick={gerarCompetencia} disabled={gerando} className="btn btn-primary btn-sm flex-shrink-0 ml-3">
            {gerando ? "Gerando..." : "Gerar competência do mês"}
          </button>
        </div>
      )}

      {/* Navegador de competência */}
      <div className="card flex items-center justify-between">
        <button
          className="btn btn-sm"
          onClick={() => setCompetencia((c) => navegarCompetencia(c, -1))}
        >← Mês anterior</button>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {formatCompetencia(competencia)}
          </div>
          <div className="text-xs text-gray-400">{total} obrigações neste período</div>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => setCompetencia((c) => navegarCompetencia(c, +1))}
        >Próximo mês →</button>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="metric-card">
          <div className="metric-label">Concluídas</div>
          <div className="metric-value text-green-700">{resumo.concluido}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pendentes</div>
          <div className="metric-value text-yellow-600">{resumo.pendente}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Em atraso</div>
          <div className="metric-value text-red-600">{resumo.emAtraso}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Não iniciadas</div>
          <div className="metric-value text-gray-600">{resumo.naoIniciado}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap gap-3 items-center">
        <select className="select text-sm w-40"
          value={setorId} onChange={(e) => setSetorId(e.target.value)}>
          <option value="">Todos os setores</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>

        <select className="select text-sm w-48"
          value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_OBRIGACAO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <button
          onClick={() => setMinhaCarteira((v) => !v)}
          className={`badge cursor-pointer ${minhaCarteira ? "bg-brand-100 text-brand-700" : "badge-gray"}`}
        >
          Minha carteira
        </button>

        <button onClick={() => setCompetencia(competenciaAtual())} className="btn btn-sm ml-auto">
          Mês atual
        </button>
      </div>

      {/* Checagem de cobertura — avisa se algum cliente ativo do setor
          filtrado não tem nenhuma obrigação vinculada (pra não "sumir" da
          lista sem ninguém perceber). Só aparece com um setor selecionado. */}
      {setorId && semObrigacaoVinculada.length > 0 && (
        <div className="card bg-yellow-50/50 border-yellow-200">
          <button
            onClick={() => setMostrarFaltantes((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <span className="text-sm text-yellow-800">
              <strong>{semObrigacaoVinculada.length} cliente(s)</strong> desse setor não têm nenhuma
              obrigação vinculada — pode ser que alguém tenha esquecido de vincular.
            </span>
            <span className="text-xs text-yellow-700 flex-shrink-0">{mostrarFaltantes ? "Ocultar" : "Ver lista"}</span>
          </button>
          {mostrarFaltantes && (
            <div className="mt-3 pt-3 border-t border-yellow-200 flex flex-wrap gap-2">
              {semObrigacaoVinculada.map((e) => (
                <a
                  key={e.id}
                  href={`/empresas/${e.id}`}
                  className="text-xs font-mono bg-white border border-yellow-200 rounded px-2 py-1 text-yellow-800 hover:border-yellow-400"
                  title={e.razaoSocial}
                >
                  {e.codigoInterno} — {e.razaoSocial}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Painel por empresa */}
      {carregando ? (
        <div className="card text-center py-12 text-gray-400">Carregando...</div>
      ) : Object.keys(porEmpresa).length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          Nenhuma obrigação encontrada para {formatCompetencia(competencia)}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.values(porEmpresa).map(({ empresa, itens }) => {
            const concluidas = itens.filter((i) => i.status === "CONCLUIDO").length;
            const atrasadas  = itens.filter((i) => i.status === "EM_ATRASO").length;

            return (
              <div key={empresa.id} className="card !p-0 overflow-hidden">
                {/* Cabeçalho da empresa */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-brand-700 text-sm">{empresa.codigoInterno}</span>
                    <span className="ml-2 text-sm text-gray-600">{empresa.razaoSocial}</span>
                    {atrasadas > 0 && (
                      <span className="ml-2 badge badge-red">{atrasadas} em atraso</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {concluidas}/{itens.length} concluídas
                  </span>
                </div>

                {/* Lista de obrigações */}
                <div className="divide-y divide-gray-100">
                  {itens.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      {/* Dot de status */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.status === "CONCLUIDO"         ? "bg-green-500" :
                        item.status === "EM_ATRASO"         ? "bg-red-500" :
                        item.status === "AGUARDANDO_CLIENTE"? "bg-yellow-500" :
                        item.status === "NAO_SE_APLICA"     ? "bg-gray-300" :
                        "bg-blue-400"
                      }`} />

                      {/* Nome da obrigação */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800">
                          {item.obrigacaoEmpresa.template.nome}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">
                          {item.obrigacaoEmpresa.template.setor.nome}
                        </span>
                        {(() => {
                          const venc = calcularVencimento(
                            item.competencia,
                            item.obrigacaoEmpresa.template.diaVencimento,
                            item.obrigacaoEmpresa.template.vencimentoMesSeguinte
                          );
                          if (!venc) return null;
                          return (
                            <span className={`ml-2 text-xs ${item.status === "EM_ATRASO" ? "text-red-500 font-medium" : "text-gray-400"}`}>
                              vence {formatData(venc)}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Responsável */}
                      {item.responsavel && (
                        <span className="text-xs text-gray-400 hidden md:inline">
                          {item.responsavel.nome}
                        </span>
                      )}

                      {/* Select de status */}
                      <select
                        className="select text-xs w-44 py-1"
                        value={item.status}
                        disabled={salvando === item.id}
                        onChange={(e) => atualizarStatus(item.id, e.target.value as StatusObrigacao)}
                      >
                        {Object.entries(STATUS_OBRIGACAO_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>

                      {salvando === item.id && (
                        <svg className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
