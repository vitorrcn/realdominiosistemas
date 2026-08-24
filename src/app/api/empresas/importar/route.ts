import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

interface LinhaImport {
  codigo_interno?: string;
  cnpj?: string;
  cpf?: string;
  tipo_pessoa?: string;
  nome_empresarial?: string;
  razao_social?: string;
  data_entrada?: string;
  data_saida?: string;
  bairro?: string;
  municipio?: string;
  // aliases flexíveis
  codigo?: string;
  nome?: string;
}

// Aceita "2024-05-20", "20/05/2024" ou datas seriais do Excel
function parseDataFlexivel(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Data serial do Excel (dias desde 1899-12-30)
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  const texto = String(v).trim();
  if (!texto) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return new Date(texto);
  const partesBr = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (partesBr) return new Date(Number(partesBr[3]), Number(partesBr[2]) - 1, Number(partesBr[1]));
  const tentativa = new Date(texto);
  return isNaN(tentativa.getTime()) ? null : tentativa;
}

function limparDocumento(v: string): string {
  return String(v).replace(/\D/g, "");
}

// POST /api/empresas/importar
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão para importar clientes" }, { status: 403 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File | null;

  if (!arquivo)
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let linhas: LinhaImport[];
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("Planilha vazia ou sem abas");
    linhas = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Não consegui ler esse arquivo. Confira se é um Excel (.xlsx) ou CSV válido." },
      { status: 400 }
    );
  }

  if (linhas.length === 0) {
    return NextResponse.json({ error: "A planilha está vazia (nenhuma linha de dados encontrada)." }, { status: 400 });
  }

  const resultado = {
    criadas:    0,
    atualizadas: 0,
    ignoradas:  0,
    erros:      [] as { linha: number; documento: string; motivo: string }[],
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const numLinha = i + 2; // +2 porque linha 1 é cabeçalho

    // Normalizar campos (aceita variações de nome)
    const cnpjRaw  = String(linha.cnpj || "").trim();
    const cpfRaw   = String(linha.cpf  || "").trim();
    const codigo   = String(linha.codigo_interno || linha.codigo || "").trim();
    const nome     = String(linha.nome_empresarial || linha.razao_social || linha.nome || "").trim();
    const bairro   = String(linha.bairro || "").trim();
    const municipio = String(linha.municipio || "").trim();
    const dataEntrada = parseDataFlexivel(linha.data_entrada);
    const dataSaida    = parseDataFlexivel(linha.data_saida);

    // Descobre se a linha é PJ (CNPJ) ou PF (CPF) — o que estiver preenchido decide
    let tipoPessoa: "PJ" | "PF" | null = null;
    let documentoLimpo = "";

    if (cpfRaw) {
      tipoPessoa = "PF";
      documentoLimpo = limparDocumento(cpfRaw);
    } else if (cnpjRaw) {
      tipoPessoa = "PJ";
      documentoLimpo = limparDocumento(cnpjRaw);
    }

    if (!tipoPessoa) {
      resultado.erros.push({ linha: numLinha, documento: "-", motivo: "CNPJ ou CPF não informado" });
      continue;
    }

    const documentoOriginal = tipoPessoa === "PF" ? cpfRaw : cnpjRaw;
    const tamanhoEsperado = tipoPessoa === "PF" ? 11 : 14;

    if (documentoLimpo.length !== tamanhoEsperado) {
      resultado.erros.push({
        linha: numLinha,
        documento: documentoOriginal,
        motivo: `${tipoPessoa === "PF" ? "CPF" : "CNPJ"} inválido (precisa ter ${tamanhoEsperado} dígitos)`,
      });
      continue;
    }

    if (!nome) {
      resultado.erros.push({ linha: numLinha, documento: documentoOriginal, motivo: "Nome não informado" });
      continue;
    }

    try {
      const existente = await prisma.empresa.findFirst({
        where: tipoPessoa === "PF" ? { cpf: documentoLimpo } : { cnpj: documentoLimpo },
      });

      if (existente) {
        // Já existe: atualizar apenas campos que estavam vazios
        await prisma.empresa.update({
          where: { id: existente.id },
          data: {
            ...(codigo && !existente.codigoInterno ? { codigoInterno: codigo } : {}),
            ...(bairro && !existente.bairro ? { bairro } : {}),
            ...(municipio && !existente.municipio ? { municipio } : {}),
            ...(dataEntrada && !existente.dataEntrada ? { dataEntrada } : {}),
            ...(dataSaida && !existente.dataSaida ? { dataSaida } : {}),
          },
        });
        resultado.atualizadas++;
        continue;
      }

      // Criar novo cliente com módulos setoriais vazios
      await prisma.empresa.create({
        data: {
          tipoPessoa,
          cnpj:          tipoPessoa === "PJ" ? documentoLimpo : null,
          cpf:           tipoPessoa === "PF" ? documentoLimpo : null,
          codigoInterno: codigo || `IMP-${Date.now()}-${i}`,
          razaoSocial:   nome,
          bairro:        bairro || null,
          municipio:     municipio || null,
          dataEntrada:   dataEntrada || null,
          dataSaida:     dataSaida || null,
          status:        dataSaida ? "EX_CLIENTE" : "CADASTRO_INCOMPLETO",
          fiscal:        { create: {} },
          contabil:      { create: {} },
          dp:            { create: {} },
          societario:    { create: {} },
          relacionamento:{ create: {} },
        },
      });

      resultado.criadas++;
    } catch (e: any) {
      resultado.erros.push({
        linha: numLinha,
        documento: documentoOriginal,
        motivo: e?.code === "P2002" ? "Documento ou código duplicado" : "Erro interno",
      });
    }
  }

  // Auditoria da importação
  await prisma.auditoria.create({
    data: {
      usuarioId:    user.id,
      entidadeTipo: "importacao",
      entidadeId:   "batch",
      acao:         "create",
      valorNovo:    JSON.stringify(resultado),
    },
  });

  return NextResponse.json(resultado);
}
