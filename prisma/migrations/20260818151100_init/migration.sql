-- CreateEnum
CREATE TYPE "PerfilGlobal" AS ENUM ('DIRETORIA', 'COORDENADOR', 'LIDER', 'OPERADOR', 'CONSULTA');

-- CreateEnum
CREATE TYPE "StatusEmpresa" AS ENUM ('CADASTRO_INCOMPLETO', 'IMPLANTACAO', 'ATIVA', 'EM_ATENCAO', 'INATIVA', 'ENCERRADA', 'EX_CLIENTE');

-- CreateEnum
CREATE TYPE "RegimeTributario" AS ENUM ('MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'CARNE_LEAO', 'ISENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('PJ', 'PF');

-- CreateEnum
CREATE TYPE "StatusEvento" AS ENUM ('NAO_INICIADO', 'EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO', 'AGUARDANDO_SETOR', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('NAO_INICIADO', 'EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO', 'AGUARDANDO_SETOR', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusObrigacao" AS ENUM ('NAO_INICIADO', 'EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'RECEBIDO_PARCIALMENTE', 'RECEBIDO', 'ENVIADO', 'CONCLUIDO', 'NAO_SE_APLICA', 'EM_ATRASO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfilGlobal" "PerfilGlobal" NOT NULL DEFAULT 'OPERADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "podeVerComercial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_setores" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "setorId" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'membro',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "codigoInterno" TEXT NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL DEFAULT 'PJ',
    "cnpj" TEXT,
    "cpf" TEXT,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "municipio" TEXT,
    "bairro" TEXT,
    "estado" TEXT,
    "endereco" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "cep" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "inscricaoMunicipal" TEXT,
    "inscricaoEstadual" TEXT,
    "capitalSocial" DECIMAL(14,2),
    "cnae" TEXT,
    "dataAbertura" TIMESTAMP(3),
    "status" "StatusEmpresa" NOT NULL DEFAULT 'CADASTRO_INCOMPLETO',
    "dataEntrada" TIMESTAMP(3),
    "dataSaida" TIMESTAMP(3),
    "empresaBaixada" BOOLEAN NOT NULL DEFAULT false,
    "obsCritica" TEXT,
    "obsAtual" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "respFiscalId" TEXT,
    "respContabilId" TEXT,
    "respDpId" TEXT,
    "respSocietId" TEXT,
    "respCarteiraId" TEXT,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3),
    "estadoCivil" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "conjugeId" TEXT,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa_pessoas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "percentualParticipacao" DECIMAL(5,2),
    "eAdministrador" BOOLEAN NOT NULL DEFAULT false,
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoa_dependentes" (
    "id" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "dependenteId" TEXT NOT NULL,
    "parentesco" TEXT,

    CONSTRAINT "pessoa_dependentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "regimeTributario" "RegimeTributario",
    "inicioRegime" TIMESTAMP(3),
    "ultimaRevisao" TIMESTAMP(3),
    "proximaRevisao" TIMESTAMP(3),
    "inscricaoEstadual" TEXT,
    "inscricaoMunicipal" TEXT,
    "acessoEstado" TEXT,
    "acessoPrefeitura" TEXT,
    "parcelamentoAtivo" BOOLEAN NOT NULL DEFAULT false,
    "qtdParcelamentos" INTEGER NOT NULL DEFAULT 0,
    "orgaoParcelamento" TEXT,
    "situacaoParcelamento" TEXT,
    "possuiDebitos" BOOLEAN NOT NULL DEFAULT false,
    "prefEnvioGuia" TEXT,
    "diaPrefEnvio" INTEGER,
    "observacoes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contabil" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ultimoFechamento" TIMESTAMP(3),
    "qtdContasBancarias" INTEGER NOT NULL DEFAULT 0,
    "contaPrincipal" TEXT,
    "pessoaExtratos" TEXT,
    "formaExtratos" TEXT,
    "obsExtratos" TEXT,
    "possuiEmprestimo" BOOLEAN NOT NULL DEFAULT false,
    "possuiFinanciamento" BOOLEAN NOT NULL DEFAULT false,
    "ultimoResultado" TEXT,
    "competenciaResult" TEXT,
    "confiabilidade" TEXT,
    "situacaoImovel" TEXT,
    "ramoId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contabil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ramos_empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ramos_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dp" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "possuiFuncionarios" BOOLEAN NOT NULL DEFAULT false,
    "qtdFuncionarios" INTEGER NOT NULL DEFAULT 0,
    "possuiProlabore" BOOLEAN NOT NULL DEFAULT false,
    "qtdSociosfolha" INTEGER NOT NULL DEFAULT 0,
    "possuiInssPatronal" BOOLEAN NOT NULL DEFAULT false,
    "possuiPisFolha" BOOLEAN NOT NULL DEFAULT false,
    "rat" DECIMAL(5,2),
    "fap" DECIMAL(5,4),
    "terceiros" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "societario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "contratoAtualizado" BOOLEAN NOT NULL DEFAULT false,
    "ultimaAlteracaoContr" TIMESTAMP(3),
    "certificadoDigital" BOOLEAN NOT NULL DEFAULT false,
    "tipoCertificado" TEXT,
    "situacaoCertificado" TEXT,
    "vencimentoCertificado" TIMESTAMP(3),
    "procuracaoRF" BOOLEAN NOT NULL DEFAULT false,
    "procuracaoEstado" BOOLEAN NOT NULL DEFAULT false,
    "procuracaoMunicipio" BOOLEAN NOT NULL DEFAULT false,
    "acessoRF" TEXT,
    "acessoEstado" TEXT,
    "acessoMunicipio" TEXT,
    "licencas" TEXT,
    "alvaras" TEXT,
    "observacoes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "societario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relacionamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ultimoContato" TIMESTAMP(3),
    "ultimaReuniao" TIMESTAMP(3),
    "ultimaVisita" TIMESTAMP(3),
    "formaPrefContato" TEXT,
    "tempoResposta" TEXT,
    "perfilCliente" TEXT,
    "observacoes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relacionamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comercial" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "origem" TEXT,
    "quemIndicou" TEXT,
    "motivoContratacao" TEXT,
    "honorarios" DECIMAL(10,2),
    "contrato" TEXT,
    "dataEntrada" TIMESTAMP(3),
    "motivoSaida" TEXT,
    "descricaoSaida" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "irpf" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "declaracaoEntregue" BOOLEAN NOT NULL DEFAULT false,
    "imoveis" TEXT,
    "participacoes" TEXT,
    "investimentos" TEXT,
    "patrimonio" TEXT,
    "contasBancarias" TEXT,
    "observacoes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "irpf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_evento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "setorId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipoEventoId" TEXT,
    "respGeralId" TEXT,
    "setorAtualId" TEXT,
    "respAtualId" TEXT,
    "dataAbertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazo" TIMESTAMP(3),
    "status" "StatusEvento" NOT NULL DEFAULT 'NAO_INICIADO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_historico" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,
    "statusAnterior" TEXT,
    "statusNovo" TEXT,

    CONSTRAINT "evento_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "eventoId" TEXT,
    "setorId" TEXT,
    "responsavelId" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataInicio" TIMESTAMP(3),
    "prazo" TIMESTAMP(3),
    "dataConclusao" TIMESTAMP(3),
    "status" "StatusTarefa" NOT NULL DEFAULT 'NAO_INICIADO',
    "motivoAtraso" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obrigacao_templates" (
    "id" TEXT NOT NULL,
    "setorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obrigacao_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obrigacao_empresas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "setorId" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obrigacao_empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obrigacao_instancias" (
    "id" TEXT NOT NULL,
    "obrigacaoEmpresaId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "competencia" TEXT NOT NULL,
    "status" "StatusObrigacao" NOT NULL DEFAULT 'NAO_INICIADO',
    "dataConclusao" TIMESTAMP(3),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obrigacao_instancias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "pessoaId" TEXT,
    "tipoDocumento" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "urlStorage" TEXT NOT NULL,
    "tamanhoBytes" INTEGER,
    "uploadedById" TEXT,
    "dataUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validade" TIMESTAMP(3),
    "observacoes" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obs_historico" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "texto" TEXT NOT NULL,

    CONSTRAINT "obs_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "campo" TEXT,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "acao" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_itens" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT,
    "horaFim" TEXT,
    "diaTodo" BOOLEAN NOT NULL DEFAULT false,
    "tipo" TEXT NOT NULL DEFAULT 'COMPROMISSO',
    "setorId" TEXT,
    "usuarioId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acessos_sistema" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "setorId" TEXT NOT NULL,
    "nomeSistema" TEXT NOT NULL,
    "link" TEXT,
    "usuario" TEXT,
    "senhaCifrada" TEXT,
    "observacao" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acessos_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_email" (
    "id" TEXT NOT NULL DEFAULT 'config',
    "gmailUser" TEXT,
    "gmailSenhaCifrada" TEXT,
    "atualizadoPorId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "entidadeTipo" TEXT,
    "entidadeId" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "setores_nome_key" ON "setores"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_setores_usuarioId_setorId_key" ON "usuario_setores"("usuarioId", "setorId");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_codigoInterno_key" ON "empresas"("codigoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cpf_key" ON "empresas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_cpf_key" ON "pessoas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_pessoas_empresaId_pessoaId_key" ON "empresa_pessoas"("empresaId", "pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "pessoa_dependentes_responsavelId_dependenteId_key" ON "pessoa_dependentes"("responsavelId", "dependenteId");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_empresaId_key" ON "fiscal"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "contabil_empresaId_key" ON "contabil"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "ramos_empresa_nome_key" ON "ramos_empresa"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "dp_empresaId_key" ON "dp"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "societario_empresaId_key" ON "societario"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "relacionamento_empresaId_key" ON "relacionamento"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "comercial_empresaId_key" ON "comercial"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "irpf_pessoaId_ano_key" ON "irpf"("pessoaId", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "obrigacao_empresas_empresaId_templateId_key" ON "obrigacao_empresas"("empresaId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "obrigacao_instancias_obrigacaoEmpresaId_competencia_key" ON "obrigacao_instancias"("obrigacaoEmpresaId", "competencia");

-- AddForeignKey
ALTER TABLE "usuario_setores" ADD CONSTRAINT "usuario_setores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_setores" ADD CONSTRAINT "usuario_setores_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_respFiscalId_fkey" FOREIGN KEY ("respFiscalId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_respContabilId_fkey" FOREIGN KEY ("respContabilId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_respDpId_fkey" FOREIGN KEY ("respDpId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_respSocietId_fkey" FOREIGN KEY ("respSocietId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_respCarteiraId_fkey" FOREIGN KEY ("respCarteiraId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_conjugeId_fkey" FOREIGN KEY ("conjugeId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_pessoas" ADD CONSTRAINT "empresa_pessoas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_pessoas" ADD CONSTRAINT "empresa_pessoas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoa_dependentes" ADD CONSTRAINT "pessoa_dependentes_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoa_dependentes" ADD CONSTRAINT "pessoa_dependentes_dependenteId_fkey" FOREIGN KEY ("dependenteId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal" ADD CONSTRAINT "fiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabil" ADD CONSTRAINT "contabil_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contabil" ADD CONSTRAINT "contabil_ramoId_fkey" FOREIGN KEY ("ramoId") REFERENCES "ramos_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dp" ADD CONSTRAINT "dp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "societario" ADD CONSTRAINT "societario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relacionamento" ADD CONSTRAINT "relacionamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercial" ADD CONSTRAINT "comercial_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "irpf" ADD CONSTRAINT "irpf_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_evento" ADD CONSTRAINT "tipos_evento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_tipoEventoId_fkey" FOREIGN KEY ("tipoEventoId") REFERENCES "tipos_evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_setorAtualId_fkey" FOREIGN KEY ("setorAtualId") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_respAtualId_fkey" FOREIGN KEY ("respAtualId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_historico" ADD CONSTRAINT "evento_historico_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_historico" ADD CONSTRAINT "evento_historico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obrigacao_templates" ADD CONSTRAINT "obrigacao_templates_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obrigacao_empresas" ADD CONSTRAINT "obrigacao_empresas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obrigacao_empresas" ADD CONSTRAINT "obrigacao_empresas_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "obrigacao_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obrigacao_instancias" ADD CONSTRAINT "obrigacao_instancias_obrigacaoEmpresaId_fkey" FOREIGN KEY ("obrigacaoEmpresaId") REFERENCES "obrigacao_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obrigacao_instancias" ADD CONSTRAINT "obrigacao_instancias_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obs_historico" ADD CONSTRAINT "obs_historico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_itens" ADD CONSTRAINT "agenda_itens_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_itens" ADD CONSTRAINT "agenda_itens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_itens" ADD CONSTRAINT "agenda_itens_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_sistema" ADD CONSTRAINT "acessos_sistema_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_sistema" ADD CONSTRAINT "acessos_sistema_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_sistema" ADD CONSTRAINT "acessos_sistema_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
