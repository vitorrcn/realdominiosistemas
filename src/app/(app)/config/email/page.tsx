"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ConfigEmailPage() {
  const [gmailUser, setGmailUser] = useState("");
  const [gmailSenha, setGmailSenha] = useState("");
  const [configurado, setConfigurado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    fetch("/api/config/email")
      .then((r) => r.json())
      .then((json) => {
        setGmailUser(json.gmailUser ?? "");
        setConfigurado(json.configurado);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    const res = await fetch("/api/config/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmailUser, gmailSenha: gmailSenha || undefined }),
    });
    setSalvando(false);
    if (res.ok) {
      setMsg({ tipo: "ok", texto: "Salvo com sucesso!" });
      setConfigurado(true);
      setGmailSenha("");
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg({ tipo: "erro", texto: json.error ?? "Erro ao salvar." });
    }
  }

  async function testar() {
    setTestando(true);
    setMsg(null);
    const res = await fetch("/api/config/email/testar", { method: "POST" });
    setTestando(false);
    if (res.ok) {
      setMsg({ tipo: "ok", texto: "E-mail de teste enviado! Confere sua caixa de entrada." });
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg({ tipo: "erro", texto: json.detalhe ? `${json.error} (${json.detalhe})` : json.error });
    }
  }

  if (carregando) return <div className="text-center py-12 text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/config" className="hover:text-gray-900">Configurações</Link>
        <span>/</span>
        <span className="text-gray-900">E-mail</span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">Configuração de e-mail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Essa conta é quem dispara os avisos automáticos (novas tarefas, eventos, etc.) — pra
          quem for o responsável, os Líderes do setor e os Coordenadores.
          {configurado && <span className="text-green-600 font-medium"> Já está configurado.</span>}
        </p>
      </div>

      <form onSubmit={salvar} className="card space-y-4">
        <div>
          <label className="label">E-mail do Gmail / Google Workspace</label>
          <input className="input" type="email" placeholder="contato@realdominio.com.br"
            value={gmailUser} onChange={(e) => setGmailUser(e.target.value)} required />
        </div>
        <div>
          <label className="label">Senha de app</label>
          <input className="input" type="password" placeholder={configurado ? "•••••••••••••••• (preenchida — só digite pra trocar)" : "16 caracteres, sem espaço"}
            value={gmailSenha} onChange={(e) => setGmailSenha(e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">
            Gera em{" "}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
              myaccount.google.com/apppasswords
            </a>
            {" "}(precisa ter verificação em duas etapas ativada na conta). Fica salva de forma criptografada.
          </p>
        </div>

        {msg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${msg.tipo === "ok" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <span className={`text-sm ${msg.tipo === "ok" ? "text-green-700" : "text-red-700"}`}>{msg.texto}</span>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          {configurado && (
            <button type="button" onClick={testar} disabled={testando} className="btn">
              {testando ? "Enviando..." : "Testar envio"}
            </button>
          )}
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
