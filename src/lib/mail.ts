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

// Lista fixa de e-mails que entram em cópia (CC) em TODO e-mail automático
// do sistema — configurável em Configurações > Automações e alertas.
async function copiaFixaEmails(): Promise<string[]> {
  const { prisma } = await import("@/lib/prisma");
  try {
    const config = await prisma.configuracaoAutomacao.findUnique({ where: { id: "config" } });
    if (!config?.copiaEmailsFixos) return [];
    return config.copiaEmailsFixos
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter(Boolean);
  } catch (e) {
    console.error("Erro ao buscar cópia fixa de e-mails:", e);
    return [];
  }
}

// `para` aceita um endereço só ou uma lista — nesse caso todo mundo entra
// no MESMO e-mail (um único envio com vários destinatários), em vez de
// mandar um e-mail separado pra cada um.
export async function enviarEmail(params: { para: string | string[]; assunto: string; texto?: string; html?: string }) {
  const paraLista = (Array.isArray(params.para) ? params.para : [params.para]).filter(Boolean);
  if (paraLista.length === 0) return;

  const conf = await getTransporter();
  if (!conf) {
    console.log(`[e-mail não configurado ainda] Para: ${paraLista.join(", ")} — ${params.assunto}`);
    return;
  }
  const cc = (await copiaFixaEmails()).filter(
    (e) => !paraLista.some((p) => p.toLowerCase() === e.toLowerCase())
  );
  try {
    await conf.transporter.sendMail({
      from: `"Real Domínio - Sistema" <${conf.remetente}>`,
      to: paraLista.join(", "),
      cc: cc.length > 0 ? cc : undefined,
      subject: params.assunto,
      text: params.texto ?? " ",
      html: params.html,
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
  html?: string;
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
      await enviarEmail({ para: usuario.email, assunto: params.titulo, texto: params.mensagem, html: params.html });
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

// ── Grupos de destinatário (usado no "enviar e-mail" opcional de tarefas
// e eventos, e nos alertas automáticos) ────────────────────────────────

export type GrupoEmail = "supervisores" | "operadores" | "diretoria" | "mordomos";

export const GRUPOS_EMAIL_LABEL: Record<GrupoEmail, string> = {
  supervisores: "Supervisores do setor",
  operadores: "Operadores do setor",
  diretoria: "Diretoria",
  mordomos: "Mordomo(a) da empresa",
};

// Resolve os grupos escolhidos pra uma lista de usuários (com e-mail) de
// verdade. "supervisores"/"operadores" pedem um setorId (não fazem
// sentido sem um setor de referência); "mordomos" pede um empresaId.
export async function resolverDestinatariosGrupo(params: {
  grupos: GrupoEmail[];
  setorId?: string | null;
  empresaId?: string | null;
  excluirUsuarioId?: string | null;
}): Promise<{ id: string; nome: string; email: string }[]> {
  const { prisma } = await import("@/lib/prisma");
  const ids = new Set<string>();

  if (params.grupos.includes("diretoria")) {
    const diretores = await prisma.usuario.findMany({
      where: { perfilGlobal: "DIRETORIA", ativo: true },
      select: { id: true },
    });
    diretores.forEach((d) => ids.add(d.id));
  }

  if (params.grupos.includes("supervisores") && params.setorId) {
    const sups = await prisma.usuarioSetor.findMany({
      where: { setorId: params.setorId, papel: "supervisor", usuario: { ativo: true } },
      select: { usuarioId: true },
    });
    sups.forEach((s) => ids.add(s.usuarioId));
  }

  if (params.grupos.includes("operadores") && params.setorId) {
    const ops = await prisma.usuarioSetor.findMany({
      where: { setorId: params.setorId, usuario: { perfilGlobal: "OPERADOR", ativo: true } },
      select: { usuarioId: true },
    });
    ops.forEach((o) => ids.add(o.usuarioId));
  }

  if (params.grupos.includes("mordomos") && params.empresaId) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: params.empresaId },
      select: { respLiderId: true },
    });
    if (empresa?.respLiderId) ids.add(empresa.respLiderId);
  }

  if (params.excluirUsuarioId) ids.delete(params.excluirUsuarioId);
  if (ids.size === 0) return [];

  return prisma.usuario.findMany({
    where: { id: { in: Array.from(ids) }, ativo: true },
    select: { id: true, nome: true, email: true },
  });
}

