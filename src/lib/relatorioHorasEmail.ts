// Envio dos relatórios de horas por e-mail — extraído de
// api/cron/diario/route.ts pra poder ser chamado tanto pelo cron
// (automático, toda semana) quanto por um disparo manual a qualquer
// momento (API /api/registro-horas/relatorio/enviar, botão em
// Registro de horas > Relatórios).
//
// Dois relatórios:
// - Individual: "Suas horas" pra cada pessoa que teve registro no
//   período, só pra ela mesma.
// - Comparativo: mostra todo mundo lado a lado — pra Diretoria (todos
//   os operadores) e, por setor, pros supervisores daquele setor (só a
//   equipe que eles supervisionam).
// Nenhum dos dois leva a cópia fixa de Configurações > Automações
// (`semCopiaFixa: true`) — são dados de horas trabalhadas por pessoa/
// equipe, não podem vazar pra quem não é o destinatário certo.
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailRelatorioHorasIndividualHtml, emailRelatorioHorasComparativoHtml } from "@/lib/mail";

const BASE_URL = process.env.NEXTAUTH_URL || "";

export function formatarHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

async function buscarRegistrosPeriodo(de: Date, ate: Date) {
  return prisma.registroAtividade.findMany({
    where: { data: { gte: de, lte: ate } },
    select: {
      usuarioId: true,
      quantidade: true,
      horaInicio: true,
      horaFim: true,
      usuario: { select: { id: true, nome: true } },
      atividade: { select: { nome: true, unidadeQuantidade: true } },
    },
  });
}

export async function relatoriosIndividuais(de: Date, ate: Date, label: string): Promise<number> {
  const registros = await buscarRegistrosPeriodo(de, ate);
  if (registros.length === 0) return 0;

  const porUsuario = new Map<string, { nome: string; totalMin: number; qtd: number; porAtividade: Map<string, { totalMin: number; totalQtd: number | null; unidade: string | null }> }>();
  for (const r of registros) {
    if (!porUsuario.has(r.usuarioId)) {
      porUsuario.set(r.usuarioId, { nome: r.usuario.nome, totalMin: 0, qtd: 0, porAtividade: new Map() });
    }
    const u = porUsuario.get(r.usuarioId)!;
    const min = (r.horaFim.getTime() - r.horaInicio.getTime()) / 60000;
    u.totalMin += min;
    u.qtd += 1;

    if (!u.porAtividade.has(r.atividade.nome)) {
      u.porAtividade.set(r.atividade.nome, { totalMin: 0, totalQtd: r.quantidade != null ? 0 : null, unidade: r.atividade.unidadeQuantidade });
    }
    const a = u.porAtividade.get(r.atividade.nome)!;
    a.totalMin += min;
    if (r.quantidade != null) a.totalQtd = (a.totalQtd ?? 0) + r.quantidade;
  }

  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: Array.from(porUsuario.keys()) }, ativo: true },
    select: { id: true, email: true },
  });

  let enviados = 0;
  for (const u of usuarios) {
    const dados = porUsuario.get(u.id)!;
    const html = emailRelatorioHorasIndividualHtml({
      nome: dados.nome,
      periodo: label,
      totalHoras: formatarHoras(dados.totalMin),
      qtdRegistros: dados.qtd,
      porAtividade: Array.from(dados.porAtividade.entries()).map(([nome, a]) => ({
        nome, totalHoras: formatarHoras(a.totalMin), totalQuantidade: a.totalQtd, unidade: a.unidade,
      })),
      url: `${BASE_URL}/registro-horas`,
    });
    await enviarEmail({ para: u.email, assunto: `Suas horas - ${label}`, html, semCopiaFixa: true });
    enviados++;
  }
  return enviados;
}

export async function relatorioComparativo(de: Date, ate: Date, label: string): Promise<number> {
  const registros = await buscarRegistrosPeriodo(de, ate);
  if (registros.length === 0) return 0;

  const minPorUsuario = new Map<string, { nome: string; totalMin: number }>();
  for (const r of registros) {
    if (!minPorUsuario.has(r.usuarioId)) minPorUsuario.set(r.usuarioId, { nome: r.usuario.nome, totalMin: 0 });
    minPorUsuario.get(r.usuarioId)!.totalMin += (r.horaFim.getTime() - r.horaInicio.getTime()) / 60000;
  }

  function montarLista(usuarioIds?: string[]) {
    const entradas = Array.from(minPorUsuario.entries()).filter(([id]) => !usuarioIds || usuarioIds.includes(id));
    return entradas
      .map(([, v]) => ({ nome: v.nome, totalHoras: (v.totalMin / 60).toFixed(1) }))
      .sort((a, b) => parseFloat(b.totalHoras) - parseFloat(a.totalHoras));
  }

  let enviados = 0;

  const diretores = await prisma.usuario.findMany({ where: { perfilGlobal: "DIRETORIA", ativo: true }, select: { id: true, email: true } });
  const htmlDiretoria = emailRelatorioHorasComparativoHtml({
    escopo: "Comparativo de todos os operadores.",
    periodo: label,
    porOperador: montarLista(),
    url: `${BASE_URL}/registro-horas/relatorios`,
  });
  for (const d of diretores) {
    await enviarEmail({ para: d.email, assunto: `Comparativo de horas da equipe - ${label}`, html: htmlDiretoria, semCopiaFixa: true });
    enviados++;
  }

  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  for (const setor of setores) {
    const supervisores = await prisma.usuarioSetor.findMany({
      where: { setorId: setor.id, papel: "supervisor", usuario: { ativo: true } },
      select: { usuario: { select: { id: true, nome: true, email: true } } },
    });
    if (supervisores.length === 0) continue;

    const membrosDoSetor = await prisma.usuarioSetor.findMany({
      where: { setorId: setor.id },
      select: { usuarioId: true },
    });
    const idsEquipe = membrosDoSetor.map((m) => m.usuarioId);
    const listaEquipe = montarLista(idsEquipe);
    if (listaEquipe.length === 0) continue;

    const html = emailRelatorioHorasComparativoHtml({
      escopo: `Comparativo dos operadores do setor ${setor.nome}.`,
      periodo: label,
      porOperador: listaEquipe,
      url: `${BASE_URL}/registro-horas/relatorios`,
    });
    for (const s of supervisores) {
      await enviarEmail({ para: s.usuario.email, assunto: `Comparativo de horas - ${setor.nome} - ${label}`, html, semCopiaFixa: true });
      enviados++;
    }
  }

  return enviados;
}

// Dispara os dois relatórios de uma vez pro mesmo período — usado pelo
// disparo manual (o cron chama cada um separadamente, em dias
// configuráveis independentes).
export async function enviarRelatoriosHoras(de: Date, ate: Date, label: string) {
  const [individuais, comparativo] = await Promise.all([
    relatoriosIndividuais(de, ate, label),
    relatorioComparativo(de, ate, label),
  ]);
  return { individuais, comparativo };
}
