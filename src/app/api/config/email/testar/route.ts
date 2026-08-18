import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTransporter } from "@/lib/mail";
import { NextResponse } from "next/server";

// POST /api/config/email/testar — manda um e-mail de teste pro próprio usuário logado
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  if (!user.email)
    return NextResponse.json({ error: "Seu usuário não tem e-mail cadastrado" }, { status: 400 });

  const conf = await getTransporter();
  if (!conf)
    return NextResponse.json({ error: "E-mail e senha ainda não foram salvos." }, { status: 400 });

  try {
    await conf.transporter.sendMail({
      from: `"Real Domínio - Sistema" <${conf.remetente}>`,
      to: user.email,
      subject: "Teste — Sistema Real Domínio",
      text: "Se você recebeu esse e-mail, a configuração está funcionando certinho!",
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "O Google recusou o envio — confira o e-mail e a senha de app.", detalhe: e?.message }, { status: 500 });
  }
}
