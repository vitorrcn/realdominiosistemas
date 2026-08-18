import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { formatData } from "@/lib/utils";

// GET /api/backup?formato=json|excel|status
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA") {
    return NextResponse.json(
      { error: "Somente a Diretoria pode exportar backups completos" },
      { status: 403 }
    );
  }

  const formato = req.nextUrl.searchParams.get("formato") || "json";

  if (formato === "status") {
    // Retorna informações sobre backups disponíveis
    const totalEmpresas = await prisma.empresa.count({ where: { deletedAt: null } });
    const totalPessoas = await prisma.pessoa.count({ where: { deletedAt: null } });
    const totalObrigacoes = await prisma.obrigacaoInstancia.count();
    const totalEventos = await prisma.evento.count({ where: { deletedAt: null } });
    const ultimaAuditoria = await prisma.auditoria.findFirst({
      orderBy: { dataHora: "desc" },
    });

    return NextResponse.json({
      totalEmpresas,
      totalPessoas,
      totalObrigacoes,
      totalEventos,
      ultimaAtividade: ultimaAuditoria?.dataHora ?? null,
      dataHoraServidor: new Date(),
    });
  }

  // ── Exportar todos os dados ───────────────────────────────────
  const [
    empresas,
    pessoas,
    usuarios,
    setores,
    obrigacaoTemplates,
    obrigacaoEmpresas,
    obrigacaoInstancias,
    eventos,
    tarefas,
    documentos,
  ] = await Promise.all([
    prisma.empresa.findMany({
      where: { deletedAt: null },
      include: {
        fiscal: true,
        contabil: true,
        dp: true,
        societario: true,
        relacionamento: true,
        socios: { include: { pessoa: true } },
      },
    }),
    prisma.pessoa.findMany({ where: { deletedAt: null } }),
    prisma.usuario.findMany({
      where: { deletedAt: null },
      select: {
        id: true, nome: true, email: true,
        perfilGlobal: true, ativo: true,
        setores: { include: { setor: true } },
      },
    }),
    prisma.setor.findMany(),
    prisma.obrigacaoTemplate.findMany({ include: { setor: true } }),
    prisma.obrigacaoEmpresa.findMany(),
    prisma.obrigacaoInstancia.findMany(),
    prisma.evento.findMany({
      where: { deletedAt: null },
      include: { historico: true },
    }),
    prisma.tarefa.findMany({ where: { deletedAt: null } }),
    prisma.documento.findMany({ where: { deletedAt: null } }),
  ]);

  const payload = {
    versao: "1.0",
    geradoEm: new Date().toISOString(),
    geradoPor: user.name,
    dados: {
      empresas,
      pessoas,
      usuarios,
      setores,
      obrigacaoTemplates,
      obrigacaoEmpresas,
      obrigacaoInstancias,
      eventos,
      tarefas,
      documentos,
    },
  };

  // ── JSON ──────────────────────────────────────────────────────
  if (formato === "json") {
    const json = JSON.stringify(payload, null, 2);
    const dataHoje = new Date().toISOString().slice(0, 10);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="realdominio_backup_${dataHoje}.json"`,
      },
    });
  }

  // ── EXCEL ─────────────────────────────────────────────────────
  if (formato === "excel") {
    const wb = XLSX.utils.book_new();

    // Aba Empresas
    const empresasFlat = empresas.map((e) => ({
      "Código": e.codigoInterno,
      "CNPJ": e.cnpj,
      "Razão Social": e.razaoSocial,
      "Nome Fantasia": e.nomeFantasia ?? "",
      "Status": e.status,
      "Município": e.municipio ?? "",
      "Estado": e.estado ?? "",
      "Data Abertura": e.dataAbertura ? formatData(e.dataAbertura) : "",
      "Data Entrada": e.dataEntrada ? formatData(e.dataEntrada) : "",
      "Data Saída": e.dataSaida ? formatData(e.dataSaida) : "",
      "Regime Tributário": e.fiscal?.regimeTributario ?? "",
      "Obs. Crítica": e.obsCritica ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empresasFlat), "Empresas");

    // Aba Pessoas
    const pessoasFlat = pessoas.map((p) => ({
      "Nome": p.nome,
      "CPF": p.cpf,
      "Data Nasc.": p.dataNascimento ? formatData(p.dataNascimento) : "",
      "Estado Civil": p.estadoCivil ?? "",
      "Telefone": p.telefone ?? "",
      "E-mail": p.email ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pessoasFlat), "Pessoas");

    // Aba Obrigações (instâncias — histórico completo)
    const obrigFlat = obrigacaoInstancias.map((o) => ({
      "ID Obrigação Empresa": o.obrigacaoEmpresaId,
      "Competência": o.competencia,
      "Status": o.status,
      "Data Conclusão": o.dataConclusao ? formatData(o.dataConclusao) : "",
      "Observação": o.observacao ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(obrigFlat), "Obrigações");

    // Aba Eventos
    const eventosFlat = eventos.map((ev) => ({
      "ID": ev.id,
      "Empresa ID": ev.empresaId,
      "Status": ev.status,
      "Data Abertura": formatData(ev.dataAbertura),
      "Prazo": ev.prazo ? formatData(ev.prazo) : "",
      "Observações": ev.observacoes ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventosFlat), "Eventos");

    // Aba Usuários (sem senha)
    const usuariosFlat = usuarios.map((u) => ({
      "Nome": u.nome,
      "E-mail": u.email,
      "Perfil": u.perfilGlobal,
      "Ativo": u.ativo ? "Sim" : "Não",
      "Setores": u.setores.map((s) => s.setor.nome).join(", "),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usuariosFlat), "Usuários");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const dataHoje = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="realdominio_backup_${dataHoje}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: "Formato inválido. Use: json, excel, status" }, { status: 400 });
}
