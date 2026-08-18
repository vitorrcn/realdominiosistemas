import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const RESP_CAMPO: Record<string, "respFiscalId" | "respContabilId" | "respDpId" | "respSocietId"> = {
  Fiscal: "respFiscalId",
  "Contábil": "respContabilId",
  "Departamento Pessoal": "respDpId",
  "Societário": "respSocietId",
};

// GET /api/acessos?setorId=xxx — todos os acessos das empresas desse setor, agrupados
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const setorId = req.nextUrl.searchParams.get("setorId");
  if (!setorId)
    return NextResponse.json({ error: "Parâmetro setorId obrigatório" }, { status: 400 });

  const setor = await prisma.setor.findUnique({ where: { id: setorId } });
  if (!setor)
    return NextResponse.json({ error: "Setor não encontrado" }, { status: 404 });

  const respCampo = RESP_CAMPO[setor.nome];

  const acessos = await prisma.acessoSistema.findMany({
    where: {
      setorId,
      ...(user.perfilGlobal === "OPERADOR" && respCampo
        ? { empresa: { [respCampo]: user.id } }
        : {}),
    },
    orderBy: [{ empresa: { codigoInterno: "asc" } }, { nomeSistema: "asc" }],
    include: {
      empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
    },
  });

  return NextResponse.json(
    acessos.map((a) => ({
      id: a.id,
      empresa: a.empresa,
      nomeSistema: a.nomeSistema,
      link: a.link,
      usuario: a.usuario,
      observacao: a.observacao,
      temSenha: !!a.senhaCifrada,
    }))
  );
}
