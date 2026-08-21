import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularVencimento, formatData } from "@/lib/utils";
import { SETOR_RESP_FIELD } from "@/lib/auth";
import {
  enviarEmail,
  emailAlertaObrigacaoHtml,
  emailRelatorioHorasIndividualHtml,
  emailRelatorioHorasComparativoHtml,
  resolverDestinatariosGrupo,
} from "@/lib/mail";

// GET/POST /api/cron/diario — chamado uma vez por dia pelo Vercel Cron.
// Faz duas coisas:
// 1. Todo dia: alerta de obrigação vencendo em 7 dias, e alerta de
//    obrigação que acabou de entrar em atraso.
// 2. Só às segundas-feiras: relatório individual de horas (semana
//    anterior) pra cada operador, e relatório comparativo pra Diretoria e
//    pros supervisores de cada setor.
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
const DIAS_ANTECEDENCIA_VENCIMENTO = 7;

async function alertarObrigacoes() {
  const hoje = new Date();
  const hojeUtc = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));

  const candidatas = await prisma.obrigacaoInstancia.findMany({
    where: {
      status: { notIn: ["CONCLUIDO", "NAO_SE_APLICA"] },
      OR: [{ alertaVencimentoEnviado: false }, { alertaAtrasoEnviado: false }],
    },
    select: {
      id: true,
      competencia: true,
      status: true,
      alertaVencimentoEnviado: true,
      alertaAtrasoEnviado: true,
      obrigacaoEmpresa: {
        select: {
          empresaId: true,
          empresa: {
            select: {
              codigoInterno: true, razaoSocial: true, deletedAt: true, ativo: true,
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

  let enviados = 0;

  for (const inst of candidatas) {
    const empresa = inst.obrigacaoEmpresa.empresa;
    if (!empresa.ativo || empresa.deletedAt) continue;

    const template = inst.obrigacaoEmpresa.template;
    const vencimento = calcularVencimento(inst.competencia, template.diaVencimento, template.vencimentoMesSeguinte);
    if (!vencimento) continue;

    const diasRestantes = Math.round((vencimento.getTime() - hojeUtc.getTime()) / 86_400_000);
    const disparaVencimento = !inst.alertaVencimentoEnviado && diasRestantes === DIAS_ANTECEDENCIA_VENCIMENTO;
    const disparaAtraso = !inst.alertaAtrasoEnviado && inst.status === "EM_ATRASO";
    if (!disparaVencimento && !disparaAtraso) continue;

    // Responsável específico dessa empresa nesse setor + supervisores do
    // setor inteiro (quem oversee o departamento).
    const campoResp = SETOR_RESP_FIELD[template.setor.nome];
    const responsavelId = campoResp ? (empresa as any)[campoResp] : null;

    const destinatarios = await resolverDestinatariosGrupo({
      grupos: ["supervisores"],
      setorId: template.setorId,
    });
    if (responsavelId) {
      const resp = await prisma.usuario.findUnique({ where: { id: responsavelId }, select: { id: true, nome: true, email: true, ativo: true } });
      if (resp?.ativo && !destinatarios.some((d) => d.id === resp.id)) destinatarios.push(resp);
    }
    if (destinatarios.length === 0) continue;

    const html = emailAlertaObrigacaoHtml({
      atrasada: inst.status === "EM_ATRASO",
      nomeObrigacao: template.nome,
      empresa: `${empresa.codigoInterno} - ${empresa.razaoSocial}`,
      setor: template.setor.nome,
      vencimento: formatData(vencimento),
      diasRestantes,
      url: `${BASE_URL}/obrigacoes`,
    });
    const assunto = `${inst.status === "EM_ATRASO" ? "Em atraso" : "Vence em 7 dias"}: ${template.nome} - ${empresa.razaoSocial}`;
    for (const d of destinatarios) {
      await enviarEmail({ para: d.email, assunto, html });
    }

    await prisma.obrigacaoInstancia.update({
      where: { id: inst.id },
      data: {
        alertaVencimentoEnviado: disparaVencimento ? true : inst.alertaVencimentoEnviado,
        alertaAtrasoEnviado: disparaAtraso ? true : inst.alertaAtrasoEnviado,
      },
    });
    enviados++;
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

  const resultado: Record<string, number> = {};
  resultado.alertasObrigacoes = await alertarObrigacoes();

  const hoje = new Date();
  const ehSegunda = hoje.getUTCDay() === 1;
  if (ehSegunda || req.nextUrl.searchParams.get("forcarRelatorios") === "true") {
    const { de, ate, label } = semanaAnterior();
    resultado.relatoriosIndividuais = await relatoriosIndividuais(de, ate, label);
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
