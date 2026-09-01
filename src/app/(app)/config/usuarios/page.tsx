"use client";

import { useState, useEffect, useRef } from "react";
import { formatData } from "@/lib/utils";

const PERFIS: Record<string, string> = {
  DIRETORIA: "Diretoria",
  LIDER:     "Mordomo(a)",
  OPERADOR:  "Operador",
  CONSULTA:  "Estagiário",
};

const MAX_SUPERVISORES_POR_SETOR = 2;

interface FormUsuario {
  nome: string;
  email: string;
  senha: string;
  perfilGlobal: string;
  podeVerComercial: boolean;
  podeVerRelacoesComerciais: boolean;
  // chave = setorId, valor = "membro" | "supervisor"
  setoresSel: Record<string, string>;
}

const FORM_VAZIO: FormUsuario = {
  nome: "", email: "", senha: "",
  perfilGlobal: "OPERADOR",
  podeVerComercial: false,
  podeVerRelacoesComerciais: false,
  setoresSel: {},
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios]   = useState<any[]>([]);
  const [setores, setSetores]     = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal]         = useState<{ aberto: boolean; usuarioId?: string } | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [salvando, setSalvando]   = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);
  const [form, setForm] = useState<FormUsuario>(FORM_VAZIO);
  const primeiraCargaRef = useRef(true);

  async function carregar() {
    if (primeiraCargaRef.current) setCarregando(true);
    const [u, s] = await Promise.all([
      fetch("/api/usuarios").then((r) => r.json()),
      fetch("/api/setores").then((r) => r.json()),
    ]);
    setUsuarios(Array.isArray(u) ? u : []);
    setSetores(Array.isArray(s) ? s : []);
    setCarregando(false);
    primeiraCargaRef.current = false;
  }

  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    if (!menuAberto) return;
    const fechar = () => setMenuAberto(null);
    document.addEventListener("click", fechar);
    return () => document.removeEventListener("click", fechar);
  }, [menuAberto]);

  // Quantos OUTROS usuários (fora o que está sendo editado) já são
  // supervisores de cada setor — usado pra travar o 3º supervisor.
  function supervisoresAtuais(setorId: string): number {
    return usuarios.filter(
      (u) =>
        u.id !== modal?.usuarioId &&
        (u.setores ?? []).some((s: any) => s.setor.id === setorId && s.papel === "supervisor")
    ).length;
  }

  function abrirCriacao() {
    setForm(FORM_VAZIO);
    setModal({ aberto: true });
  }

  function abrirEdicao(u: any) {
    const setoresSel: Record<string, string> = {};
    for (const s of u.setores ?? []) setoresSel[s.setor.id] = s.papel || "membro";
    setForm({
      nome: u.nome,
      email: u.email,
      senha: "",
      perfilGlobal: u.perfilGlobal,
      podeVerComercial: u.podeVerComercial,
      podeVerRelacoesComerciais: u.podeVerRelacoesComerciais,
      setoresSel,
    });
    setModal({ aberto: true, usuarioId: u.id });
  }

  async function salvarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const editando = !!modal?.usuarioId;

    const payload: any = {
      nome: form.nome,
      email: form.email,
      perfilGlobal: form.perfilGlobal,
      podeVerComercial: form.podeVerComercial,
      podeVerRelacoesComerciais: form.podeVerRelacoesComerciais,
      setores: Object.entries(form.setoresSel).map(([setorId, papel]) => ({ setorId, papel })),
    };
    if (form.senha) payload.senha = form.senha; // só manda senha se foi preenchida

    const res = editando
      ? await fetch(`/api/usuarios/${modal!.usuarioId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        })
      : await fetch("/api/usuarios", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, senha: form.senha }),
        });

    if (res.ok) {
      setModal(null);
      setMsg(editando ? "Usuário atualizado com sucesso!" : "Usuário criado com sucesso!");
      carregar();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "Erro ao salvar usuário.");
    }
    setSalvando(false);
    setTimeout(() => setMsg(null), 4000);
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch(`/api/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !ativo }),
    });
    carregar();
  }

  async function excluirDefinitivamente(u: any) {
    const confirmado = confirm(
      `Excluir "${u.nome}" DE VEZ? Essa ação não pode ser desfeita.\n\n` +
      `Se esse usuário tiver histórico vinculado (empresas, auditoria, agenda), a exclusão vai falhar ` +
      `e você pode usar "Desativar" em vez disso.`
    );
    if (!confirmado) return;

    const res = await fetch(`/api/usuarios/${u.id}?permanente=true`, { method: "DELETE" });
    if (res.ok) {
      setMsg("Usuário excluído definitivamente.");
      carregar();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "Erro ao excluir usuário.");
    }
    setTimeout(() => setMsg(null), 6000);
  }

  function toggleSetor(id: string) {
    setForm((p) => {
      const atual = { ...p.setoresSel };
      if (id in atual) delete atual[id];
      else atual[id] = "membro";
      return { ...p, setoresSel: atual };
    });
  }

  function toggleSupervisor(id: string) {
    setForm((p) => {
      const papelAtual = p.setoresSel[id];
      if (papelAtual !== "supervisor" && supervisoresAtuais(id) >= MAX_SUPERVISORES_POR_SETOR) return p;
      return { ...p, setoresSel: { ...p.setoresSel, [id]: papelAtual === "supervisor" ? "membro" : "supervisor" } };
    });
  }

  const editando = !!modal?.usuarioId;

  return (
    <div className="space-y-5">
      {msg && (
        <div className="fixed bottom-6 right-6 max-w-md px-4 py-3 rounded-xl shadow-lg text-sm font-medium bg-gray-900 text-white z-50">
          {msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{usuarios.length} usuários cadastrados</div>
        <button className="btn btn-primary btn-sm" onClick={abrirCriacao}>
          + Novo usuário
        </button>
      </div>

      <div className="card !p-0">
        <table className="table-auto-fixed">
          <thead>
            <tr>
              <th style={{ width: "16%" }}>Nome</th>
              <th style={{ width: "20%" }}>E-mail</th>
              <th style={{ width: "9%" }}>Perfil</th>
              <th style={{ width: "14%" }}>Setores</th>
              <th style={{ width: "8%" }}>Comercial</th>
              <th style={{ width: "8%" }}>Relações</th>
              <th style={{ width: "7%" }}>Desde</th>
              <th style={{ width: "9%" }}>Status</th>
              <th style={{ width: "9%" }}></th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Carregando...</td></tr>
            ) : usuarios.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-gray-900">{u.nome}</td>
                <td className="text-gray-500 text-xs font-mono">{u.email}</td>
                <td><span className="badge badge-blue">{PERFIS[u.perfilGlobal] ?? u.perfilGlobal}</span></td>
                <td className="text-xs text-gray-500">
                  {u.setores?.length
                    ? u.setores.map((s: any) => `${s.setor.nome}${s.papel === "supervisor" ? " (supervisor)" : ""}`).join(", ")
                    : "—"}
                </td>
                <td>
                  {u.podeVerComercial
                    ? <span className="badge badge-green">Sim</span>
                    : <span className="badge badge-gray">Não</span>}
                </td>
                <td>
                  {u.podeVerRelacoesComerciais
                    ? <span className="badge badge-green">Sim</span>
                    : <span className="badge badge-gray">Não</span>}
                </td>
                <td className="text-xs text-gray-400">{formatData(u.createdAt)}</td>
                <td>
                  {u.ativo
                    ? <span className="badge badge-green">Ativo</span>
                    : <span className="badge badge-gray">Inativo</span>}
                </td>
                <td className="sem-corte relative">
                  <div className="flex justify-end">
                    <button
                      className="btn-icon"
                      onClick={(e) => { e.stopPropagation(); setMenuAberto(menuAberto === u.id ? null : u.id); }}
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                      </svg>
                    </button>
                    {menuAberto === u.id && (
                      <div className="absolute right-0 top-9 z-20 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => { setMenuAberto(null); abrirEdicao(u); }}
                        >
                          Editar
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => { setMenuAberto(null); toggleAtivo(u.id, u.ativo); }}
                        >
                          {u.ativo ? "Desativar" : "Reativar"}
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                          onClick={() => { setMenuAberto(null); excluirDefinitivamente(u); }}
                        >
                          Excluir de vez
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal criar/editar usuário */}
      {modal?.aberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{editando ? "Editar usuário" : "Novo usuário"}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={salvarUsuario} className="p-5 space-y-4">
              <div>
                <label className="label">Nome completo</label>
                <input className="input" required value={form.nome} onChange={(e) => setForm((p) => ({...p,nome:e.target.value}))} />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input className="input" type="email" required value={form.email} onChange={(e) => setForm((p) => ({...p,email:e.target.value}))} />
              </div>
              <div>
                <label className="label">{editando ? "Nova senha (opcional)" : "Senha inicial"}</label>
                <input className="input" type="password" required={!editando} minLength={6}
                  value={form.senha} onChange={(e) => setForm((p) => ({...p,senha:e.target.value}))} />
                <p className="text-xs text-gray-400 mt-1">
                  {editando ? "Deixe em branco para manter a senha atual." : "Mínimo 6 caracteres. O usuário pode alterar depois."}
                </p>
              </div>
              <div>
                <label className="label">Perfil</label>
                <select className="select" value={form.perfilGlobal} onChange={(e) => setForm((p) => ({...p,perfilGlobal:e.target.value}))}>
                  {Object.entries(PERFIS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Setores</label>
                <p className="text-xs text-gray-400 -mt-1 mb-2">
                  Marcar &quot;supervisor&quot; de um setor faz a pessoa enxergar e editar a carteira inteira
                  daquele setor (todas as empresas, não só as dela). No máximo {MAX_SUPERVISORES_POR_SETOR} supervisores por setor.
                </p>
                <div className="space-y-2">
                  {setores.map((s) => {
                    const selecionado = s.id in form.setoresSel;
                    const ehSupervisor = form.setoresSel[s.id] === "supervisor";
                    const outrosSupervisores = supervisoresAtuais(s.id);
                    const limiteAtingido = !ehSupervisor && outrosSupervisores >= MAX_SUPERVISORES_POR_SETOR;
                    return (
                      <div key={s.id} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleSetor(s.id)}
                          className={`badge cursor-pointer ${selecionado ? "bg-brand-100 text-brand-700" : "badge-gray"}`}
                        >
                          {s.nome}
                        </button>
                        {selecionado && (
                          <label
                            className={`flex items-center gap-1.5 text-xs cursor-pointer ${limiteAtingido ? "text-gray-300 cursor-not-allowed" : "text-gray-600"}`}
                            title={limiteAtingido ? `Esse setor já tem ${MAX_SUPERVISORES_POR_SETOR} supervisores` : undefined}
                          >
                            <input
                              type="checkbox"
                              disabled={limiteAtingido}
                              checked={ehSupervisor}
                              onChange={() => toggleSupervisor(s.id)}
                            />
                            supervisor {limiteAtingido && !ehSupervisor && `(${outrosSupervisores}/${MAX_SUPERVISORES_POR_SETOR})`}
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
                  checked={form.podeVerComercial}
                  onChange={(e) => setForm((p) => ({...p,podeVerComercial:e.target.checked}))} />
                <span className="text-sm text-gray-700">Acesso aos dados comerciais</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
                  checked={form.podeVerRelacoesComerciais}
                  onChange={(e) => setForm((p) => ({...p,podeVerRelacoesComerciais:e.target.checked}))} />
                <span className="text-sm text-gray-700">Acesso a Relações Comerciais entre clientes</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn flex-1 justify-center" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" disabled={salvando} className="btn btn-primary flex-1 justify-center">
                  {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
