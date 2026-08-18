"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

interface LinhaTempo { ano: number; entradas: number; saidas: number; totalAcumulado: number }
interface ContagemBairro { bairro: string; quantidade: number }

interface Dados {
  linhaDoTempo: LinhaTempo[];
  bairrosEntradaPorAno: Record<number, ContagemBairro[]>;
  bairrosSaidaPorAno: Record<number, ContagemBairro[]>;
  filtrosDisponiveis: { municipios: string[]; bairros: string[] };
  totalGeralEmpresas: number;
  semDataPreenchida: number;
  semCadastroCompleto: number;
  totalBaixadas: number;
}

function BarraLista({ itens, corBarra, corTexto }: { itens: { label: string; quantidade: number }[]; corBarra: string; corTexto: string }) {
  const max = Math.max(1, ...itens.map((i) => i.quantidade));
  if (itens.length === 0) return <p className="text-xs text-gray-400">Sem dados para este filtro.</p>;
  return (
    <div className="space-y-2">
      {itens.map((i) => (
        <div key={i.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 truncate">{i.label}</span>
            <span className={`font-medium flex-shrink-0 ml-2 ${corTexto}`}>{i.quantidade}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${corBarra}`} style={{ width: `${(i.quantidade / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EntradasSaidasClientes() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null);
  const [municipioFiltro, setMunicipioFiltro] = useState("");
  const [bairroFiltro, setBairroFiltro] = useState("");

  const buscar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams();
    if (municipioFiltro) params.set("municipio", municipioFiltro);
    if (bairroFiltro) params.set("bairro", bairroFiltro);

    fetch(`/api/relatorios/socios?${params}`)
      .then(async (r) => {
        const texto = await r.text();
        let json: any;
        try {
          json = JSON.parse(texto);
        } catch {
          throw new Error(`O servidor respondeu algo inesperado (status ${r.status}). Trecho: ${texto.slice(0, 200)}`);
        }
        if (!r.ok) {
          throw new Error(json.detalhe ? `${json.error} — ${json.detalhe}` : (json.error ?? `Erro (status ${r.status})`));
        }
        return json;
      })
      .then((json: Dados) => {
        setDados(json);
        setAnoSelecionado((atual) => {
          const anos = json.linhaDoTempo.map((l) => l.ano);
          if (atual && anos.includes(atual)) return atual;
          return anos.length > 0 ? anos[anos.length - 1] : null;
        });
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [municipioFiltro, bairroFiltro]);

  useEffect(() => { buscar(); }, [buscar]);

  const temMovimento = useMemo(
    () => (dados?.linhaDoTempo ?? []).some((l) => l.entradas > 0 || l.saidas > 0),
    [dados]
  );

  const bairrosEntrada = dados && anoSelecionado ? (dados.bairrosEntradaPorAno[anoSelecionado] ?? []) : [];
  const bairrosSaida = dados && anoSelecionado ? (dados.bairrosSaidaPorAno[anoSelecionado] ?? []) : [];
  const anosDisponiveis = dados?.linhaDoTempo.map((l) => l.ano) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Entradas e saídas de clientes</h2>
      </div>

      {erro ? (
        <div className="card text-center py-8 space-y-2">
          <p className="text-red-500 text-sm">{erro}</p>
          <button onClick={buscar} className="btn btn-sm">Tentar de novo</button>
        </div>
      ) : (
        <>
          {dados && dados.totalBaixadas > 0 && (
            <div className="card bg-red-50 border-red-200 flex items-center gap-3">
              <span className="badge badge-red text-xs">BAIXADAS</span>
              <span className="text-sm text-red-800">
                <strong>{dados.totalBaixadas}</strong> cliente(s) marcado(s) como empresa baixada
                {(municipioFiltro || bairroFiltro) ? " (considerando o filtro atual)" : ""}
              </span>
            </div>
          )}

          {/* Filtros */}
          <div className="card flex flex-wrap gap-3 items-end">
            <div>
              <label className="label">Cidade</label>
              <select className="select text-sm w-44" value={municipioFiltro} onChange={(e) => setMunicipioFiltro(e.target.value)}>
                <option value="">Todas as cidades</option>
                {dados?.filtrosDisponiveis.municipios.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bairro</label>
              <select className="select text-sm w-44" value={bairroFiltro} onChange={(e) => setBairroFiltro(e.target.value)}>
                <option value="">Todos os bairros</option>
                {dados?.filtrosDisponiveis.bairros.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {(municipioFiltro || bairroFiltro) && (
              <button onClick={() => { setMunicipioFiltro(""); setBairroFiltro(""); }} className="btn btn-sm text-gray-400">
                Limpar filtros
              </button>
            )}
            {dados && (dados.semDataPreenchida > 0 || dados.semCadastroCompleto > 0) && (
              <span className="text-xs text-gray-400 ml-auto">
                {dados.totalGeralEmpresas} cliente(s) no total
                {dados.semDataPreenchida > 0 && ` · ${dados.semDataPreenchida} sem data de entrada preenchida`}
                {dados.semCadastroCompleto > 0 && ` · ${dados.semCadastroCompleto} com cadastro incompleto`}
              </span>
            )}
          </div>

          {carregando ? (
            <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div>
          ) : !temMovimento ? (
            <div className="card bg-amber-50 border-amber-200">
              <p className="text-sm text-amber-800">
                Nenhum cliente com &quot;Data de entrada&quot; ou &quot;Data de saída&quot; preenchida ainda
                {(municipioFiltro || bairroFiltro) ? " para esse filtro" : ""}. Preencha em &quot;Editar cadastro&quot;
                de cada cliente pra essas estatísticas aparecerem aqui.
              </p>
            </div>
          ) : (
            <>
              {/* Linha do tempo: entradas, saídas e total acumulado por ano */}
              <div className="card !p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Ano a ano</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-auto-fixed">
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>Ano</th>
                        <th style={{ width: 120 }}>Entraram</th>
                        <th style={{ width: 120 }}>Saíram</th>
                        <th style={{ width: 160 }}>Total de clientes*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados!.linhaDoTempo.map((l) => (
                        <tr key={l.ano} className={l.ano === anoSelecionado ? "bg-brand-50" : ""}>
                          <td>
                            <button onClick={() => setAnoSelecionado(l.ano)} className="font-medium text-gray-900 hover:text-brand-700">
                              {l.ano}
                            </button>
                          </td>
                          <td className="text-green-700 font-medium">{l.entradas > 0 ? `+${l.entradas}` : "—"}</td>
                          <td className="text-orange-700 font-medium">{l.saidas > 0 ? `-${l.saidas}` : "—"}</td>
                          <td className="text-gray-700 font-medium">{l.totalAcumulado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
                  * Total acumulado de clientes que entraram menos os que já saíram, até o fim daquele ano (considerando o filtro de cidade/bairro escolhido acima).
                </div>
              </div>

              {/* Bairros do ano selecionado */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Bairros do ano selecionado</h3>
                  <select className="select text-sm w-32" value={anoSelecionado ?? ""} onChange={(e) => setAnoSelecionado(Number(e.target.value))}>
                    {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Entradas em {anoSelecionado}</h4>
                    <BarraLista itens={bairrosEntrada.map((b) => ({ label: b.bairro, quantidade: b.quantidade }))} corBarra="bg-green-400" corTexto="text-green-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Saídas em {anoSelecionado}</h4>
                    <BarraLista itens={bairrosSaida.map((b) => ({ label: b.bairro, quantidade: b.quantidade }))} corBarra="bg-orange-400" corTexto="text-orange-700" />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
