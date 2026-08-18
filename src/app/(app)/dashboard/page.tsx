import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCompetencia } from "@/lib/utils";
import { atualizarObrigacoesEmAtraso } from "@/lib/obrigacoes";
import EntradasSaidasClientes from "@/components/dashboard/EntradasSaidasClientes";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const perfil = user?.perfilGlobal ?? "OPERADOR";

  // Mantém o status "Em atraso" em dia mesmo pra quem não visitou a tela
  // de Obrigações — assim o card do dashboard sempre reflete a realidade.
  await atualizarObrigacoesEmAtraso();

  const hoje = new Date();
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // Dados para todos os perfis
  const [
    totalEmpresas,
    totalAtivas,
    totalAtencao,
    obrigacoesAtrasadas,
    eventosAbertos,
  ] = await Promise.all([
    prisma.empresa.count({ where: { deletedAt: null, ativo: true } }),
    prisma.empresa.count({ where: { deletedAt: null, ativo: true, status: "ATIVA" } }),
    prisma.empresa.count({ where: { deletedAt: null, ativo: true, status: "EM_ATENCAO" } }),
    prisma.obrigacaoInstancia.count({ where: { competencia, status: "EM_ATRASO" } }),
    prisma.evento.count({ where: { deletedAt: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] } } }),
  ]);

  const cards = [
    { label: "Total de empresas",    value: totalEmpresas,        cor: "text-gray-900" },
    { label: "Empresas ativas",       value: totalAtivas,          cor: "text-green-700" },
    { label: "Em atenção",            value: totalAtencao,         cor: "text-yellow-600" },
    { label: "Obrigações em atraso",  value: obrigacoesAtrasadas,  cor: "text-red-600" },
    { label: "Eventos abertos",       value: eventosAbertos,       cor: "text-brand-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          Competência atual: <span className="font-medium text-gray-700">{formatCompetencia(competencia)}</span>
        </p>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="metric-card">
            <div className="metric-label">{c.label}</div>
            <div className={`metric-value ${c.cor}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Acesso rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/empresas" className="card hover:border-brand-200 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
              <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Clientes</div>
              <div className="text-xs text-gray-400">Ver cadastro completo</div>
            </div>
          </div>
        </a>

        <a href="/obrigacoes" className="card hover:border-brand-200 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Obrigações</div>
              <div className="text-xs text-gray-400">{formatCompetencia(competencia)}</div>
            </div>
          </div>
        </a>

        <a href="/backup" className="card hover:border-green-200 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Backup</div>
              <div className="text-xs text-gray-400">Exportar dados agora</div>
            </div>
          </div>
        </a>
      </div>

      {perfil === "DIRETORIA" && (
        <div className="pt-2 border-t border-gray-100 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Relatórios e Análises</h2>
          <EntradasSaidasClientes />
        </div>
      )}
    </div>
  );
}
