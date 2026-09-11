import { prisma } from "@/lib/prisma";
import { calcularVencimento, formatData } from "@/lib/utils";
import { SETOR_RESP_FIELD } from "@/lib/auth";
import { STATUS_EMPRESA_GERA_OBRIGACAO } from "@/lib/obrigacoes";
import { enviarEmail, emailDigestObrigacoesSetorHtml, emailObrigacoesPendentesOperadorHtml } from "@/lib/mail";

// Lógica compartilhada entre o cron diário e o disparo manual ("Enviar
// agora") — igual ao padrão já usado pros relatórios de horas em
// src/lib/relatorioHorasEmail.ts.

const BASE_URL = process.env.NEXTAUTH_URL || "";

type ItemPendente = {
  empresa: string;
  obrigacao: string;
  vencimento: string;
  diasRestantes: number;
  atrasada: boolean;
  responsavelId: string | null;
  setorId: string;
  setorNome: string;
};

// Uma única busca no banco, reaproveitada pelas duas variantes de e-mail
// abaixo (por setor e por operador) — evita repetir a mesma query pesada.
async function buscarCandidatasPendentes(diasAntecedencia: number): Promise<ItemPendente[]> {
  const hoje = new Date();
  const hojeUtc = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));

  const candidatas = await prisma.obrigacaoInstancia.findMany({
    where: { status: { notIn: ["CONCLUIDO", "NAO_SE_APLICA"] } },
    select: {
      id: true,
      competencia: true,
      status: true,
      obrigacaoEmpresa: {
        select: {
          empresaId: true,
          empresa: {
            select: {
              codigoInterno: true, razaoSocial: true, deletedAt: true, ativo: true, status: true,
              respFiscalId: true, respContabilId: true, respDpId: true, respSocietId: true,
            },
          },
          template: {
            select: { nome: true, diaVencimento: true, vencimentoMesSeguinte: true, setorId: true, setor: { select: { nome: true } } },
          },
        },
      },
    },
  });

  const itens: ItemPendente[] = [];
  for (const inst of candidatas) {
    const empresa = inst.obrigacaoEmpresa.empresa;
    if (!empresa.ativo || empresa.deletedAt) continue;
    if (!STATUS_EMPRESA_GERA_OBRIGACAO.includes(empresa.status)) continue;

    const template = inst.obrigacaoEmpresa.template;
    const vencimento = calcularVencimento(inst.competencia, template.diaVencimento, template.vencimentoMesSeguinte);
    if (!vencimento) continue;

    const diasRestantes = Math.round((vencimento.getTime() - hojeUtc.getTime()) / 86_400_000);
    const atrasada = inst.status === "EM_ATRASO";
    const dentroDaJanela = diasRestantes >= 0 && diasRestantes <= diasAntecedencia;
    if (!atrasada && !dentroDaJanela) continue;

    const campoResp = SETOR_RESP_FIELD[template.setor.nome];
    const responsavelId = campoResp ? (empresa as any)[campoResp] : null;

    itens.push({
      empresa: `${empresa.codigoInterno} - ${empresa.razaoSocial}`,
      obrigacao: template.nome,
      vencimento: formatData(vencimento),
      diasRestantes,
      atrasada,
      responsavelId,
      setorId: template.setorId,
      setorNome: template.setor.nome,
    });
  }
  return itens;
}

