import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Modulo = "fiscal" | "contabil" | "dp" | "societario" | "relacionamento" | "comercial";

// Campos que nunca podem vir do formulário (são controlados pelo banco)
const CAMPOS_PROIBIDOS = ["id", "empresaId", "createdAt", "updatedAt", "empresa"];

// Reconhece datas no formato do <input type="date"> (ex: "2025-12-31").
// O Postgres/Prisma exige um DateTime completo (com hora), então uma
// string "só a data" quebra o upsert com "premature end of input".
const REGEX_DATA_SIMPLES = /^\d{4}-\d{2}-\d{2}$/;

function sanitizarBody(modulo: Modulo, body: Record<string, any>) {
  const limpo: Record<string, any> = {};
  for (const [chave, valor] of Object.entries(body)) {
    if (CAMPOS_PROIBIDOS.includes(chave)) continue; // nunca deixar sobrescrever id/empresaId/timestamps

    // Regra universal: string vazia nunca é um valor válido para
    // data/número/decimal no banco — e mesmo em campos de texto, "vazio"
    // e "nulo" significam a mesma coisa aqui. Convertendo sempre evita
    // qualquer campo esquecido travar o salvamento inteiro.
    if (valor === "") {
      limpo[chave] = null;
      continue;
    }

    // Datas "soltas" (YYYY-MM-DD) precisam virar Date de verdade
    if (typeof valor === "string" && REGEX_DATA_SIMPLES.test(valor)) {
      limpo[chave] = new Date(valor);
      continue;
    }

    limpo[chave] = valor;
  }
  return limpo;
}

// PATCH /api/empresas/[id]/modulos?modulo=fiscal
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const modulo = req.nextUrl.searchParams.get("modulo") as Modulo;
  if (!modulo)
    return NextResponse.json({ error: "Parâmetro 'modulo' obrigatório" }, { status: 400 });

  // Bloquear comercial para quem não tem acesso
  if (modulo === "comercial" && user.perfilGlobal !== "DIRETORIA" && !user.podeVerComercial)
    return NextResponse.json({ error: "Sem permissão para dados comerciais" }, { status: 403 });

  const bodyOriginal = await req.json();
  const body = sanitizarBody(modulo, bodyOriginal);

  const upsertData = { where: { empresaId: params.id }, update: body, create: { ...body, empresaId: params.id } };

  try {
    let resultado;
    switch (modulo) {
      case "fiscal":
        resultado = await prisma.fiscal.upsert(upsertData);
        break;
      case "contabil":
        resultado = await prisma.contabil.upsert(upsertData);
        break;
      case "dp":
        resultado = await prisma.dp.upsert(upsertData);
        break;
      case "societario":
        resultado = await prisma.societario.upsert(upsertData);
        break;
      case "relacionamento":
        resultado = await prisma.relacionamento.upsert(upsertData);
        break;
      case "comercial":
        resultado = await prisma.comercial.upsert(upsertData);
        // Auditoria obrigatória para dados comerciais
        await prisma.auditoria.create({
          data: {
            usuarioId:    user.id,
            entidadeTipo: "comercial",
            entidadeId:   params.id,
            acao:         "update",
            valorNovo:    JSON.stringify(body),
          },
        });
        break;
      default:
        return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
    }

    return NextResponse.json(resultado);
  } catch (e: any) {
    console.error(`Erro ao salvar módulo ${modulo}:`, e);
    return NextResponse.json(
      { error: "Erro ao salvar dados. Verifique os campos preenchidos.", detalhe: e?.message },
      { status: 500 }
    );
  }
}
