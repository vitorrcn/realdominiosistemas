"use client";

import { useState, useEffect } from "react";
import { formatData } from "@/lib/utils";

interface StatusBackup {
  totalEmpresas: number;
  totalPessoas: number;
  totalObrigacoes: number;
  totalEventos: number;
  ultimaAtividade: string | null;
  dataHoraServidor: string;
}

export default function BackupPage() {
  const [status, setStatus] = useState<StatusBackup | null>(null);
  const [baixando, setBaixando] = useState<"json" | "excel" | null>(null);

  useEffect(() => {
    fetch("/api/backup?formato=status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function baixar(formato: "json" | "excel") {
    setBaixando(formato);
    try {
      const res = await fetch(`/api/backup?formato=${formato}`);
      if (!res.ok) throw new Error("Erro ao gerar backup");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const data = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `realdominio_backup_${data}.${formato === "json" ? "json" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erro ao baixar backup. Tente novamente.");
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Estado atual do banco */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Estado atual do banco de dados
        </h2>
        {status ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Empresas cadastradas", value: status.totalEmpresas },
              { label: "Obrigações registradas", value: status.totalObrigacoes },
              { label: "Eventos registrados",  value: status.totalEventos },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-xl font-semibold text-gray-900 mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">Carregando...</div>
        )}
        {status && (
          <div className="mt-3 text-xs text-gray-400">
            Última atividade: {status.ultimaAtividade ? formatData(status.ultimaAtividade) : "—"} ·
            Servidor: {new Date(status.dataHoraServidor).toLocaleString("pt-BR")}
          </div>
        )}
      </div>

      {/* Exportar backup */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Exportar backup agora</h2>
          <p className="text-xs text-gray-500 mt-1">
            Exporta <strong>todos os dados</strong> do sistema. Guarde o arquivo em local seguro
            (HD externo, pen drive ou Google Drive).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* JSON */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Backup JSON</div>
                <div className="text-xs text-gray-400">Reimportável no sistema</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Formato completo com todos os dados. Pode ser usado para restaurar o sistema
              em caso de perda total.
            </p>
            <button
              onClick={() => baixar("json")}
              disabled={baixando === "json"}
              className="btn btn-primary btn-sm w-full justify-center"
            >
              {baixando === "json" ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Gerando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar JSON
                </>
              )}
            </button>
          </div>

          {/* Excel */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Backup Excel</div>
                <div className="text-xs text-gray-400">Para visualização humana</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Planilha com abas separadas para clientes, obrigações, eventos e usuários.
              Ideal para análises e relatórios externos.
            </p>
            <button
              onClick={() => baixar("excel")}
              disabled={baixando === "excel"}
              className="btn btn-sm w-full justify-center border-green-200 text-green-700 hover:bg-green-50"
            >
              {baixando === "excel" ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Gerando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar Excel
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Backup automático */}
      <div className="card border-green-200 bg-green-50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-green-800">Backup automático ativo</div>
            <div className="text-xs text-green-700 mt-1 leading-relaxed">
              O sistema realiza backup automático do banco de dados <strong>todo dia à meia-noite</strong>.
              Os arquivos ficam salvos na pasta <code className="font-mono bg-green-100 px-1 rounded">backups/</code> do servidor
              e são mantidos por <strong>30 dias</strong>. Não é necessário fazer nada — funciona sozinho.
            </div>
          </div>
        </div>
      </div>

      {/* Aviso importante */}
      <div className="card border-yellow-200 bg-yellow-50">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <div className="text-sm font-semibold text-yellow-800">Recomendação importante</div>
            <div className="text-xs text-yellow-700 mt-1 leading-relaxed">
              Além do backup automático no servidor, recomendamos exportar o backup JSON <strong>manualmente
              ao menos uma vez por semana</strong> e guardar em local separado (HD externo, Google Drive, etc).
              Se o servidor tiver um problema físico, os backups automáticos podem ser perdidos junto com ele.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
