import Link from "next/link";

const itens = [
  {
    href: "/aplicacoes/simulador-tributario",
    icon: "🧮",
    titulo: "Simulador Tributário",
    desc: "Simples Nacional, Lucro Presumido e comparativo entre cenários para apresentar ao cliente",
  },
  {
    href: "/aplicacoes/real-extratos",
    icon: "🏦",
    titulo: "Real Extratos",
    desc: "Converte extrato bancário em PDF para o formato de importação contábil Alterdata, já sugerindo débito/crédito",
  },
];

export default function AplicacoesPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Aplicações</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ferramentas internas de apoio — só geram informação, não alteram nenhum cadastro do sistema.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {itens.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card hover:border-brand-300 transition-colors group flex items-start gap-4"
          >
            <div className="text-2xl">{item.icon}</div>
            <div>
              <div className="text-sm font-semibold text-gray-900 group-hover:text-brand-700">
                {item.titulo}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
