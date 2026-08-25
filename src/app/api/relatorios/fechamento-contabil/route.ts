import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, setoresQueSupervisiona } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/relatorios/fechamento-contabil
// Situação do fechamento contábil de cada cliente (campo
// Contabil.ultimoFechamento, preenchido na aba Contábil de cada cliente):
// - Cliente ativo (sem dataSaida): precisa ter fechamento até 31/12 do ano
//   ANTERIOR ao atual (ex.: em 2026, até 31/12/2025).
// - Cliente que já saiu (com dataSaida preenchida): precisa ter fechamento
//   pelo menos até o MÊS/ANO em que saiu — não se cobra fechamento depois disso.
// Aberto a qualquer perfil logado, mas escopado igual ao resto do sistema:
// Diretoria e supervisor do Contábil veem a carteira inteira; qualquer
// outra pessoa só vê os clientes onde ela é a responsável pelo Contábil.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const user = session.user as any;
    const vejoTudo =
      user.perfilGlobal === "DIRETORIA" ||
      setoresQueSupervisiona(user.setores ?? []).includes("Contábil");

    const empresas = await prisma.empresa.findMany({
      where: { deletedAt: null, ...(!vejoTudo && { respContabilId: user.id }) },
      select: {
        id: true,
        codigoInterno: true,
        razaoSocial: true,
        status: true,
        dataSaida: true,
        contabil: { select: { ultimoFechamento: true } },
        respContabil: { select: { id: true, nome: true } },
      },
      orderBy: { codigoInterno: "asc" },
    });

    const hoje = new Date();
    const anoAtual = hoje.getUTCFullYear();
    const limiteAtivos = Date.UTC(anoAtual - 1, 11, 31); // 31/12 do ano anterior

    // Compara só ano+mês (o dia não importa pra essa regra)
    const mesAno = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();

    const linhas = empresas.map((e) => {
      const saiu = !!e.dataSaida;
      const ultimoFechamento = e.contabil?.ultimoFechamento ?? null;

      let situacao: "em_dia" | "atrasado" | "sem_data";
      let limiteLabel: string;

      if (saiu) {
        const dataSaida = e.dataSaida as Date;
        limiteLabel = `até ${String(dataSaida.getUTCMonth() + 1).padStart(2, "0")}/${dataSaida.getUTCFullYear()} (mês em que saiu)`;
        if (!ultimoFechamento) situacao = "sem_data";
        else situacao = mesAno(ultimoFechamento) >= mesAno(dataSaida) ? "em_dia" : "atrasado";
      } else {
        limiteLabel = `até 31/12/${anoAtual - 1}`;
        if (!ultimoFechamento) situacao = "sem_data";
        else situacao = ultimoFechamento.getTime() >= limiteAtivos ? "em_dia" : "atrasado";
      }

      return {
        id: e.id,
        codigoInterno: e.codigoInterno,
        razaoSocial: e.razaoSocial,
        status: e.status,
        saiu,
        dataSaida: e.dataSaida,
        ultimoFechamento,
        situacao,
        limiteLabel,
        responsavelId: e.respContabil?.id ?? null,
        responsavelNome: e.respContabil?.nome ?? null,
      };
    });

    const contar = (lista: typeof linhas) => ({
      total: lista.length,
      emDia: lista.filter((l) => l.situacao === "em_dia").length,
      atrasado: lista.filter((l) => l.situacao === "atrasado").length,
      semData: lista.filter((l) => l.situacao === "sem_data").length,
    });

    const resumo = {
      geral: contar(linhas),
      ativos: contar(linhas.filter((l) => !l.saiu)),
      exClientes: contar(linhas.filter((l) => l.saiu)),
    };

    return NextResponse.json({ linhas, resumo, anoAtual, vejoTudo });
  } catch (e: any) {
    console.error("Erro ao gerar relatório de fechamento contábil:", e);
    return NextResponse.json(
      { error: "Erro ao carregar relatório.", detalhe: e?.message },
      { status: 500 }
    );
  }
}