// Digest diário: pra cada setor, lista todas as obrigações em atraso ou
// vencendo dentro de `diasAntecedencia` dias, numa listagem só, e manda
// num ÚNICO e-mail (vários destinatários, não um e-mail por pessoa) pros
// responsáveis das empresas pendentes + supervisores do setor.
export async function digestObrigacoesPorSetor(diasAntecedencia: number) {
  const itensGerais = await buscarCandidatasPendentes(diasAntecedencia);

  const porSetor = new Map<string, { setorNome: string; itens: ItemPendente[] }>();
  for (const item of itensGerais) {
    if (!porSetor.has(item.setorId)) porSetor.set(item.setorId, { setorNome: item.setorNome, itens: [] });
    porSetor.get(item.setorId)!.itens.push(item);
  }

  let enviados = 0;
  for (const [setorId, { setorNome, itens }] of porSetor) {
    if (itens.length === 0) continue;

    const respIds = Array.from(new Set(itens.map((i) => i.responsavelId).filter(Boolean))) as string[];
    const responsaveis = respIds.length > 0
      ? await prisma.usuario.findMany({ where: { id: { in: respIds }, ativo: true }, select: { id: true, nome: true, email: true } })
      : [];
    const nomePorId = new Map(responsaveis.map((r) => [r.id, r.nome]));
    const itensComNome = itens.map((i) => ({ ...i, responsavel: i.responsavelId ? nomePorId.get(i.responsavelId) ?? null : null }));

    const supervisores = await prisma.usuarioSetor.findMany({
      where: { setorId, papel: "supervisor", usuario: { ativo: true } },
      select: { usuario: { select: { id: true, nome: true, email: true } } },
    });

    // Responsáveis das empresas pendentes + supervisores do setor, sem
    // duplicar quem for as duas coisas ao mesmo tempo — e tudo num único
    // e-mail (vários destinatários), não um e-mail por pessoa.
    const destinatariosMap = new Map<string, { id: string; nome: string; email: string }>();
    for (const r of responsaveis) destinatariosMap.set(r.id, r);
    for (const s of supervisores) destinatariosMap.set(s.usuario.id, s.usuario);
    const destinatarios = Array.from(destinatariosMap.values());
    if (destinatarios.length === 0) continue;

    const html = emailDigestObrigacoesSetorHtml({
      setor: setorNome,
      itens: itensComNome,
      url: `${BASE_URL}/obrigacoes`,
    });
    const atrasadasCount = itens.filter((i) => i.atrasada).length;
    const assunto = `${itens.length} obrigação(ões) pendente(s) - ${setorNome}${atrasadasCount > 0 ? ` (${atrasadasCount} em atraso)` : ""}`;
    await enviarEmail({ para: destinatarios.map((d) => d.email), assunto, html });
    enviados++;
  }

  return enviados;
}

// Versão personalizada: um e-mail SEPARADO por operador, só com as
// obrigações que são responsabilidade dele (de qualquer setor) — nada de
// um colaborador ver a pendência do outro.
export async function obrigacoesPendentesPorOperador(diasAntecedencia: number) {
  const itensGerais = await buscarCandidatasPendentes(diasAntecedencia);

  const porOperador = new Map<string, ItemPendente[]>();
  for (const item of itensGerais) {
    if (!item.responsavelId) continue;
    if (!porOperador.has(item.responsavelId)) porOperador.set(item.responsavelId, []);
    porOperador.get(item.responsavelId)!.push(item);
  }
  if (porOperador.size === 0) return 0;

  const operadores = await prisma.usuario.findMany({
    where: { id: { in: Array.from(porOperador.keys()) }, ativo: true },
    select: { id: true, nome: true, email: true },
  });

  let enviados = 0;
  for (const op of operadores) {
    const itens = porOperador.get(op.id) ?? [];
    if (itens.length === 0) continue;

    const html = emailObrigacoesPendentesOperadorHtml({
      nome: op.nome,
      itens: itens.map((i) => ({
        empresa: i.empresa, obrigacao: i.obrigacao, setor: i.setorNome,
        vencimento: i.vencimento, diasRestantes: i.diasRestantes, atrasada: i.atrasada,
      })),
      url: `${BASE_URL}/obrigacoes`,
    });
    const atrasadasCount = itens.filter((i) => i.atrasada).length;
    const assunto = `${itens.length} obrigação(ões) pendente(s) com você${atrasadasCount > 0 ? ` (${atrasadasCount} em atraso)` : ""}`;
    await enviarEmail({ para: op.email, assunto, html });
    enviados++;
  }

  return enviados;
}

// Wrapper usado tanto pelo cron diário quanto pelo disparo manual — roda
// as duas variantes (setor + individual) de uma vez.
export async function enviarObrigacoesPendentes(diasAntecedencia: number) {
  const [porSetor, porOperador] = await Promise.all([
    digestObrigacoesPorSetor(diasAntecedencia),
    obrigacoesPendentesPorOperador(diasAntecedencia),
  ]);
  return { porSetor, porOperador };
}
