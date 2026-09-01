"use client";

import { useState, useEffect, useRef } from "react";

export function useEmpresa(id: string) {
  const [empresa, setEmpresa] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Só mostra a tela toda de "Carregando empresa..." na primeira vez — os
  // "atualizarGeral"/"atualizarModulo" chamam buscar() de novo depois de
  // salvar, pra recarregar os dados, e sem essa checagem isso sumia com a
  // página inteira por um instante (troca pro spinner, depois volta), o
  // que fazia o navegador perder a posição de rolagem e voltar pro topo
  // toda vez que algo era salvo.
  const primeiraCargaRef = useRef(true);

  async function buscar() {
    if (primeiraCargaRef.current) setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/empresas/${id}`);
      if (!res.ok) throw new Error("Empresa não encontrada");
      setEmpresa(await res.json());
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
      primeiraCargaRef.current = false;
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
