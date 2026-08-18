import { prisma } from "@/lib/prisma";
import { competenciaAtual } from "@/lib/utils";

/**
 * Garante que exista uma ObrigacaoInstancia para a competência atual de um
 * vínculo empresa-obrigação (ObrigacaoEmpresa) recém-criado/ativado.
 *
 * Sem isso, vincular uma empresa a uma obrigação só cria o vínculo — a
 * pendência do mês só apareceria depois de alguém (Diretoria) clicar em
 * "Gerar competência do mês". Chamando isso logo após vincular, a
 * obrigação já aparece na tela de Obrigações na hora.
 */
export async function garantirInstanciaCompetenciaAtual(obrigacaoEmpresaId: string) {
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
