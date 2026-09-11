import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatData } from "@/lib/utils";
import { SETOR_RESP_FIELD } from "@/lib/auth";
import { STATUS_EMPRESA_GERA_OBRIGACAO } from "@/lib/obrigacoes";
import { enviarEmail, emailAlertaCarteiraSemResponsavelHtml } from "@/lib/mail";
import { relatoriosIndividuais, relatorioComparativo } from "@/lib/relatorioHorasEmail";
import { digestObrigacoesPorSetor, obrigacoesPendentesPorOperador } from "@/lib/obrigacoesPendentesEmail";

// GET/POST /api/cron/diario — chamado uma vez por dia pelo Vercel Cron.
// Se "pausadoGeral" estiver ligado em Configurações > Automações, não
// manda e-mail nenhum (não olha os "ativo" individuais abaixo). Senão,
// faz, cada um sujeito ao seu próprio "ativo":
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
  pausadoGeral: false,
  diasAntecedenciaVencimento: 7,
  alertaObrigacoesAtivo: true,
  alertaObrigacoesIndividualAtivo: true,
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

async function handler(req: NextRequest) {
  if (!autorizado(req))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const config = await buscarConfig();

  if (config.pausadoGeral) {
    return NextResponse.json({ ok: true, pausado: true, mensagem: "E-mails automáticos pausados em Configurações > Automações." });
  }

  const resultado: Record<string, number> = {};

  if (config.alertaObrigacoesAtivo) {
    resultado.digestObrigacoes = await digestObrigacoesPorSetor(config.diasAntecedenciaVencimento);
  }
  if ((config as any).alertaObrigacoesIndividualAtivo ?? true) {
    resultado.obrigacoesPorOperador = await obrigacoesPendentesPorOperador(config.diasAntecedenciaVencimento);
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
