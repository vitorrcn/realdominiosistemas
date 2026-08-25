"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";

interface AgendaItemDTO {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  horaInicio: string | null;
  horaFim: string | null;
  diaTodo: boolean;
  tipo: string;
  concluido: boolean;
  privado: boolean;
  setor: { id: string; nome: string } | null;
  usuario: { id: string; nome: string } | null;
  criadoPor: { id: string; nome: string };
}

interface OpcaoSimples { id: string; nome: string }

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inicioDaSemana(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function AgendaPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const podeEditar = user && user.perfilGlobal !== "CONSULTA";
  const vejoSoAMinha = user?.perfilGlobal === "OPERADOR";

  const [visao, setVisao] = useState<"semana" | "mes">("semana");
  const [ancora, setAncora] = useState(new Date());
  const [setorFiltro, setSetorFiltro] = useState("");
  const [usuarioFiltro, setUsuarioFiltro] = useState("");

  const [setores, setSetores] = useState<OpcaoSimples[]>([]);
  const [usuarios, setUsuarios] = useState<OpcaoSimples[]>([]);
  const [itens, setItens] = useState<AgendaItemDTO[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modal, setModal] = useState<{ aberto: boolean; item?: AgendaItemDTO; dataPreenchida?: string } | null>(null);

  useEffect(() => {
    fetch("/api/setores").then((r) => r.ok ? r.json() : []).then(setSetores).catch(() => {});
    fetch("/api/usuarios").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
  }, []);

  // ── Intervalo visível conforme a visão ────────────────────────
  const { inicio, fim, celulas, titulo } = useMemo(() => {
    if (visao === "semana") {
      const ini = inicioDaSemana(ancora);
      const dias: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(ini);
        d.setDate(d.getDate() + i);
        dias.push(d);
      }
      const fimSemana = dias[6];
      const tit = ini.getMonth() === fimSemana.getMonth()
        ? `${ini.getDate()} — ${fimSemana.getDate()} de ${MESES[ini.getMonth()]} de ${ini.getFullYear()}`
        : `${ini.getDate()} de ${MESES[ini.getMonth()]} — ${fimSemana.getDate()} de ${MESES[fimSemana.getMonth()]} de ${fimSemana.getFullYear()}`;
      return { inicio: toISODate(ini), fim: toISODate(fimSemana), celulas: dias, titulo: tit };
    } else {
      const primeiroDia = new Date(ancora.getFullYear(), ancora.getMonth(), 1);
      const ultimoDia = new Date(ancora.getFullYear(), ancora.getMonth() + 1, 0);
      const inicioGrade = inicioDaSemana(primeiroDia);
      const dias: Date[] = [];
      const cursor = new Date(inicioGrade);
      // grade de semanas completas cobrindo o mês inteiro
      while (cursor <= ultimoDia || cursor.getDay() !== 0) {
        dias.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
        if (dias.length > 42) break;
      }
      const tit = `${MESES[ancora.getMonth()]} de ${ancora.getFullYear()}`;
      return { inicio: toISODate(dias[0]), fim: toISODate(dias[dias.length - 1]), celulas: dias, titulo: tit };
    }
  }, [visao, ancora]);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams({ inicio, fim });
    if (setorFiltro) params.set("setorId", setorFiltro);
    if (usuarioFiltro) params.set("usuarioId", usuarioFiltro);
    const res = await fetch(`/api/agenda?${params}`);
    if (res.ok) setItens(await res.json());
    setCarregando(false);
  }, [inicio, fim, setorFiltro, usuarioFiltro]);

  useEffect(() => { buscar(); }, [buscar]);

  const itensPorDia = useMemo(() => {
    const map = new Map<string, AgendaItemDTO[]>();
    for (const it of itens) {
      const chave = String(it.data).slice(0, 10);
      if (!map.has(chave)) map.set(chave, []);
      map.get(chave)!.push(it);
    }
    return map;
  }, [itens]);

  function navegar(direcao: -1 | 1) {
    const novo = new Date(ancora);
    if (visao === "semana") novo.setDate(novo.getDate() + direcao * 7);
    else novo.setMonth(novo.getMonth() + direcao);
    setAncora(novo);
  }

  // Marca/desmarca um compromisso como feito direto na grade, sem abrir o
  // modal — reenvia todos os campos do item (o PUT não faz update parcial).
  async function alternarConcluido(item: AgendaItemDTO) {
    setItens((prev) => prev.map((it) => it.id === item.id ? { ...it, concluido: !it.concluido } : it));
    const res = await fetch(`/api/agenda/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: item.titulo,
        descricao: item.descricao,
        data: String(item.data).slice(0, 10),
        horaInicio: item.horaInicio,
        horaFim: item.horaFim,
        diaTodo: item.diaTodo,
        tipo: item.tipo,
        concluido: !item.concluido,
      }),
    });
    if (!res.ok) {
      // reverte se o servidor recusou
      setItens((prev) => prev.map((it) => it.id === item.id ? { ...it, concluido: item.concluido } : it));
    }
  }

  const hojeISO = toISODate(new Date());

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => navegar(-1)} className="btn btn-sm">←</button>
            <button onClick={() => setAncora(new Date())} className="btn btn-sm">Hoje</button>
            <button onClick={() => navegar(1)} className="btn btn-sm">→</button>
            <h2 className="text-sm font-semibold text-gray-900 ml-2 capitalize">{titulo}</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setVisao("semana")}
                className={`px-3 py-1.5 text-sm ${visao === "semana" ? "bg-brand-600 text-white" : "bg-white text-gray-600"}`}
              >Semanal</button>
              <button
                onClick={() => setVisao("mes")}
                className={`px-3 py-1.5 text-sm ${visao === "mes" ? "bg-brand-600 text-white" : "bg-white text-gray-600"}`}
              >Mensal</button>
            </div>

            {podeEditar && (
              <button
                onClick={() => setModal({ aberto: true, dataPreenchida: hojeISO })}
                className="btn btn-sm btn-primary"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Novo compromisso
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {vejoSoAMinha ? (
            <span className="text-xs text-gray-400 self-center">Sua agenda pessoal</span>
          ) : (
            <>
              <select className="select text-sm w-52" value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value)}>
                <option value="">Todos os setores</option>
                {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              <select className="select text-sm w-52" value={usuarioFiltro} onChange={(e) => setUsuarioFiltro(e.target.value)}>
                <option value="">Todos os colaboradores</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              {(setorFiltro || usuarioFiltro) && (
                <button onClick={() => { setSetorFiltro(""); setUsuarioFiltro(""); }} className="btn btn-sm text-gray-400">
                  Limpar filtros
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Grade */}
      <div className="grid grid-cols-7 gap-2 flex-1 min-w-0 w-full">
        {celulas.map((dia, i) => {
          const chave = toISODate(dia);
          const itensDoDia = itensPorDia.get(chave) ?? [];
          const foraDoMes = visao === "mes" && dia.getMonth() !== ancora.getMonth();
          const ehHoje = chave === hojeISO;

          return (
            <div
              key={chave}
              className={`card !p-2 space-y-1 ${visao === "semana" ? "min-h-[320px]" : "min-h-[110px]"} ${foraDoMes ? "opacity-40" : ""} ${ehHoje ? "ring-2 ring-brand-400" : ""}`}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-gray-400 uppercase">{DIAS_SEMANA[dia.getDay()]}</span>
                <span className={`text-xs font-semibold ${ehHoje ? "text-brand-700" : "text-gray-700"}`}>{dia.getDate()}</span>
              </div>

              <div className="space-y-1">
                {itensDoDia.slice(0, visao === "mes" ? 3 : 99).map((it) => (
                  <div
                    key={it.id}
                    className={`w-full flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] leading-tight ${
                      it.concluido ? "bg-green-50 text-green-700" : it.tipo === "REUNIAO" ? "bg-amber-50 text-amber-700" : it.setor ? "bg-blue-50 text-blue-700" : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    {podeEditar && (
                      <input
                        type="checkbox"
                        className="w-3 h-3 rounded flex-shrink-0 accent-green-600 cursor-pointer"
                        checked={it.concluido}
                        onChange={() => alternarConcluido(it)}
                        title={it.concluido ? "Marcar como não feito" : "Marcar como feito"}
                      />
                    )}
                    <button
                      onClick={() => setModal({ aberto: true, item: it })}
                      className={`flex-1 min-w-0 text-left truncate ${it.concluido ? "line-through opacity-70" : ""}`}
                      title={it.titulo}
                    >
                      {it.tipo === "REUNIAO" && "🗓️ "}
                      {it.privado && "🔒 "}
                      {!it.diaTodo && it.horaInicio && <span className="font-mono mr-1">{it.horaInicio}</span>}
                      {it.titulo}
                    </button>
                  </div>
                ))}
                {visao === "mes" && itensDoDia.length > 3 && (
                  <div className="text-[10px] text-gray-400 px-1.5">+{itensDoDia.length - 3} mais</div>
                )}
              </div>

              {podeEditar && visao === "semana" && (
                <button
                  onClick={() => setModal({ aberto: true, dataPreenchida: chave })}
                  className="w-full text-center text-[11px] text-gray-300 hover:text-brand-600 py-1"
                >+ adicionar</button>
              )}
            </div>
          );
        })}
      </div>

      <PainelLembretes />
      </div>

      {carregando && <p className="text-xs text-gray-400 text-center">Carregando...</p>}

      {modal?.aberto && (
        <ModalCompromisso
          item={modal.item}
          dataPreenchida={modal.dataPreenchida}
          setores={setores}
          usuarios={usuarios}
          perfil={user?.perfilGlobal}
          meuId={user?.id}
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); buscar(); }}
        />
      )}
    </div>
  );
}

