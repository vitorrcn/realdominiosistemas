import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, setoresQueSupervisiona } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function apenasData(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/registro-horas/relatorio?de=2026-08-01&ate=2026-08-31&usuarioId=&atividadeId=&formato=json|excel
// Diretoria vê todo mundo. Quem é supervisor de algum setor vê só o
// pessoal vinculado ao(s) setor(es) que supervisiona (igual já acontece
// com a carteira de empresas) — liberado a pedido, antes só Diretoria via
// esse relatório. Calcula, pro período informado: total de horas e média
// por operador, e a média de tempo gasto por operador em cada atividade
// (o que motivou o pedido original — comparar quanto tempo cada um gasta
// na mesma tarefa).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const ehDiretoria = user.perfilGlobal === "DIRETORIA";
  const setoresSupervisionados = setoresQueSupervisiona(user.setores ?? []);
  if (!ehDiretoria && setoresSupervisionados.length === 0)
    return NextResponse.json({ error: "Somente a Diretoria e supervisores de setor podem ver relatórios de horas" }, { status: 403 });

  // Supervisor só enxerga o pessoal do(s) setor(es) que supervisiona.
  let idsPermitidos: string[] | null = null;
  if (!ehDiretoria) {
    const vinculos = await prisma.usuarioSetor.findMany({
      where: { setor: { nome: { in: setoresSupervisionados } } },
      select: { usuarioId: true },
      distinct: ["usuarioId"],
    });
    idsPermitidos = vinculos.map((v) => v.usuarioId);
  }

  const { searchParams } = req.nextUrl;
  const [anoMes] = [competenciaAtual()];
  const de = searchParams.get("de") || `${anoMes}-01`;
  const ate = searchParams.get("ate") || new Date().toISOString().slice(0, 10);
  const usuarioId = searchParams.get("usuarioId") || undefined;
  const atividadeId = searchParams.get("atividadeId") || undefined;
  const formato = searchParams.get("formato") || "json";

  if (usuarioId && idsPermitidos && !idsPermitidos.includes(usuarioId))
    return NextResponse.json({ error: "Esse operador não é do(s) setor(es) que você supervisiona" }, { status: 403 });

  const registros = await prisma.registroAtividade.findMany({
    where: {
      data: { gte: apenasData(de), lte: apenasData(ate) },
      ...(usuarioId ? { usuarioId } : idsPermitidos ? { usuarioId: { in: idsPermitidos } } : {}),
      ...(atividadeId && { atividadeId }),
    },
    include: {
      usuario: { select: { id: true, nome: true } },
      atividade: { select: { id: true, nome: true, unidadeQuantidade: true } },
      empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });

  // ── Agregação por operador ────────────────────────────────────────
  const porOperadorMap = new Map<string, {
    usuarioId: string; nome: string; totalMinutos: number; qtdRegistros: number; dias: Set<string>; totalGapMin: number;
  }>();
  // Último horário de término visto, por pessoa+dia — usado abaixo pra
  // calcular o intervalo (tempo parado) até o próximo registro da MESMA
  // pessoa no MESMO dia. `registros` vem ordenado por data+horaInicio
  // globalmente (todo mundo junto), não por pessoa, então não dá pra usar
  // "o item anterior da lista" direto — só rastreando por pessoa+dia.
  const ultimoFimPorPessoaDia = new Map<string, Date>();
  // ── Agregação por operador + atividade ──────────────────────────────
  const porOperadorAtividadeMap = new Map<string, {
    usuarioId: string; nomeUsuario: string; atividadeId: string; nomeAtividade: string; unidadeQuantidade: string | null;
    totalMinutos: number; qtdRegistros: number; totalQuantidade: number | null;
  }>();
  // ── Detalhamento por pessoa e por dia, em ordem cronológica ─────────
  const porPessoaDiaMap = new Map<string, {
    usuarioId: string; nome: string;
    dias: Map<string, { atividade: string; cliente: string | null; horaInicio: string; horaFim: string; duracaoMin: number; quantidade: number | null; unidade: string | null; observacao: string | null; gapAntesMin: number | null }[]>;
  }>();

  for (const r of registros) {
    const minutos = (r.horaFim.getTime() - r.horaInicio.getTime()) / 60000;
    const diaStr = r.data.toISOString().slice(0, 10);

    // Intervalo parado desde o fim do registro anterior dessa mesma
    // pessoa nesse mesmo dia — ignora sobreposição/hora regressiva (não
    // vira "intervalo negativo", só não conta).
    const chavePessoaDia = `${r.usuarioId}::${diaStr}`;
    const ultimoFim = ultimoFimPorPessoaDia.get(chavePessoaDia);
    const gapAntesMin = ultimoFim ? Math.round((r.horaInicio.getTime() - ultimoFim.getTime()) / 60000) : null;
    const gapValido = gapAntesMin != null && gapAntesMin > 0 ? gapAntesMin : null;
    ultimoFimPorPessoaDia.set(chavePessoaDia, r.horaFim);

    if (!porOperadorMap.has(r.usuarioId)) {
      porOperadorMap.set(r.usuarioId, { usuarioId: r.usuarioId, nome: r.usuario.nome, totalMinutos: 0, qtdRegistros: 0, dias: new Set(), totalGapMin: 0 });
    }
    const op = porOperadorMap.get(r.usuarioId)!;
    op.totalMinutos += minutos;
    op.qtdRegistros += 1;
    op.dias.add(diaStr);
    if (gapValido) op.totalGapMin += gapValido;

    const chaveOA = `${r.usuarioId}::${r.atividadeId}`;
    if (!porOperadorAtividadeMap.has(chaveOA)) {
      porOperadorAtividadeMap.set(chaveOA, {
        usuarioId: r.usuarioId, nomeUsuario: r.usuario.nome,
        atividadeId: r.atividadeId, nomeAtividade: r.atividade.nome, unidadeQuantidade: r.atividade.unidadeQuantidade,
        totalMinutos: 0, qtdRegistros: 0, totalQuantidade: r.quantidade != null ? 0 : null,
      });
    }
    const oa = porOperadorAtividadeMap.get(chaveOA)!;
    oa.totalMinutos += minutos;
    oa.qtdRegistros += 1;
    if (r.quantidade != null) oa.totalQuantidade = (oa.totalQuantidade ?? 0) + r.quantidade;

    if (!porPessoaDiaMap.has(r.usuarioId)) {
      porPessoaDiaMap.set(r.usuarioId, { usuarioId: r.usuarioId, nome: r.usuario.nome, dias: new Map() });
    }
    const pessoa = porPessoaDiaMap.get(r.usuarioId)!;
    if (!pessoa.dias.has(diaStr)) pessoa.dias.set(diaStr, []);
    pessoa.dias.get(diaStr)!.push({
      atividade: r.atividade.nome,
      cliente: r.empresa ? `${r.empresa.codigoInterno} — ${r.empresa.razaoSocial}` : null,
      horaInicio: r.horaInicio.toISOString().slice(11, 16),
      horaFim: r.horaFim.toISOString().slice(11, 16),
      duracaoMin: Math.round(minutos),
      quantidade: r.quantidade,
      unidade: r.atividade.unidadeQuantidade,
      observacao: r.observacao,
      gapAntesMin: gapValido,
    });
  }

  const porOperador = Array.from(porOperadorMap.values())
    .map((o) => ({
      usuarioId: o.usuarioId,
      nome: o.nome,
      qtdRegistros: o.qtdRegistros,
      diasComRegistro: o.dias.size,
      totalHoras: Math.round((o.totalMinutos / 60) * 100) / 100,
      mediaHorasPorDia: o.dias.size > 0 ? Math.round((o.totalMinutos / 60 / o.dias.size) * 100) / 100 : 0,
      // Produtividade: soma dos intervalos parados entre uma tarefa e a
      // próxima (mesmo dia). Não inclui o tempo antes do primeiro
      // registro do dia nem depois do último — não dá pra saber quando a
      // pessoa "começou"/"terminou o expediente" só pelos registros.
      tempoParadoMin: Math.round(o.totalGapMin),
      mediaParadoPorDiaMin: o.dias.size > 0 ? Math.round(o.totalGapMin / o.dias.size) : 0,
    }))
    .sort((a, b) => b.totalHoras - a.totalHoras);

  const porOperadorAtividade = Array.from(porOperadorAtividadeMap.values())
    .map((oa) => ({
      usuarioId: oa.usuarioId,
      nomeUsuario: oa.nomeUsuario,
      atividadeId: oa.atividadeId,
      nomeAtividade: oa.nomeAtividade,
      unidadeQuantidade: oa.unidadeQuantidade,
      qtdRegistros: oa.qtdRegistros,
      totalHoras: Math.round((oa.totalMinutos / 60) * 100) / 100,
      mediaMinutosPorRegistro: Math.round(oa.totalMinutos / oa.qtdRegistros),
      totalQuantidade: oa.totalQuantidade,
    }))
    .sort((a, b) => a.nomeUsuario.localeCompare(b.nomeUsuario) || a.nomeAtividade.localeCompare(b.nomeAtividade));

  // ── Comparativo por atividade: mesmos dados de porOperadorAtividade,
  // agrupados por atividade e com os operadores ordenados por total de
  // horas (do maior pro menor) — pra comparar quem gasta mais/menos tempo
  // na mesma tarefa.
  const porAtividadeMap = new Map<string, {
    atividadeId: string; nomeAtividade: string;
    operadores: { usuarioId: string; nome: string; totalHoras: number; qtdRegistros: number; mediaMinutosPorRegistro: number; totalQuantidade: number | null }[];
  }>();
  for (const oa of porOperadorAtividade) {
    if (!porAtividadeMap.has(oa.atividadeId)) {
      porAtividadeMap.set(oa.atividadeId, { atividadeId: oa.atividadeId, nomeAtividade: oa.nomeAtividade, operadores: [] });
    }
    porAtividadeMap.get(oa.atividadeId)!.operadores.push({
      usuarioId: oa.usuarioId, nome: oa.nomeUsuario, totalHoras: oa.totalHoras,
      qtdRegistros: oa.qtdRegistros, mediaMinutosPorRegistro: oa.mediaMinutosPorRegistro, totalQuantidade: oa.totalQuantidade,
    });
  }
  const porAtividade = Array.from(porAtividadeMap.values())
    .map((a) => ({ ...a, operadores: a.operadores.sort((x, y) => y.totalHoras - x.totalHoras) }))
    .sort((a, b) => a.nomeAtividade.localeCompare(b.nomeAtividade));

  // porPessoaDiaMap já foi montado no loop principal acima (junto com
  // porOperadorMap/porOperadorAtividadeMap) — aqui só ordena e soma os
  // intervalos parados por dia/pessoa pra virar a resposta final.
  // `registros` vem ordenado por data e depois por horaInicio (ver a
  // query acima), então os itens de cada dia já chegam em ordem
  // cronológica — nunca reordenar isso aqui.
  const detalhePorPessoa = Array.from(porPessoaDiaMap.values())
    .map((p) => {
      const dias = Array.from(p.dias.entries())
        .map(([data, itens]) => ({
          data,
          itens,
          tempoParadoMin: itens.reduce((s, it) => s + (it.gapAntesMin ?? 0), 0),
        }))
        .sort((a, b) => a.data.localeCompare(b.data));
      return {
        usuarioId: p.usuarioId,
        nome: p.nome,
        tempoParadoMin: dias.reduce((s, d) => s + d.tempoParadoMin, 0),
        dias,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  if (formato === "excel") {
    const wb = XLSX.utils.book_new();

    const abaOperador = porOperador.map((o) => ({
      "Operador": o.nome,
      "Dias com registro": o.diasComRegistro,
      "Qtd. registros": o.qtdRegistros,
      "Total de horas": o.totalHoras,
      "Média de horas/dia": o.mediaHorasPorDia,
      "Tempo parado entre tarefas (min)": o.tempoParadoMin,
      "Média parado/dia (min)": o.mediaParadoPorDiaMin,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(abaOperador), "Por operador");

    const abaOperadorAtividade = porOperadorAtividade.map((oa) => ({
      "Operador": oa.nomeUsuario,
      "Atividade": oa.nomeAtividade,
      "Qtd. registros": oa.qtdRegistros,
      "Total de horas": oa.totalHoras,
      "Média por registro (min)": oa.mediaMinutosPorRegistro,
      [`Quantidade total${oa.unidadeQuantidade ? ` (${oa.unidadeQuantidade})` : ""}`]: oa.totalQuantidade ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(abaOperadorAtividade), "Por operador e atividade");

    const abaDetalhe = registros.map((r) => ({
      "Data": r.data.toISOString().slice(0, 10).split("-").reverse().join("/"),
      "Operador": r.usuario.nome,
      "Atividade": r.atividade.nome,
      "Cliente": r.empresa ? `${r.empresa.codigoInterno} - ${r.empresa.razaoSocial}` : "",
      "Início": r.horaInicio.toISOString().slice(11, 16),
      "Fim": r.horaFim.toISOString().slice(11, 16),
      "Duração (min)": Math.round((r.horaFim.getTime() - r.horaInicio.getTime()) / 60000),
      "Quantidade": r.quantidade ?? "",
      "Observação": r.observacao ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(abaDetalhe), "Registros detalhados");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="relatorio_horas_${de}_a_${ate}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ de, ate, porOperador, porOperadorAtividade, porAtividade, detalhePorPessoa, totalRegistros: registros.length });
}
