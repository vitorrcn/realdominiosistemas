import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularVencimento, formatData } from "@/lib/utils";
import { SETOR_RESP_FIELD } from "@/lib/auth";
import { STATUS_EMPRESA_GERA_OBRIGACAO } from "@/lib/obrigacoes";
import {
  enviarEmail,
  emailDigestObrigacoesSetorHtml,
  emailAlertaCarteiraSemResponsavelHtml,
  emailRelatorioHorasIndividualHtml,
  emailRelatorioHorasComparativoHtml,
} from "@/lib/mail";

// GET/POST /api/cron/diario — chamado uma vez por dia pelo Vercel Cron.
// Faz, cada um sujeito ao seu próprio "ativo" em Configurações > Automações:
// 1. Todo dia: digest de obrigações pendentes (em atraso + vencendo dentro
//    da janela configurada) num único e-mail por setor pros responsáveis
//    das empresas pendentes + supervisores do setor, e alerta de empresa
//    ativa sem responsável pros supervisores de cada setor.
// 2. No dia da semana configurado (por padrão, segunda): relatório
//    individual de horas (semana anterior) pra cada operador, e relatório
//    comparativo pra Diretoria e pros supervisores de cada setor.
//
// O Vercel manda automaticamente "Authorization: Bearer $CRON_SECRET"
// quando a env var se chama exatamente CRON_SECRET - por isso o endpoint
// aceita esse header. Também aceita x-cron-secret, pra chamada manual
// (teste local, curl).
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

const BASE_URL = process.env.NEXTAUTH_URL || "";

const CONFIG_PADRAO = {
  diasAntecedenciaVencimento: 7,
  alertaObrigacoesAtivo: true,
  alertaCarteiraSemRespAtivo: true,
  relatorioIndividualAtivo: true,
  relatorioIndividualDiaSemana: 1,
  relatorioComparativoAtivo: true,
  relatorioComparativoDiaSemana: 1,
};

async function buscarConfig() {
  const config = await prisma.configuracaoAutomacao.findUnique({ where: { id: "config" } });
  return config ?? CONFIG_PADRAO;
}

