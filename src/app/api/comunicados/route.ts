import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, ehSupervisorDeAlgumSetor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailComunicadoHtml } from "@/lib/mail";

// POST /api/comunicados — manda um comunicado livre (assunto + mensagem)
// pra uma lista de destinatários (colaboradores ou clientes).
// Cada destinatário recebe o e-mail individualmente (não vê quem mais
// recebeu) — a cópia fixa configurada em Automações entra em cada um.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA" && !ehSupervisorDeAlgumSetor(user.setores ?? []))
    return NextResponse.json({ error: "Restrito à Diretoria e supervisores" }, { status: 403 });

  try {
    const body = await req.json();
    const { destinatarios, assunto, mensagem, tipo } = body as {
      destinatarios: { email: string; nome?: string }[];
      assunto: string;
      mensagem: string;
      tipo?: string;
    };

    if (!Array.isArray(destinatarios) || destinatarios.length === 0)
      return NextResponse.json({ error: "Selecione pelo menos um destinatário" }, { status: 400 });
    if (!assunto?.trim())
      return NextResponse.json({ error: "Informe o assunto" }, { status: 400 });
    if (!mensagem?.trim())
      return NextResponse.json({ error: "Informe a mensagem" }, { status: 400 });
    if (destinatarios.length > 500)
      return NextResponse.json({ error: "Máximo de 500 destinatários por envio" }, { status: 400 });

    const html = emailComunicadoHtml({ assunto, mensagem, remetente: user.name ?? "Real Domínio" });

    let enviados = 0;
    const falhas: string[] = [];
    for (const d of destinatarios) {
      if (!d?.email) continue;
      try {
        await enviarEmail({ para: d.email, assunto, texto: mensagem, html });
        enviados++;
      } catch (e) {
        falhas.push(d.email);
      }
    }

    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        entidadeTipo: "comunicado",
        entidadeId: crypto.randomUUID(),
        acao: "create",
        valorNovo: JSON.stringify({ tipo, assunto, destinatarios: destinatarios.map((d) => d.email), enviados }),
      },
    });

    return NextResponse.json({ ok: true, enviados, total: destinatarios.length, falhas });
  } catch (e: any) {
    console.error("Erro ao enviar comunicado:", e);
    return NextResponse.json({ error: "Erro ao enviar comunicado", detalhe: e?.message }, { status: 500 });
  }
}
