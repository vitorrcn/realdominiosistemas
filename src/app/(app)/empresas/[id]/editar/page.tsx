"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEmpresa } from "@/hooks/useEmpresa";
import { STATUS_EMPRESA_LABEL } from "@/types";
import { StatusEmpresa } from "@prisma/client";

interface UsuarioOpcao {
  id: string;
  nome: string;
}

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function EditarEmpresaPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isDiretoria = (session?.user as any)?.perfilGlobal === "DIRETORIA";
  const [excluindo, setExcluindo] = useState(false);

  async function excluirCliente() {
    const nome = empresa?.razaoSocial ?? "este cliente";
    const confirmado = confirm(
      `Excluir "${nome}"? O cadastro sai da lista de Clientes, mas o histórico fica guardado ` +
      `(pode ser restaurado depois, se precisar). Continuar?`
    );
    if (!confirmado) return;
    setExcluindo(true);
    const res = await fetch(`/api/empresas/${params.id}`, { method: "DELETE" });
    setExcluindo(false);
    if (res.ok) {
      router.push("/empresas");
    } else {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Erro ao excluir cliente.");
    }
  }

  const { empresa, carregando, erro, atualizarGeral } = useEmpresa(params.id);
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  // Inicializa o formulário assim que a empresa carrega
  useEffect(() => {
    if (empresa && !form) {
      setForm({
        razaoSocial:    empresa.razaoSocial ?? "",
        nomeFantasia:   empresa.nomeFantasia ?? "",
        municipio:      empresa.municipio ?? "",
        bairro:         empresa.bairro ?? "",
        estado:         empresa.estado ?? "",
        endereco:       empresa.endereco ?? "",
        numero:         empresa.numero ?? "",
        complemento:    empresa.complemento ?? "",
        cep:            empresa.cep ?? "",
        telefone:       empresa.telefone ?? "",
        email:          empresa.email ?? "",
        inscricaoMunicipal: empresa.inscricaoMunicipal ?? "",
        inscricaoEstadual:  empresa.inscricaoEstadual ?? "",
        capitalSocial:  empresa.capitalSocial ?? "",
        cnae:           empresa.cnae ?? "",
        dataAbertura:   empresa.dataAbertura ? String(empresa.dataAbertura).slice(0, 10) : "",
        dataEntrada:    empresa.dataEntrada ? String(empresa.dataEntrada).slice(0, 10) : "",
        dataSaida:      empresa.dataSaida ? String(empresa.dataSaida).slice(0, 10) : "",
        empresaBaixada: empresa.empresaBaixada ?? false,
        status:         empresa.status ?? "CADASTRO_INCOMPLETO",
        obsAtual:       empresa.obsAtual ?? "",
        obsCritica:     empresa.obsCritica ?? "",
        respFiscalId:   empresa.respFiscal?.id ?? "",
        respContabilId: empresa.respContabil?.id ?? "",
        respDpId:       empresa.respDp?.id ?? "",
        respSocietId:   empresa.respSocietario?.id ?? "",
        respCarteiraId: empresa.respCarteira?.id ?? "",
        respLiderId:      empresa.respLider?.id ?? "",
        respSupervisorId: empresa.respSupervisor?.id ?? "",
      });
    }
  }, [empresa, form]);

  const set = (k: string, v: any) => setForm((p) => ({ ...(p as any), [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSalvando(true);
    setErroSalvar(null);

    // Datas vazias precisam virar null, não string vazia
    const payload = {
      ...form,
      dataAbertura: form.dataAbertura || null,
      dataEntrada:  form.dataEntrada  || null,
      dataSaida:    form.dataSaida,
      empresaBaixada: form.empresaBaixada,
      respFiscalId:   form.respFiscalId   || null,
      respContabilId: form.respContabilId || null,
      respDpId:       form.respDpId       || null,
      respSocietId:   form.respSocietId   || null,
      respCarteiraId: form.respCarteiraId || null,
      respLiderId:      form.respLiderId      || null,
      respSupervisorId: form.respSupervisorId || null,
    };

    const resultado = await atualizarGeral(payload);
    setSalvando(false);
    if (resultado.ok) {
      const avisos = (resultado as any).avisos as string[] | undefined;
      if (avisos && avisos.length > 0) {
        alert(
          "Salvo! Mas antes de sair de \"Cadastro incompleto\", repare que ainda falta:\n\n" +
          avisos.map((a) => `• ${a}`).join("\n")
        );
      }
      router.push(`/empresas/${params.id}`);
    } else {
      setErroSalvar((resultado as any).erro ?? "Erro ao salvar. Verifique os campos e tente novamente.");
    }
  }

  if (carregando || !form) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <svg className="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Carregando...
    </div>
  );

  if (erro || !empresa) return (
    <div className="card text-center py-12 text-red-500">
      {erro ?? "Empresa não encontrada"}
    </div>
  );

  const RESPONSAVEIS = [
    { key: "respCarteiraId",   label: "Operador responsável" },
    { key: "respLiderId",      label: "Líder responsável" },
    { key: "respSupervisorId", label: "Supervisor responsável" },
    { key: "respFiscalId",   label: "Responsável Fiscal" },
    { key: "respContabilId", label: "Responsável Contábil" },
    { key: "respDpId",       label: "Responsável DP" },
    { key: "respSocietId",   label: "Responsável Societário" },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/empresas" className="hover:text-gray-900">Clientes</Link>
        <span>/</span>
        <Link href={`/empresas/${params.id}`} className="hover:text-gray-900">{empresa.razaoSocial}</Link>
        <span>/</span>
        <span className="text-gray-900">Editar cadastro</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Dados básicos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Razão Social</label>
              <input className="input" value={form.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="label">Nome Fantasia</label>
              <input className="input" value={form.nomeFantasia} onChange={(e) => set("nomeFantasia", e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {Object.entries(STATUS_EMPRESA_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Localização</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">Endereço</label>
              <input className="input" value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, avenida..." />
            </div>
            <div>
              <label className="label">Complemento</label>
              <input className="input" value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Município</label>
              <input className="input" value={form.municipio} onChange={(e) => set("municipio", e.target.value)} />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="select" value={form.estado} onChange={(e) => set("estado", e.target.value)}>
                <option value="">UF</option>
                {ESTADOS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bairro</label>
              <input className="input" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div>
              <label className="label">CEP</label>
              <input className="input" value={form.cep} onChange={(e) => set("cep", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Contato e dados fiscais</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">E-mail</label>
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="label">Inscrição Municipal</label>
              <input className="input" value={form.inscricaoMunicipal} onChange={(e) => set("inscricaoMunicipal", e.target.value)} />
            </div>
            <div>
              <label className="label">Inscrição Estadual</label>
              <input className="input" value={form.inscricaoEstadual} onChange={(e) => set("inscricaoEstadual", e.target.value)} />
            </div>
            <div>
              <label className="label">CNAE</label>
              <input className="input" value={form.cnae} onChange={(e) => set("cnae", e.target.value)} />
            </div>
            <div>
              <label className="label">Capital Social (R$)</label>
              <input className="input" type="number" step="0.01" value={form.capitalSocial} onChange={(e) => set("capitalSocial", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Datas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Data de abertura da empresa</label>
              <input className="input" type="date" value={form.dataAbertura} onChange={(e) => set("dataAbertura", e.target.value)} />
            </div>
            <div>
              <label className="label">Data de entrada no escritório</label>
              <input className="input" type="date" value={form.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} />
            </div>
            <div>
              <label className="label">Data de saída (se ex-cliente)</label>
              <input className="input" type="date" value={form.dataSaida} onChange={(e) => set("dataSaida", e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">
                Preencher aqui não muda o status automaticamente — lembre de marcar &quot;Ex-cliente&quot; no Status acima também.
              </p>
            </div>
            <div className="md:col-span-2 flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="empresaBaixada"
                className="w-4 h-4 rounded text-red-600"
                checked={form.empresaBaixada}
                onChange={(e) => set("empresaBaixada", e.target.checked)}
              />
              <label htmlFor="empresaBaixada" className="text-sm text-gray-700 cursor-pointer">
                Empresa baixada (encerrou as atividades / CNPJ baixado na Receita)
              </label>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Responsáveis</h2>
          <p className="text-xs text-gray-400 -mt-2">
            Operador, líder e supervisor são os responsáveis gerais pelo cliente. Os quatro últimos
            são específicos de cada setor.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RESPONSAVEIS.map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <select className="select" value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)}>
                  <option value="">Não atribuído</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Observações</h2>
          <div>
            <label className="label">Observação atual</label>
            <textarea className="input min-h-[70px]" value={form.obsAtual ?? ""} onChange={(e) => set("obsAtual", e.target.value)} />
          </div>
          <div>
            <label className="label">Observação crítica (destaque em vermelho na tela da empresa)</label>
            <textarea className="input min-h-[70px]" value={form.obsCritica ?? ""} onChange={(e) => set("obsCritica", e.target.value)} />
          </div>
        </div>

        {erroSalvar && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-sm text-red-700">{erroSalvar}</span>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href={`/empresas/${params.id}`} className="btn">Cancelar</Link>
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>

      {isDiretoria && (
        <div className="card border-2 border-red-200 bg-red-50/40 space-y-3">
          <h2 className="text-sm font-semibold text-red-900">Zona de perigo</h2>
          <p className="text-sm text-red-700">
            Excluir este cliente tira ele da lista de Clientes e das telas de Setor. O histórico
            (obrigações, eventos, documentos) fica guardado no banco, não é apagado — só fica oculto.
          </p>
          <button
            type="button"
            onClick={excluirCliente}
            disabled={excluindo}
            className="btn bg-red-600 text-white hover:bg-red-700"
          >
            {excluindo ? "Excluindo..." : "Excluir este cliente"}
          </button>
        </div>
      )}
    </div>
  );
}
