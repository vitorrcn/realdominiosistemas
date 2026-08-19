import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
// Somente Diretoria. Calcula, pro período informado: total de horas e
// média por operador, e a média de tempo gasto por operador em cada
// atividade (o que motivou o pedido — comparar quanto tempo cada um gasta
// na mesma tarefa).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode ver relatórios de horas" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const [anoMes] = [competenciaAtual()];
  const de = searchParams.get("de") || `${anoMes}-01`;
  const ate = searchParams.get("ate") || new Date().toISOString().slice(0, 10);
  const usuarioId = searchParams.get("usuarioId") || undefined;
  const atividadeId = searchParams.get("atividadeId") || undefined;
  const formato = searchParams.get("formato") || "json";

  const registros = await prisma.registroAtividade.findMany({
    where: {
      data: { gte: apenasData(de), lte: apenasData(ate) },
      ...(usuarioId && { usuarioId }),
      ...(atividadeId && { atividadeId }),
    },
    include: {
      usuario: { select: { id: true, nome: true } },
      atividade: { select: { id: true, nome: true } },
      empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });

  // ── Agregação por operador ────────────────────────────────────────
  const porOperadorMap = new Map<string, {
    usuarioId: string; nome: string; totalMinutos: number; qtdRegistros: number; dias: Set<string>;
  }>();
  // ── Agregação por operador + atividade ──────────────────────────────
  const porOperadorAtividadeMap = new Map<string, {
    usuarioId: string; nomeUsuario: string; atividadeId: string; nomeAtividade: string;
    totalMinutos: number; qtdRegistros: number;
  }>();

  for (const r of registros) {
    const minutos = (r.horaFim.getTime() - r.horaInicio.getTime()) / 60000;
    const diaStr = r.data.toISOString().slice(0, 10);

    if (!porOperadorMap.has(r.usuarioId)) {
      porOperadorMap.set(r.usuarioId, { usuarioId: r.usuarioId, nome: r.usuario.nome, totalMinutos: 0, qtdRegistros: 0, dias: new Set() });
    }
    const op = porOperadorMap.get(r.usuarioId)!;
    op.totalMinutos += minutos;
    op.qtdRegistros += 1;
    op.dias.add(diaStr);

    const chaveOA = `${r.usuarioId}::${r.atividadeId}`;
    if (!porOperadorAtividadeMap.has(chaveOA)) {
      porOperadorAtividadeMap.set(chaveOA, {
        usuarioId: r.usuarioId, nomeUsuario: r.usuario.nome,
        atividadeId: r.atividadeId, nomeAtividade: r.atividade.nome,
        totalMinutos: 0, qtdRegistros: 0,
      });
    }
    const oa = porOperadorAtividadeMap.get(chaveOA)!;
    oa.totalMinutos += minutos;
    oa.qtdRegistros += 1;
  }

  const porOperador = Array.from(porOperadorMap.values())
    .map((o) => ({
      usuarioId: o.usuarioId,
      nome: o.nome,
      qtdRegistros: o.qtdRegistros,
      diasComRegistro: o.dias.size,
      totalHoras: Math.round((o.totalMinutos / 60) * 100) / 100,
      mediaHorasPorDia: o.dias.size > 0 ? Math.round((o.totalMinutos / 60 / o.dias.size) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.totalHoras - a.totalHoras);

  const porOperadorAtividade = Array.from(porOperadorAtividadeMap.values())
    .map((oa) => ({
      usuarioId: oa.usuarioId,
      nomeUsuario: oa.nomeUsuario,
      atividadeId: oa.atividadeId,
      nomeAtividade: oa.nomeAtividade,
      qtdRegistros: oa.qtdRegistros,
      totalHoras: Math.round((oa.totalMinutos / 60) * 100) / 100,
      mediaMinutosPorRegistro: Math.round(oa.totalMinutos / oa.qtdRegistros),
    }))
    .sort((a, b) => a.nomeUsuario.localeCompare(b.nomeUsuario) || a.nomeAtividade.localeCompare(b.nomeAtividade));

  if (formato === "excel") {
    const wb = XLSX.utils.book_new();

    const abaOperador = porOperador.map((o) => ({
      "Operador": o.nome,
      "Dias com registro": o.diasComRegistro,
      "Qtd. registros": o.qtdRegistros,
      "Total de horas": o.totalHoras,
      "Média de horas/dia": o.mediaHorasPorDia,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(abaOperador), "Por operador");

    const abaOperadorAtividade = porOperadorAtividade.map((oa) => ({
      "Operador": oa.nomeUsuario,
      "Atividade": oa.nomeAtividade,
      "Qtd. registros": oa.qtdRegistros,
      "Total de horas": oa.totalHoras,
      "Média por registro (min)": oa.mediaMinutosPorRegistro,
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

  return NextResponse.json({ de, ate, porOperador, porOperadorAtividade, totalRegistros: registros.length });
}
