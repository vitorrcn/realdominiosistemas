import { prisma } from "@/lib/prisma";
import { competenciaAtual, calcularVencimento } from "@/lib/utils";
import { StatusEmpresa, Prisma } from "@prisma/client";

// Status de empresa considerados "ativos" para fins de geracao de
// obrigacoes mensais. CADASTRO_INCOMPLETO fica de fora de proposito: sao
// clientes que ainda nao terminaram o cadastro (muitos vindos de importacao
// em massa), entao nao faz sentido gerar pendencia mensal pra eles ainda.
// INATIVA/ENCERRADA/EX_CLIENTE tambem ficam de fora: uma vez que o cliente
// sai, as obrigacoes que ele ja tinha continuam guardadas no historico, mas
// nenhuma nova e gerada.
export const STATUS_EMPRESA_GERA_OBRIGACAO: StatusEmpresa[] = ["ATIVA", "EM_ATENCAO", "IMPLANTACAO"];

/**
 * Condição (pra usar dentro de um `where.empresa`) que decide se as
 * obrigações de uma empresa devem aparecer no quadro de uma determinada
 * competência.
 *
 * - Empresa em status "ativo" (ver STATUS_EMPRESA_GERA_OBRIGACAO acima):
 *   sempre aparece.
 * - Empresa que já saiu (Ex-cliente/Inativa/Encerrada) mas SEM data de
 *   saída registrada: continua aparecendo — sem saber quando ela saiu,
 *   é mais seguro não esconder nada.
 * - Empresa que já saiu COM data de saída: só aparece nas competências
 *   até o mês em que ela ainda estava ativa (o histórico fica intacto),
 *   e some do quadro dali em diante — é exatamente o caso que motivou
 *   isso: uma empresa que saiu em 2011 tinha uma obrigação "perdida"
 *   ainda pendente em 2026 porque nada filtrava por isso.
 */
export function empresaVisivelNaCompetenciaWhere(competencia: string): Prisma.EmpresaWhereInput {
  const [ano, mes] = competencia.split("-").map(Number);
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  return {
    OR: [
      { status: { in: STATUS_EMPRESA_GERA_OBRIGACAO } },
      { dataSaida: null },
      { dataSaida: { gte: inicioMes } },
    ],
  };
}

/**
 * Garante que exista uma ObrigacaoInstancia para a competencia atual de um
 * vinculo empresa-obrigacao (ObrigacaoEmpresa) recem-criado/ativado.
 *
 * Sem isso, vincular uma empresa a uma obrigacao so cria o vinculo - a
 * pendencia do mes so apareceria depois de alguem (Diretoria) clicar em
 * "Gerar competencia do mes". Chamando isso logo apos vincular, a
 * obrigacao ja aparece na tela de Obrigacoes na hora - mas so se a empresa
 * estiver num status "ativo" (ver STATUS_EMPRESA_GERA_OBRIGACAO acima).
 */
export async function garantirInstanciaCompetenciaAtual(obrigacaoEmpresaId: string) {
  const vinculo = await prisma.obrigacaoEmpresa.findUnique({
    where: { id: obrigacaoEmpresaId },
    select: { empresa: { select: { ativo: true, deletedAt: true, status: true } } },
  });
  if (!vinculo) return;
  if (!vinculo.empresa.ativo || vinculo.empresa.deletedAt) return;
  if (!STATUS_EMPRESA_GERA_OBRIGACAO.includes(vinculo.empresa.status)) return;

  const competencia = competenciaAtual();

  await prisma.obrigacaoInstancia.upsert({
    where: {
      obrigacaoEmpresaId_competencia: { obrigacaoEmpresaId, competencia },
    },
    update: {},
    create: {
      obrigacaoEmpresaId,
      competencia,
      status: "NAO_INICIADO",
    },
  });
}

/**
 * Varre as obrigacoes ainda nao concluidas e marca como "EM_ATRASO" as que
 * ja passaram da data de vencimento (calculada a partir do template).
 * Chamada sempre que a tela de Obrigacoes ou o Dashboard sao carregados,
 * pra manter o status em dia sem precisar de um cron separado.
 */
export async function atualizarObrigacoesEmAtraso(): Promise<number> {
  const agora = new Date();
  const hoje = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));

  const candidatas = await prisma.obrigacaoInstancia.findMany({
    where: { status: { notIn: ["CONCLUIDO", "NAO_SE_APLICA", "EM_ATRASO"] } },
    select: {
      id: true,
      competencia: true,
      obrigacaoEmpresa: {
        select: { template: { select: { diaVencimento: true, vencimentoMesSeguinte: true } } },
      },
    },
  });

  const idsAtrasadas: string[] = [];
  for (const c of candidatas) {
    const vencimento = calcularVencimento(
      c.competencia,
      c.obrigacaoEmpresa.template.diaVencimento,
      c.obrigacaoEmpresa.template.vencimentoMesSeguinte
    );
    if (vencimento && vencimento < hoje) idsAtrasadas.push(c.id);
  }

  if (idsAtrasadas.length > 0) {
    await prisma.obrigacaoInstancia.updateMany({
      where: { id: { in: idsAtrasadas } },
      data: { status: "EM_ATRASO" },
    });
  }

  return idsAtrasadas.length;
}
