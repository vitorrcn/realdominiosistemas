import { PrismaClient, PerfilGlobal } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  // ── Setores padrão ──────────────────────────────────────────
  const setores = await Promise.all([
    prisma.setor.upsert({
      where: { nome: "Fiscal" },
      update: {},
      create: { nome: "Fiscal", descricao: "Departamento Fiscal", ordem: 1 },
    }),
    prisma.setor.upsert({
      where: { nome: "Contábil" },
      update: {},
      create: { nome: "Contábil", descricao: "Departamento Contábil", ordem: 2 },
    }),
    prisma.setor.upsert({
      where: { nome: "Departamento Pessoal" },
      update: {},
      create: { nome: "Departamento Pessoal", descricao: "DP / RH", ordem: 3 },
    }),
    prisma.setor.upsert({
      where: { nome: "Societário" },
      update: {},
      create: { nome: "Societário", descricao: "Departamento Societário", ordem: 4 },
    }),
  ]);

  const [fiscal, contabil, dp, societario] = setores;
  console.log("✅ Setores criados");

  // ── Usuário administrador padrão ─────────────────────────────
  const senhaHash = await bcrypt.hash("Admin@2025", 12);
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@realdominio.com.br" },
    update: {},
    create: {
      nome: "Administrador",
      email: "admin@realdominio.com.br",
      senhaHash,
      perfilGlobal: PerfilGlobal.DIRETORIA,
      podeVerComercial: true,
    },
  });
  console.log("✅ Usuário admin criado — email: admin@realdominio.com.br / senha: Admin@2025");

  // ── Templates de obrigações — Fiscal ─────────────────────────
  const obrigacoesFiscais = [
    "PGDAS / Simples Nacional enviado",
    "REINF",
    "DCTFWeb / DCTF",
    "DEFIS",
    "SPED Fiscal",
    "GIA / DeSTDA",
    "Obrigações municipais",
    "Guias de ICMS",
  ];

  for (let i = 0; i < obrigacoesFiscais.length; i++) {
    await prisma.obrigacaoTemplate.upsert({
      where: { id: `fiscal-${i}` },
      update: {},
      create: {
        id: `fiscal-${i}`,
        setorId: fiscal.id,
        nome: obrigacoesFiscais[i],
        ordem: i + 1,
      },
    });
  }

  // ── Templates de obrigações — Contábil ───────────────────────
  const obrigacoesContabeis = [
    "Cobrança de extrato bancário",
    "Exportação fiscal",
    "Exportação contábil",
    "Importação dos extratos",
    "Fechamento contábil",
  ];

  for (let i = 0; i < obrigacoesContabeis.length; i++) {
    await prisma.obrigacaoTemplate.upsert({
      where: { id: `contabil-${i}` },
      update: {},
      create: {
        id: `contabil-${i}`,
        setorId: contabil.id,
        nome: obrigacoesContabeis[i],
        ordem: i + 1,
      },
    });
  }

  // ── Templates de obrigações — DP ─────────────────────────────
  const obrigacoesDp = [
    "Solicitação de informações da folha",
    "Folha de pagamento concluída",
    "eSocial",
    "FGTS",
    "INSS",
    "Pró-labore",
  ];

  for (let i = 0; i < obrigacoesDp.length; i++) {
    await prisma.obrigacaoTemplate.upsert({
      where: { id: `dp-${i}` },
      update: {},
      create: {
        id: `dp-${i}`,
        setorId: dp.id,
        nome: obrigacoesDp[i],
        ordem: i + 1,
      },
    });
  }

  // ── Templates de obrigações — Societário ─────────────────────
  const obrigacoesSociet = [
    "Certificado digital conferido",
    "Procuração conferida",
    "Processo cadastral",
    "Licença / Alvará",
  ];

  for (let i = 0; i < obrigacoesSociet.length; i++) {
    await prisma.obrigacaoTemplate.upsert({
      where: { id: `societ-${i}` },
      update: {},
      create: {
        id: `societ-${i}`,
        setorId: societario.id,
        nome: obrigacoesSociet[i],
        ordem: i + 1,
      },
    });
  }

  console.log("✅ Templates de obrigações criados");

  // ── Tipos de evento padrão ────────────────────────────────────
  const tiposEvento = [
    { nome: "Abertura de empresa",        setorId: societario.id },
    { nome: "Alteração contratual",       setorId: societario.id },
    { nome: "Certificado digital",        setorId: societario.id },
    { nome: "Procuração",                 setorId: societario.id },
    { nome: "Fiscalização",               setorId: fiscal.id },
    { nome: "Parcelamento",               setorId: fiscal.id },
    { nome: "Revisão tributária",         setorId: fiscal.id },
    { nome: "Regularização fiscal",       setorId: fiscal.id },
    { nome: "Encerramento de empresa",    setorId: societario.id },
    { nome: "Processo trabalhista",       setorId: dp.id },
    { nome: "Auditoria contábil",         setorId: contabil.id },
    { nome: "Outro",                      setorId: null },
  ];

  for (const tipo of tiposEvento) {
    await prisma.tipoEvento.upsert({
      where: { id: tipo.nome.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: tipo.nome.toLowerCase().replace(/\s+/g, "-"),
        nome: tipo.nome,
        setorId: tipo.setorId,
      },
    });
  }

  console.log("✅ Tipos de evento criados");
  console.log("\n🎉 Seed concluído com sucesso!");
  console.log("\n📋 ACESSO INICIAL:");
  console.log("   URL:   http://localhost:3000");
  console.log("   Email: admin@realdominio.com.br");
  console.log("   Senha: Admin@2025");
  console.log("\n⚠️  Altere a senha do admin no primeiro acesso!\n");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