// Digest diário: pra cada setor, lista todas as obrigações em atraso ou
// vencendo dentro de `diasAntecedencia` dias, numa listagem só, e manda
// num ÚNICO e-mail (vários destinatários, não um e-mail por pessoa) pros
// responsáveis das empresas pendentes + supervisores do setor.
async function digestObrigacoesPorSetor(diasAntecedencia: number) {
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

  type Item = { empresa: string; obrigacao: string; vencimento: string; diasRestantes: number; atrasada: boolean; responsavelId: string | null };
  const porSetor = new Map<string, { setorNome: string; itens: Item[] }>();

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

    if (!porSetor.has(template.setorId)) porSetor.set(template.setorId, { setorNome: template.setor.nome, itens: [] });
    porSetor.get(template.setorId)!.itens.push({
      empresa: `${empresa.codigoInterno} - ${empresa.razaoSocial}`,
      obrigacao: template.nome,
      vencimento: formatData(vencimento),
      diasRestantes,
      atrasada,
      responsavelId,
    });
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

// Alerta pros supervisores de cada setor: empresa ativa sem ninguém
// atribuído como responsável naquele setor (buraco na carteira).
async function alertarCarteiraSemResponsavel() {
  const setores = await prisma.setor.findMany({ where: { ativo: true }, select: { id: true, nome: true } });

  let enviados = 0;
  for (const setor of setores) {
    const campo = SETOR_RESP_FIELD[setor.nome];
    if (!campo) continue; // setor sem campo de responsável correspondente na Empresa

    const empresasSemResp = await prisma.empresa.findMany({
      where: {
        ativo: true,
        deletedAt: null,
        status: { in: STATUS_EMPRESA_GERA_OBRIGACAO },
        [campo]: null,
      },
      select: { codigoInterno: true, razaoSocial: true },
      orderBy: { codigoInterno: "asc" },
    });
    if (empresasSemResp.length === 0) continue;

    const supervisores = await prisma.usuarioSetor.findMany({
      where: { setorId: setor.id, papel: "supervisor", usuario: { ativo: true } },
      select: { usuario: { select: { id: true, nome: true, email: true } } },
    });
    if (supervisores.length === 0) continue;

    const html = emailAlertaCarteiraSemResponsavelHtml({
      setor: setor.nome,
      empresas: empresasSemResp.map((e) => ({ codigo: e.codigoInterno, razaoSocial: e.razaoSocial })),
      url: `${BASE_URL}/empresas`,
    });
    const assunto = `${empresasSemResp.length} empresa(s) sem responsável - ${setor.nome}`;
    for (const s of supervisores) {
      await enviarEmail({ para: s.usuario.email, assunto, html });
      enviados++;
    }
  }

  return enviados;
}

// Segunda-feira anterior (ou hoje, se hoje já for segunda) e o domingo
// seguinte a ela — usado como intervalo "semana passada" pros relatórios.
function semanaAnterior(): { de: Date; ate: Date; label: string } {
  const hoje = new Date();
  const hojeUtc = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  const diaSemana = hojeUtc.getUTCDay(); // 0=domingo, 1=segunda...
  const diasDesdeSegundaAtual = diaSemana === 0 ? 6 : diaSemana - 1;
  const segundaAtual = new Date(hojeUtc);
  segundaAtual.setUTCDate(segundaAtual.getUTCDate() - diasDesdeSegundaAtual);
  const segundaAnterior = new Date(segundaAtual);
  segundaAnterior.setUTCDate(segundaAnterior.getUTCDate() - 7);
  const domingoAnterior = new Date(segundaAtual);
  domingoAnterior.setUTCDate(domingoAnterior.getUTCDate() - 1);
  return {
    de: segundaAnterior,
    ate: domingoAnterior,
    label: `${formatData(segundaAnterior)} a ${formatData(domingoAnterior)}`,
  };
}

function formatarHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

async function buscarRegistrosSemana(de: Date, ate: Date) {
  return prisma.registroAtividade.findMany({
    where: { data: { gte: de, lte: ate } },
    select: {
      usuarioId: true,
      quantidade: true,
      horaInicio: true,
      horaFim: true,
      usuario: { select: { id: true, nome: true } },
      atividade: { select: { nome: true, unidadeQuantidade: true } },
    },
  });
}

async function relatoriosIndividuais(de: Date, ate: Date, label: string) {
  const registros = await buscarRegistrosSemana(de, ate);
  if (registros.length === 0) return 0;

  const porUsuario = new Map<string, { nome: string; totalMin: number; qtd: number; porAtividade: Map<string, { totalMin: number; totalQtd: number | null; unidade: string | null }> }>();
  for (const r of registros) {
    if (!porUsuario.has(r.usuarioId)) {
      porUsuario.set(r.usuarioId, { nome: r.usuario.nome, totalMin: 0, qtd: 0, porAtividade: new Map() });
    }
    const u = porUsuario.get(r.usuarioId)!;
    const min = (r.horaFim.getTime() - r.horaInicio.getTime()) / 60000;
    u.totalMin += min;
    u.qtd += 1;

    if (!u.porAtividade.has(r.atividade.nome)) {
      u.porAtividade.set(r.atividade.nome, { totalMin: 0, totalQtd: r.quantidade != null ? 0 : null, unidade: r.atividade.unidadeQuantidade });
    }
    const a = u.porAtividade.get(r.atividade.nome)!;
    a.totalMin += min;
    if (r.quantidade != null) a.totalQtd = (a.totalQtd ?? 0) + r.quantidade;
  }

  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: Array.from(porUsuario.keys()) }, ativo: true },
    select: { id: true, email: true },
  });

  let enviados = 0;
  for (const u of usuarios) {
    const dados = porUsuario.get(u.id)!;
    const html = emailRelatorioHorasIndividualHtml({
      nome: dados.nome,
      periodo: label,
      totalHoras: formatarHoras(dados.totalMin),
      qtdRegistros: dados.qtd,
      porAtividade: Array.from(dados.porAtividade.entries()).map(([nome, a]) => ({
        nome, totalHoras: formatarHoras(a.totalMin), totalQuantidade: a.totalQtd, unidade: a.unidade,
      })),
      url: `${BASE_URL}/registro-horas`,
    });
    await enviarEmail({ para: u.email, assunto: `Suas horas - semana de ${label}`, html });
    enviados++;
  }
  return enviados;
}

