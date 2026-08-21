"use client";

const GRUPOS: { valor: string; label: string }[] = [
  { valor: "supervisores", label: "Supervisores do setor" },
  { valor: "operadores", label: "Operadores do setor" },
  { valor: "diretoria", label: "Diretoria" },
  { valor: "mordomos", label: "Mordomo(a) da empresa" },
];

// Checkbox "Enviar e-mail" + seleção de quem deve receber. Usado na
// criação de tarefas e eventos.
export function SeletorGruposEmail({
  enviarEmail, grupos, onMudarEnviar, onMudarGrupos,
}: {
  enviarEmail: boolean;
  grupos: string[];
  onMudarEnviar: (v: boolean) => void;
  onMudarGrupos: (v: string[]) => void;
}) {
  function alternar(valor: string) {
    onMudarGrupos(grupos.includes(valor) ? grupos.filter((g) => g !== valor) : [...grupos, valor]);
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 rounded text-brand-600"
          checked={enviarEmail}
          onChange={(e) => onMudarEnviar(e.target.checked)}
        />
        <span className="text-sm font-medium text-gray-700">Enviar e-mail avisando</span>
      </label>
      {enviarEmail && (
        <div className="pl-6 grid grid-cols-2 gap-1.5">
          {GRUPOS.map((g) => (
            <label key={g.valor} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={grupos.includes(g.valor)} onChange={() => alternar(g.valor)} />
              {g.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