// ── Templates de e-mail (HTML) ──────────────────────────────────────

function envelopeHtml(preheader: string, corpoHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none;font-size:1px;color:#f3f4f6;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#0f172a;padding:18px 28px;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;">Real Domínio</span>
          <div style="color:#9ca3af;font-size:11px;margin-top:2px;">Sistema de gestão operacional</div>
        </td></tr>
        <tr><td style="padding:28px;">${corpoHtml}</td></tr>
        <tr><td style="padding:14px 28px;background:#f9fafb;border-top:1px solid #eef0f2;">
          <span style="color:#9ca3af;font-size:11px;">E-mail automático do sistema Real Domínio. Não responda a esta mensagem.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function tabelaLinhas(linhas: { rotulo: string; valor: string }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${linhas
      .map(
        (x) => `<tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;width:130px;vertical-align:top;">${x.rotulo}</td>
          <td style="padding:5px 0;color:#111827;font-size:13px;font-weight:600;vertical-align:top;">${x.valor}</td>
        </tr>`
      )
      .join("")}
  </table>`;
}

function badge(texto: string, cor: string): string {
  return `<span style="display:inline-block;background:${cor}1a;color:${cor};font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;">${texto}</span>`;
}

export function emailNovaTarefaHtml(p: {
  titulo: string; empresa: string; setor: string | null; responsavel: string | null;
  prazo: string | null; descricao: string | null; criadoPor: string; url: string;
}): string {
  const corpo = `
    ${badge("NOVA TAREFA", "#2563eb")}
    <h2 style="margin:12px 0 4px;color:#111827;font-size:18px;">${p.titulo}</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:12.5px;">Criada por ${p.criadoPor}</p>
    ${tabelaLinhas([
      { rotulo: "Cliente", valor: p.empresa },
      { rotulo: "Setor", valor: p.setor ?? "—" },
      { rotulo: "Responsável", valor: p.responsavel ?? "Não atribuído" },
      { rotulo: "Prazo", valor: p.prazo ?? "Sem prazo definido" },
    ])}
    ${p.descricao ? `<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #eef0f2;color:#374151;font-size:13px;white-space:pre-wrap;">${p.descricao}</p>` : ""}
    <a href="${p.url}" style="display:inline-block;margin-top:20px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver tarefa no sistema</a>
  `;
  return envelopeHtml(`Nova tarefa: ${p.titulo}`, corpo);
}

export function emailNovoEventoHtml(p: {
  tipo: string; empresa: string; setor: string | null; responsavel: string | null;
  prazo: string | null; observacoes: string | null; criadoPor: string; url: string;
}): string {
  const corpo = `
    ${badge("NOVO EVENTO", "#7c3aed")}
    <h2 style="margin:12px 0 4px;color:#111827;font-size:18px;">${p.tipo}</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:12.5px;">Criado por ${p.criadoPor}</p>
    ${tabelaLinhas([
      { rotulo: "Cliente", valor: p.empresa },
      { rotulo: "Setor", valor: p.setor ?? "—" },
      { rotulo: "Responsável", valor: p.responsavel ?? "Não atribuído" },
      { rotulo: "Prazo", valor: p.prazo ?? "Sem prazo definido" },
    ])}
    ${p.observacoes ? `<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #eef0f2;color:#374151;font-size:13px;white-space:pre-wrap;">${p.observacoes}</p>` : ""}
    <a href="${p.url}" style="display:inline-block;margin-top:20px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver evento no sistema</a>
  `;
  return envelopeHtml(`Novo evento: ${p.tipo}`, corpo);
}

export function emailAlertaObrigacaoHtml(p: {
  atrasada: boolean; nomeObrigacao: string; empresa: string; setor: string;
  vencimento: string; diasRestantes: number; url: string;
}): string {
  const cor = p.atrasada ? "#dc2626" : "#d97706";
  const corpo = `
    ${badge(p.atrasada ? "OBRIGAÇÃO EM ATRASO" : "VENCIMENTO PRÓXIMO", cor)}
    <h2 style="margin:12px 0 4px;color:#111827;font-size:18px;">${p.nomeObrigacao}</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:12.5px;">
      ${p.atrasada ? "Essa obrigação passou da data de vencimento." : `Vence em ${p.diasRestantes} dia(s).`}
    </p>
    ${tabelaLinhas([
      { rotulo: "Cliente", valor: p.empresa },
      { rotulo: "Setor", valor: p.setor },
      { rotulo: "Vencimento", valor: p.vencimento },
    ])}
    <a href="${p.url}" style="display:inline-block;margin-top:20px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver no sistema</a>
  `;
  return envelopeHtml(`${p.atrasada ? "Em atraso" : "Vence em breve"}: ${p.nomeObrigacao} - ${p.empresa}`, corpo);
}

// Digest diário — uma listagem única com todas as empresas pendentes (em
// atraso ou vencendo dentro da janela configurada) de um setor, enviada
// num único e-mail pros responsáveis dessas empresas + supervisores do
// setor.
export function emailDigestObrigacoesSetorHtml(p: {
  setor: string;
  itens: { empresa: string; obrigacao: string; vencimento: string; diasRestantes: number; atrasada: boolean; responsavel: string | null }[];
  url: string;
}): string {
  const atrasadas = p.itens.filter((i) => i.atrasada);
  const proximas = p.itens.filter((i) => !i.atrasada);

  function linha(i: (typeof p.itens)[number]) {
    const cor = i.atrasada ? "#dc2626" : "#d97706";
    return `<tr>
      <td style="padding:8px 0;border-top:1px solid #f1f2f4;color:#111827;font-size:13px;">${i.empresa}</td>
      <td style="padding:8px 0;border-top:1px solid #f1f2f4;color:#111827;font-size:13px;">${i.obrigacao}</td>
      <td style="padding:8px 0;border-top:1px solid #f1f2f4;color:#6b7280;font-size:12px;">${i.responsavel ?? "Sem responsável"}</td>
      <td style="padding:8px 0;border-top:1px solid #f1f2f4;font-size:12px;text-align:right;color:${cor};font-weight:700;white-space:nowrap;">${i.atrasada ? "Em atraso" : `${i.vencimento} (${i.diasRestantes}d)`}</td>
    </tr>`;
  }

  const corpo = `
    ${badge("RESUMO DE OBRIGAÇÕES", "#d97706")}
    <h2 style="margin:12px 0 4px;color:#111827;font-size:18px;">Obrigações pendentes - ${p.setor}</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:12.5px;">
      ${atrasadas.length} em atraso e ${proximas.length} vencendo em breve.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-bottom:6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;">Cliente</td>
        <td style="padding-bottom:6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;">Obrigação</td>
        <td style="padding-bottom:6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;">Responsável</td>
        <td style="padding-bottom:6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;text-align:right;">Situação</td>
      </tr>
      ${[...atrasadas, ...proximas].map(linha).join("")}
    </table>
    <a href="${p.url}" style="display:inline-block;margin-top:20px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver obrigações no sistema</a>
  `;
  return envelopeHtml(`${p.itens.length} obrigação(ões) pendente(s) - ${p.setor}`, corpo);
}

// Alerta pros supervisores de um setor: empresas ativas que não têm
// ninguém atribuído como responsável naquele setor (buraco na carteira).
export function emailAlertaCarteiraSemResponsavelHtml(p: {
  setor: string;
  empresas: { codigo: string; razaoSocial: string }[];
  url: string;
}): string {
  const corpo = `
    ${badge("CARTEIRA SEM RESPONSÁVEL", "#dc2626")}
    <h2 style="margin:12px 0 4px;color:#111827;font-size:18px;">Empresas ativas sem responsável - ${p.setor}</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:12.5px;">
      ${p.empresas.length} empresa(s) ativa(s) sem ninguém atribuído no setor ${p.setor}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${p.empresas
        .map((e) => `<tr><td style="padding:6px 0;border-top:1px solid #f1f2f4;color:#111827;font-size:13px;">${e.codigo} - ${e.razaoSocial}</td></tr>`)
        .join("")}
    </table>
    <a href="${p.url}" style="display:inline-block;margin-top:20px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver clientes no sistema</a>
  `;
  return envelopeHtml(`${p.empresas.length} empresa(s) sem responsável - ${p.setor}`, corpo);
}

export function emailRelatorioHorasIndividualHtml(p: {
  nome: string; periodo: string; totalHoras: string; qtdRegistros: number;
  porAtividade: { nome: string; totalHoras: string; totalQuantidade: number | null; unidade: string | null }[];
  url: string;
}): string {
  const linhasAtividade = p.porAtividade
    .map(
      (a) => `<tr>
        <td style="padding:8px 0;border-top:1px solid #f1f2f4;color:#111827;font-size:13px;">${a.nome}</td>
        <td style="padding:8px 0;border-top:1px solid #f1f2f4;color:#111827;font-size:13px;text-align:right;font-weight:600;">${a.totalHoras}</td>
        <td style="padding:8px 0;border-top:1px solid #f1f2f4;color:#6b7280;font-size:12px;text-align:right;">${a.totalQuantidade != null ? `${a.totalQuantidade} ${a.unidade ?? ""}` : ""}</td>
      </tr>`
    )
    .join("");
  const corpo = `
    ${badge("RELATÓRIO SEMANAL", "#059669")}
    <h2 style="margin:12px 0 4px;color:#111827;font-size:18px;">Suas horas - ${p.periodo}</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:12.5px;">Olá, ${p.nome}. Aqui está o resumo do seu registro de horas.</p>
    ${tabelaLinhas([
      { rotulo: "Total de horas", valor: p.totalHoras },
      { rotulo: "Registros feitos", valor: String(p.qtdRegistros) },
    ])}
    ${p.porAtividade.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
          <tr>
            <td style="padding-bottom:6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;">Atividade</td>
            <td style="padding-bottom:6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;text-align:right;">Horas</td>
            <td style="padding-bottom:6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;text-align:right;">Quantidade</td>
          </tr>
          ${linhasAtividade}
        </table>`
      : `<p style="margin-top:18px;color:#9ca3af;font-size:13px;">Nenhum registro de horas nesse período.</p>`}
    <a href="${p.url}" style="display:inline-block;margin-top:20px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver registro de horas</a>
  `;
  return envelopeHtml(`Suas horas - ${p.periodo}`, corpo);
}

export function emailRelatorioHorasComparativoHtml(p: {
  escopo: string; periodo: string;
  porOperador: { nome: string; totalHoras: string }[];
  url: string;
}): string {
  const maxHoras = Math.max(...p.porOperador.map((o) => parseFloat(o.totalHoras) || 0), 0.01);
  const linhas = p.porOperador
    .map((o) => {
      const horasNum = parseFloat(o.totalHoras) || 0;
      const largura = Math.max(4, Math.round((horasNum / maxHoras) * 100));
      return `<tr>
        <td style="padding:7px 0;color:#111827;font-size:13px;width:130px;">${o.nome}</td>
        <td style="padding:7px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td style="background:#eef2ff;border-radius:6px;">
              <div style="background:#4f46e5;width:${largura}%;height:10px;border-radius:6px;"></div>
            </td>
          </tr></table>
        </td>
        <td style="padding:7px 0 7px 10px;color:#111827;font-size:12.5px;font-weight:600;text-align:right;width:60px;">${o.totalHoras}</td>
      </tr>`;
    })
    .join("");
  const corpo = `
    ${badge("RELATÓRIO SEMANAL", "#4f46e5")}
    <h2 style="margin:12px 0 4px;color:#111827;font-size:18px;">Comparativo de horas - ${p.periodo}</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:12.5px;">${p.escopo}</p>
    ${p.porOperador.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}</table>`
      : `<p style="color:#9ca3af;font-size:13px;">Nenhum registro de horas nesse período.</p>`}
    <a href="${p.url}" style="display:inline-block;margin-top:20px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver relatório completo</a>
  `;
  return envelopeHtml(`Comparativo de horas - ${p.periodo}`, corpo);
}
