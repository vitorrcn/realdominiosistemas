import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RAMOS = [
  "Alimentação e bebidas",
  "Saúde, odontologia, veterinária e pet",
  "Construção civil, engenharia e obras",
  "Marketing, comunicação, audiovisual e eventos",
  "Comércio varejista",
  "Tecnologia, informática e telecom",
  "Moda, vestuário e têxtil",
  "Manutenção, reparos e instalações técnicas",
  "Serviços profissionais, administrativos e consultoria",
  "Comércio atacadista, representação e intermediação",
  "Educação, treinamento e esporte",
  "Imobiliário, condomínios e patrimônio",
  "Terceiro setor e organizações",
  "Indústria, fabricação e gráfica",
  "Transporte, turismo e hospedagem",
  "Beleza, estética e serviços pessoais",
  "Serviços gerais, locação e facilities",
  "Financeiro, seguros e lotéricas",
  "Agro, paisagismo e meio ambiente",
];

async function main() {
  for (let i = 0; i < RAMOS.length; i++) {
    const nome = RAMOS[i];
    await prisma.ramoEmpresa.upsert({
      where: { nome },
      update: { ordem: i },
      create: { nome, ordem: i },
    });
    console.log(`✓ ${nome}`);
  }
  console.log(`\n${RAMOS.length} ramos cadastrados/atualizados com sucesso!`);
}

main()
  .catch((e) => {
    console.error("Erro ao popular ramos:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