// ── Lembretes ─────────────────────────────────────────────────────
// Recados pontuais, sem data marcada — bem mais leve que um compromisso.
// Sempre pessoais (só quem criou vê e mexe). Suporta **negrito** no texto.
interface LembreteDTO { id: string; texto: string; createdAt: string }

// Renderiza texto com **trechos em negrito** virando <strong>, preservando
// quebras de linha (o container usa whitespace-pre-wrap).
function renderComNegrito(texto: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    const m = parte.match(/^\*\*([^*]+)\*\*$/);
    return m ? <strong key={i}>{m[1]}</strong> : <span key={i}>{parte}</span>;
  });
}

function PainelLembretes() {
  const [lembretes, setLembretes] = useState<LembreteDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/lembretes");
    if (res.ok) setLembretes(await res.json());
    setCarregando(false);
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  function aplicarNegrito() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selecionado = texto.slice(start, end);
    const antes = texto.slice(0, start);
    const depois = texto.slice(end);
    const novo = selecionado ? `${antes}**${selecionado}**${depois}` : `${antes}**negrito**${depois}`;
    setTexto(novo);
    requestAnimationFrame(() => {
      ta.focus();
      if (selecionado) {
        ta.setSelectionRange(start + selecionado.length + 4, start + selecionado.length + 4);
      } else {
        ta.setSelectionRange(start + 2, start + 2 + "negrito".length);
      }
    });
  }

  function iniciarEdicao(l: LembreteDTO) {
    setEditandoId(l.id);
    setTexto(l.texto);
    textareaRef.current?.focus();
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setTexto("");
  }

  async function salvar() {
    const valor = texto.trim();
    if (!valor) return;
    setSalvando(true);
    const res = editandoId
      ? await fetch(`/api/lembretes/${editandoId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: valor }),
        })
      : await fetch("/api/lembretes", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: valor }),
        });
    setSalvando(false);
    if (res.ok) {
      setTexto("");
      setEditandoId(null);
      buscar();
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este lembrete?")) return;
    if (editandoId === id) cancelarEdicao();
    await fetch(`/api/lembretes/${id}`, { method: "DELETE" });
    buscar();
  }

  return (
    <div className="card space-y-3 w-full lg:w-72 flex-shrink-0">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
        📌 Lembretes
      </h3>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={aplicarNegrito}
            className="btn-icon !p-1.5 font-bold text-xs w-7 h-7"
            title="Negrito"
          >B</button>
          <span className="text-[10px] text-gray-400">selecione o texto e clique em B pra negritar</span>
        </div>
        <textarea
          ref={textareaRef}
          className="input text-sm min-h-[64px] bg-yellow-50/60"
          placeholder="Anote algo pontual do dia a dia..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !texto.trim()}
            className="btn btn-primary btn-sm flex-1"
          >
            {salvando ? "Salvando..." : editandoId ? "Salvar alteração" : "+ Adicionar lembrete"}
          </button>
          {editandoId && (
            <button type="button" onClick={cancelarEdicao} className="btn btn-sm">Cancelar</button>
          )}
        </div>
      </div>

      <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
        {carregando ? (
          <p className="text-xs text-gray-400 text-center py-4">Carregando...</p>
        ) : lembretes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Nenhum lembrete ainda.</p>
        ) : lembretes.map((l) => (
          <div key={l.id} className="group flex items-start gap-2 bg-yellow-50/60 border border-yellow-100 rounded-lg px-2.5 py-2">
            <button
              type="button"
              onClick={() => iniciarEdicao(l)}
              className="flex-1 min-w-0 text-left text-xs text-gray-700 whitespace-pre-wrap break-words"
            >
              {renderComNegrito(l.texto)}
            </button>
            <button
              type="button"
              onClick={() => excluir(l.id)}
              className="text-gray-300 hover:text-red-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Excluir"
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal de criar/editar compromisso ────────────────────────────
function ModalCompromisso({ item, dataPreenchida, setores, usuarios, perfil, meuId, onFechar, onSalvo }: {
  item?: AgendaItemDTO;
  dataPreenchida?: string;
  setores: OpcaoSimples[];
  usuarios: OpcaoSimples[];
  perfil: string;
  meuId: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = !!item;
  const [alvo, setAlvo] = useState<"setor" | "usuario">(item?.setor ? "setor" : "usuario");
  const [form, setForm] = useState({
    titulo: item?.titulo ?? "",
    descricao: item?.descricao ?? "",
    data: item ? String(item.data).slice(0, 10) : (dataPreenchida ?? ""),
    horaInicio: item?.horaInicio ?? "",
    horaFim: item?.horaFim ?? "",
    diaTodo: item?.diaTodo ?? false,
    tipo: item?.tipo ?? "COMPROMISSO",
    concluido: item?.concluido ?? false,
    privado: item?.privado ?? false,
    setorId: item?.setor?.id ?? "",
    // Novo compromisso "de um colaborador": já vem pré-selecionado com a
    // própria pessoa (o caso mais comum é criar algo pra si mesmo).
    usuarioId: item?.usuario?.id ?? (item ? "" : meuId ?? ""),
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const payload = {
      ...form,
      setorId: alvo === "setor" ? form.setorId : null,
      usuarioId: alvo === "usuario" ? form.usuarioId : null,
    };

    const res = editando
      ? await fetch(`/api/agenda/${item!.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        })
      : await fetch("/api/agenda", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });

    setSalvando(false);
    if (res.ok) {
      onSalvo();
    } else {
      const json = await res.json().catch(() => ({}));
      setErro(json.error ?? "Erro ao salvar compromisso.");
    }
  }

  async function excluir() {
    if (!item || !confirm("Excluir este compromisso?")) return;
    setSalvando(true);
    const res = await fetch(`/api/agenda/${item.id}`, { method: "DELETE" });
    setSalvando(false);
    if (res.ok) onSalvo();
    else setErro("Erro ao excluir.");
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {editando ? "Editar compromisso" : "Novo compromisso"}
          </h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="label">Título</label>
            <input className="input" value={form.titulo} onChange={(e) => set("titulo", e.target.value)} required />
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea className="input min-h-[60px]" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="label">Data</label>
              <input className="input" type="date" value={form.data} onChange={(e) => set("data", e.target.value)} required />
            </div>
            <div className="col-span-1">
              <label className="label">Início</label>
              <input className="input" type="time" disabled={form.diaTodo} value={form.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} />
            </div>
            <div className="col-span-1">
              <label className="label">Fim</label>
              <input className="input" type="time" disabled={form.diaTodo} value={form.horaFim} onChange={(e) => set("horaFim", e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={form.diaTodo} onChange={(e) => set("diaTodo", e.target.checked)} />
            <span className="text-sm text-gray-700">Dia todo</span>
          </label>

          {editando && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-green-600" checked={form.concluido} onChange={(e) => set("concluido", e.target.checked)} />
              <span className="text-sm text-gray-700">Feito</span>
            </label>
          )}

          {alvo === "usuario" && form.usuarioId === meuId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-gray-600" checked={form.privado} onChange={(e) => set("privado", e.target.checked)} />
              <span className="text-sm text-gray-700">🔒 Só eu vejo este compromisso</span>
            </label>
          )}

          <div>
            <label className="label">Tipo</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={form.tipo === "COMPROMISSO"} onChange={() => set("tipo", "COMPROMISSO")} />
                <span className="text-sm text-gray-700">Compromisso</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={form.tipo === "REUNIAO"} onChange={() => set("tipo", "REUNIAO")} />
                <span className="text-sm text-gray-700">🗓️ Reunião</span>
              </label>
            </div>
          </div>

          {/* Só é possível trocar setor/usuário na criação */}
          {!editando && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="label">Este compromisso é de:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={alvo === "usuario"} onChange={() => setAlvo("usuario")} />
                  <span className="text-sm text-gray-700">Um colaborador</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={alvo === "setor"} onChange={() => setAlvo("setor")} />
                  <span className="text-sm text-gray-700">Um setor inteiro</span>
                </label>
              </div>

              {alvo === "usuario" ? (
                <select className="select" value={form.usuarioId} onChange={(e) => set("usuarioId", e.target.value)} required>
                  <option value="">Selecione o colaborador...</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              ) : (
                <select className="select" value={form.setorId} onChange={(e) => set("setorId", e.target.value)} required>
                  <option value="">Selecione o setor...</option>
                  {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              )}
            </div>
          )}

          {editando && (
            <p className="text-xs text-gray-400">
              {item?.setor ? `Setor: ${item.setor.nome}` : `Colaborador: ${item?.usuario?.nome}`}
            </p>
          )}

          {erro && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
              <span className="text-xs text-red-700">{erro}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            {editando ? (
              <button type="button" onClick={excluir} disabled={salvando} className="text-sm text-red-500 hover:underline">
                Excluir
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onFechar} className="btn">Cancelar</button>
              <button type="submit" disabled={salvando} className="btn btn-primary">
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
