import nodemailer from "nodemailer";
import { descriptografar } from "@/lib/crypto";

// Busca a conta de e-mail configurada em Configurações → E-mail.
// Enquanto ninguém configurar nada, isso devolve null e o sistema só
// registra no log que "mandaria" o e-mail, sem quebrar nada.
export async function getTransporter() {
  const { prisma } = await import("@/lib/prisma");
  const config = await prisma.configuracaoEmail.findUnique({ where: { id: "config" } });
  if (!config?.gmailUser || !config?.gmailSenhaCifrada) return null;

  const senha = descriptografar(config.gmailSenhaCifrada);
  return {
    transporter: nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.gmailUser, pass: senha },
    }),
    remetente: config.gmailUser,
  };
}

export async function enviarEmail(params: { para: string; assunto: string; texto: string }) {
  const conf = await getTransporter();
  if (!conf) {
    console.log(`[e-mail não configurado ainda] Para: ${params.para} — ${params.assunto}`);
    return;
  }
  try {
    await conf.transporter.sendMail({
      from: `"Real Domínio - Sistema" <${conf.remetente}>`,
      to: params.para,
      subject: params.assunto,
      text: params.texto,
    });
  } catch (e) {
    // Nunca deixa o envio de e-mail quebrar a ação principal (criar
    // tarefa/evento) — só registra o erro no log do servidor.
    console.error("Erro ao enviar e-mail:", e);
  }
}

// Avisa um usuário (notificação dentro do sistema + e-mail). Não quebra
// a ação principal se algo der errado aqui.
export async function avisarResponsavel(params: {
  usuarioId: string;
  titulo: string;
  mensagem: string;
  entidadeTipo: string;
  entidadeId: string;
}) {
  const { prisma } = await import("@/lib/prisma");
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: params.usuarioId },
      select: { email: true },
    });

    await prisma.notificacao.create({
      data: {
        usuarioId: params.usuarioId,
        titulo: params.titulo,
        mensagem: params.mensagem,
        entidadeTipo: params.entidadeTipo,
        entidadeId: params.entidadeId,
      },
    });

    if (usuario?.email) {
      await enviarEmail({ para: usuario.email, assunto: params.titulo, texto: params.mensagem });
    }
  } catch (e) {
    console.error("Erro ao avisar responsável:", e);
  }
}

// Avisa o responsável direto + os Líderes daquele setor + todos os
// Coordenadores (visão geral) — usado quando uma tarefa/evento é
// criado e atribuído a alguém.
export async function avisarEquipeDoSetor(params: {
  setorId: string | null;
  responsavelId: string | null;
  criadorId: string;
  titulo: string;
  mensagem: string;
  entidadeTipo: string;
  entidadeId: string;
}) {
  const { prisma } = await import("@/lib/prisma");
  try {
    const idsParaAvisar = new Set<string>();
    if (params.responsavelId) idsParaAvisar.add(params.responsavelId);

    if (params.setorId) {
      const lideres = await prisma.usuarioSetor.findMany({
        where: { setorId: params.setorId, usuario: { perfilGlobal: "LIDER", ativo: true } },
        select: { usuarioId: true },
      });
      lideres.forEach((l) => idsParaAvisar.add(l.usuarioId));
    }

    const coordenadores = await prisma.usuario.findMany({
      where: { perfilGlobal: "COORDENADOR", ativo: true },
      select: { id: true },
    });
    coordenadores.forEach((c) => idsParaAvisar.add(c.id));

    idsParaAvisar.delete(params.criadorId);

    for (const usuarioId of idsParaAvisar) {
      await avisarResponsavel({
        usuarioId,
        titulo: params.titulo,
        mensagem: params.mensagem,
        entidadeTipo: params.entidadeTipo,
        entidadeId: params.entidadeId,
      });
    }
  } catch (e) {
    console.error("Erro ao avisar equipe do setor:", e);
  }
}
