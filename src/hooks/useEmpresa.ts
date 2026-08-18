"use client";

import { useState, useEffect } from "react";

export function useEmpresa(id: string) {
  const [empresa, setEmpresa] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/empresas/${id}`);
      if (!res.ok) throw new Error("Empresa não encontrada");
      setEmpresa(await res.json());
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { if (id) buscar(); }, [id]);

  async function atualizarModulo(modulo: string, dados: Record<string, any>) {
    const res = await fetch(`/api/empresas/${id}/modulos?modulo=${modulo}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    if (res.ok) {
      await buscar();
      return { ok: true as const };
    }
    let erro = "Erro ao salvar. Tente novamente.";
    try {
      const json = await res.json();
      erro = json.detalhe || json.error || erro;
    } catch {}
    return { ok: false as const, erro };
  }

  async function atualizarGeral(dados: Record<string, any>) {
    const res = await fetch(`/api/empresas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      await buscar();
      return { ok: true as const, avisos: (json.avisos as string[]) ?? [] };
    }
    let erro = "Erro ao salvar. Tente novamente.";
    try {
      const json = await res.json();
      erro = json.detalhe || json.error || erro;
    } catch {}
    return { ok: false as const, erro };
  }

  return { empresa, carregando, erro, buscar, atualizarModulo, atualizarGeral };
}
