"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

// Convenção de formatação leve: **negrito** e *itálico*, guardados como
// texto puro dentro do próprio campo (sem mudar nada no banco). Mesma
// ideia já usada nos Lembretes da Agenda pro negrito — aqui generalizada
// pra negrito + itálico e reaproveitável em qualquer campo de texto livre.
//
// Renderiza o texto interpretando os marcadores — usar sempre que o
// valor salvo por <CampoTextoFormatado> for exibido em algum lugar fora
// dele (leitura). Preserva quebras de linha desde que o container use
// `whitespace-pre-wrap`.
export function renderTextoFormatado(texto: string): ReactNode[] {
  if (!texto) return [];
  // ***negrito+itálico*** precisa vir ANTES de **negrito** na alternância
  // — clicar em Negrito e depois Itálico sobre a mesma seleção (sem
  // desmarcar) produz exatamente esse padrão de 3 asteriscos, e a ordem
  // errada faria sobrar um "*" solto de fora.
  const partes = texto.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return partes.map((parte, i) => {
    const negritoItalico = parte.match(/^\*\*\*([^*]+)\*\*\*$/);
    if (negritoItalico) return <strong key={i}><em>{negritoItalico[1]}</em></strong>;
    const negrito = parte.match(/^\*\*([^*]+)\*\*$/);
    if (negrito) return <strong key={i}>{negrito[1]}</strong>;
    const italico = parte.match(/^\*([^*]+)\*$/);
    if (italico) return <em key={i}>{italico[1]}</em>;
    return <span key={i}>{parte}</span>;
  });
}

// Textarea com botões de Negrito/Itálico (envolvem a seleção com **/*,
// igual um editor de texto simples) e um botão pra alternar entre editar
// (vê os marcadores) e prévia (vê o resultado formatado) — só um dos
// dois fica visível por vez, nunca os dois juntos.
export function CampoTextoFormatado({
  value,
  onChange,
  minHeightPx = 80,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  minHeightPx?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Abre já em prévia quando já existe texto salvo (nada pra ver na
  // prévia se estiver vazio, aí faz mais sentido abrir direto editando).
  const [previa, setPrevia] = useState(() => !!value);

  function aplicar(marcador: string, textoPadrao: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selecionado = value.slice(start, end);
    const antes = value.slice(0, start);
    const depois = value.slice(end);
    const texto = selecionado || textoPadrao;
    const novo = `${antes}${marcador}${texto}${marcador}${depois}`;
    onChange(novo);
    requestAnimationFrame(() => {
      ta.focus();
      const posIni = start + marcador.length;
      ta.setSelectionRange(posIni, posIni + texto.length);
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={disabled || previa}
            onClick={() => aplicar("**", "negrito")}
            className="w-7 h-7 rounded border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Negrito"
          >
            B
          </button>
          <button
            type="button"
            disabled={disabled || previa}
            onClick={() => aplicar("*", "itálico")}
            className="w-7 h-7 rounded border border-gray-200 text-xs italic text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Itálico"
          >
            I
          </button>
        </div>
        <button
          type="button"
          onClick={() => setPrevia((p) => !p)}
          className="text-xs text-brand-600 hover:underline px-1"
        >
          {previa ? "✏️ Editar" : "👁 Ver prévia"}
        </button>
      </div>
      {previa ? (
        <div
          className="text-sm text-gray-700 whitespace-pre-wrap border border-gray-200 rounded-lg bg-gray-50 px-3 py-2"
          style={{ minHeight: minHeightPx }}
        >
          {value ? renderTextoFormatado(value) : <span className="text-gray-400">(vazio)</span>}
        </div>
      ) : (
        <textarea
          ref={ref}
          className="input"
          style={{ minHeight: minHeightPx }}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
