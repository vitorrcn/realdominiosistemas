import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const NAO_INFORMADO = "Não informado";

// GET /api/relatorios/socios?municipio=X&bairro=Y
// Estatísticas de entrada/saída de clientes por ano, cidade e bairro.
// Restrito à Diretoria. Nunca falha por causa de cadastro incompleto —
// qualquer campo vazio (município, bairro, datas) só cai em "Não informado"
// ou é ignorado, nunca quebra a consulta.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const user = session.user as any;
    if (user.perfilGlobal !== "DIRETORIA")
      return NextResponse.json({ error: "Restrito à Diretoria" }, { status: 403 });

    const municipioFiltro = req.nextUrl.searchParams.get("municipio") || undefined;
    const bairroFiltro = req.nextUrl.searchParams.get("bairro") || undefined;

    // Busca TODAS as empresas não excluídas — inclusive as com cadastro
    // incompleto, pois elas ainda podem ter data de entrada preenchida.
    const todasEmpresas = await prisma.empresa.findMany({
      where: { deletedAt: null },
      select: {
        dataEntrada: true,
        dataSaida: true,
        bairro: true,
        municipio: true,
        status: true,
        empresaBaixada: true,
      },
    });

    // Listas para os selects de filtro (município/bairro), sempre a partir
    // do total — não dos já filtrados, pra pessoa poder trocar de filtro livremente.
    const municipios = Array.from(
      new Set(todasEmpresas.map((e) => (e.municipio?.trim() || null)).filter((v): v is string => !!v))
    ).sort();
    const bairros = Array.from(
      new Set(todasEmpresas.map((e) => (e.bairro?.trim() || null)).filter((v): v is string => !!v))
    ).sort();

    // Aplica os filtros escolhidos (se houver)
    const empresas = todasEmpresas.filter((e) => {
      if (municipioFiltro && (e.municipio?.trim() || "") !== municipioFiltro) return false;
      if (bairroFiltro && (e.bairro?.trim() || "") !== bairroFiltro) return false;
      return true;
    });

    const anoDataValida = (d: unknown): number | null => {
      if (!d) return null;
      const data = new Date(d as string);
      if (isNaN(data.getTime())) return null;
      const ano = data.getUTCFullYear();
      // Sanidade básica — evita ano 1 ou 9999 de alguma data mal digitada quebrar o gráfico
      if (ano < 1990 || ano > 2100) return null;
      return ano;
    };

    const entradasPorAno = new Map<number, number>();
    const saidasPorAno = new Map<number, number>();
    const bairrosEntradaPorAno = new Map<number, Map<string, number>>();
    const bairrosSaidaPorAno = new Map<number, Map<string, number>>();

    for (const e of empresas) {
      const bairroChave = e.bairro?.trim() || NAO_INFORMADO;

      const anoEntrada = anoDataValida(e.dataEntrada);
      if (anoEntrada !== null) {
        entradasPorAno.set(anoEntrada, (entradasPorAno.get(anoEntrada) ?? 0) + 1);
        if (!bairrosEntradaPorAno.has(anoEntrada)) bairrosEntradaPorAno.set(anoEntrada, new Map());
        const mapa = bairrosEntradaPorAno.get(anoEntrada)!;
        mapa.set(bairroChave, (mapa.get(bairroChave) ?? 0) + 1);
      }

      const anoSaida = anoDataValida(e.dataSaida);
      if (anoSaida !== null) {
        saidasPorAno.set(anoSaida, (saidasPorAno.get(anoSaida) ?? 0) + 1);
        if (!bairrosSaidaPorAno.has(anoSaida)) bairrosSaidaPorAno.set(anoSaida, new Map());
        const mapa = bairrosSaidaPorAno.get(anoSaida)!;
        mapa.set(bairroChave, (mapa.get(bairroChave) ?? 0) + 1);
      }
    }

    // "Baixada" é independente de data de saída — uma empresa pode ter saído
    // do escritório por outro motivo sem ter sido baixada, ou vice-versa.
    // Por isso é só um total geral, não uma contagem por ano.
    const totalBaixadas = empresas.filter((e) => e.empresaBaixada).length;

    // Linha do tempo contínua (sem "buracos" de anos sem movimento) +
    // total acumulado de clientes ativos até o fim de cada ano.
    const todosAnos = [...entradasPorAno.keys(), ...saidasPorAno.keys()];
    const anoMin = todosAnos.length ? Math.min(...todosAnos) : new Date().getFullYear();
    const anoMax = todosAnos.length ? Math.max(...todosAnos) : new Date().getFullYear();

    const linhaDoTempo: { ano: number; entradas: number; saidas: number; totalAcumulado: number }[] = [];
    let acumulado = 0;
    for (let ano = anoMin; ano <= anoMax; ano++) {
      const entradas = entradasPorAno.get(ano) ?? 0;
      const saidas = saidasPorAno.get(ano) ?? 0;
      acumulado += entradas - saidas;
      linhaDoTempo.push({ ano, entradas, saidas, totalAcumulado: Math.max(0, acumulado) });
    }

    const paraArrayBairros = (m: Map<number, Map<string, number>>) => {
      const obj: Record<number, { bairro: string; quantidade: number }[]> = {};
      for (const [ano, mapaBairro] of m.entries()) {
        obj[ano] = Array.from(mapaBairro.entries())
          .map(([bairro, quantidade]) => ({ bairro, quantidade }))
          .sort((a, b) => b.quantidade - a.quantidade);
      }
      return obj;
    };

    const semCadastroCompleto = todasEmpresas.filter((e) => e.status === "CADASTRO_INCOMPLETO").length;

    return NextResponse.json({
      linhaDoTempo,
      bairrosEntradaPorAno: paraArrayBairros(bairrosEntradaPorAno),
      bairrosSaidaPorAno: paraArrayBairros(bairrosSaidaPorAno),
      filtrosDisponiveis: { municipios, bairros },
      totalGeralEmpresas: todasEmpresas.length,
      semDataPreenchida: todasEmpresas.filter((e) => !e.dataEntrada).length,
      semCadastroCompleto,
      totalBaixadas,
    });
  } catch (e: any) {
    console.error("Erro ao gerar dashboard de sócios:", e);
    return NextResponse.json(
      { error: "Erro ao carregar estatísticas.", detalhe: e?.message },
      { status: 500 }
    );
  }
}