async function relatorioComparativo(de: Date, ate: Date, label: string) {
  const registros = await buscarRegistrosSemana(de, ate);
  if (registros.length === 0) return 0;

  const minPorUsuario = new Map<string, { nome: string; totalMin: number }>();
  for (const r of registros) {
    if (!minPorUsuario.has(r.usuarioId)) minPorUsuario.set(r.usuarioId, { nome: r.usuario.nome, totalMin: 0 });
    minPorUsuario.get(r.usuarioId)!.totalMin += (r.horaFim.getTime() - r.horaInicio.getTime()) / 60000;
  }

  function montarLista(usuarioIds?: string[]) {
    const entradas = Array.from(minPorUsuario.entries()).filter(([id]) => !usuarioIds || usuarioIds.includes(id));
    return entradas
      .map(([, v]) => ({ nome: v.nome, totalHoras: (v.totalMin / 60).toFixed(1) }))
      .sort((a, b) => parseFloat(b.totalHoras) - parseFloat(a.totalHoras));
  }

  let enviados = 0;

  const diretores = await prisma.usuario.findMany({ where: { perfilGlobal: "DIRETORIA", ativo: true }, select: { id: true, email: true } });
  const htmlDiretoria = emailRelatorioHorasComparativoHtml({
    escopo: "Comparativo de todos os operadores.",
    periodo: label,
    porOperador: montarLista(),
    url: `${BASE_URL}/registro-horas/relatorios`,
  });
  for (const d of diretores) {
    await enviarEmail({ para: d.email, assunto: `Comparativo de horas da equipe - semana de ${label}`, html: htmlDiretoria });
    enviados++;
  }

  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  for (const setor of setores) {
    const supervisores = await prisma.usuarioSetor.findMany({
      where: { setorId: setor.id, papel: "supervisor", usuario: { ativo: true } },
      select: { usuario: { select: { id: true, nome: true, email: true } } },
    });
    if (supervisores.length === 0) continue;

    const membrosDoSetor = await prisma.usuarioSetor.findMany({
      where: { setorId: setor.id },
      select: { usuarioId: true },
    });
    const idsEquipe = membrosDoSetor.map((m) => m.usuarioId);
    const listaEquipe = montarLista(idsEquipe);
    if (listaEquipe.length === 0) continue;

    const html = emailRelatorioHorasComparativoHtml({
      escopo: `Comparativo dos operadores do setor ${setor.nome}.`,
      periodo: label,
      porOperador: listaEquipe,
      url: `${BASE_URL}/registro-horas/relatorios`,
    });
    for (const s of supervisores) {
      await enviarEmail({ para: s.usuario.email, assunto: `Comparativo de horas - ${setor.nome} - semana de ${label}`, html });
      enviados++;
    }
  }

  return enviados;
}

async function handler(req: NextRequest) {
  if (!autorizado(req))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const config = await buscarConfig();
  const resultado: Record<string, number> = {};

  if (config.alertaObrigacoesAtivo) {
    resultado.digestObrigacoes = await digestObrigacoesPorSetor(config.diasAntecedenciaVencimento);
  }
  if (config.alertaCarteiraSemRespAtivo) {
    resultado.alertaCarteiraSemResp = await alertarCarteiraSemResponsavel();
  }

  const hoje = new Date();
  const diaSemana = hoje.getUTCDay();
  const forcar = req.nextUrl.searchParams.get("forcarRelatorios") === "true";

  if (config.relatorioIndividualAtivo && (diaSemana === config.relatorioIndividualDiaSemana || forcar)) {
    const { de, ate, label } = semanaAnterior();
    resultado.relatoriosIndividuais = await relatoriosIndividuais(de, ate, label);
  }
  if (config.relatorioComparativoAtivo && (diaSemana === config.relatorioComparativoDiaSemana || forcar)) {
    const { de, ate, label } = semanaAnterior();
    resultado.relatorioComparativo = await relatorioComparativo(de, ate, label);
  }

  return NextResponse.json({ ok: true, ...resultado });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
