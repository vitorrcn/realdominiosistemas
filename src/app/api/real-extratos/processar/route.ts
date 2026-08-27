import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { detectarBanco } from "@/lib/real-extratos/detectarBanco";
import { PARSERS } from "@/lib/real-extratos/parsers";
import { Classifier, parseBalanceteFornecedores } from "@/lib/real-extratos/classifier";
import type { ConfigRealExtratos, Lancamento } from "@/lib/real-extratos/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/real-extratos/processar
// multipart/form-data: extrato (PDF, obrigatório), balancete (PDF, opcional),
// config (JSON: contas contábeis + regras + sócio).
//
// Detecta o banco, roda o parser correspondente e já devolve os
// lançamentos classificados (débito/crédito sugeridos) — a pessoa revisa
// e ajusta na tela seguinte antes de exportar.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const extrato = formData.get("extrato") as File | null;
    const balancete = formData.get("balancete") as File | null;
    const configRaw = formData.get("config") as string | null;

    if (!extrato) {
      return NextResponse.json({ error: "Selecione o arquivo de extrato bancário (PDF)." }, { status: 400 });
    }
    if (!configRaw) {
      return NextResponse.json({ error: "Configuração de contas contábeis não enviada." }, { status: 400 });
    }

    const config = JSON.parse(configRaw) as ConfigRealExtratos;
    const camposObrigatorios: (keyof ConfigRealExtratos)[] = [
      "conta_banco", "conta_receita", "conta_socio", "conta_despesas", "conta_padrao",
    ];
    const faltando = camposObrigatorios.filter((c) => !config[c] || !String(config[c]).trim());
    if (faltando.length) {
      return NextResponse.json({ error: `Preencha as contas contábeis obrigatórias: ${faltando.join(", ")}` }, { status: 400 });
    }

    const extratoBuffer = Buffer.from(await extrato.arrayBuffer());

    const deteccao = await detectarBanco(extratoBuffer);
    const parserId = deteccao?.parserId ?? "universal";
    const bancoKey = deteccao?.bancoKey ?? null;
    const descricao = deteccao?.descricao ?? "Banco não reconhecido — usando leitor universal";

    const parser = PARSERS[parserId];
    let transacoes;
    try {
      transacoes = await parser(extratoBuffer);
    } catch (e: any) {
      console.error("Erro ao ler extrato:", e);
      return NextResponse.json(
        { error: "Não foi possível ler o extrato. Confira se o arquivo é um PDF de extrato bancário válido.", detalhe: e?.message },
        { status: 400 }
      );
    }

    if (!transacoes.length) {
      return NextResponse.json(
        { error: `Nenhum lançamento foi encontrado no PDF (${bancoKey ?? "banco não reconhecido"}). Verifique se o arquivo é o extrato correto.` },
        { status: 400 }
      );
    }

    // Balancete: lido de novo a cada importação, nunca fica salvo.
    let fornecedores: Awaited<ReturnType<typeof parseBalanceteFornecedores>> = [];
    if (balancete) {
      try {
        const balanceteBuffer = Buffer.from(await balancete.arrayBuffer());
        fornecedores = await parseBalanceteFornecedores(balanceteBuffer);
      } catch (e) {
        console.error("Erro ao ler balancete (ignorado, seguindo sem fornecedores):", e);
      }
    }

    const classifier = new Classifier({
      conta_banco: config.conta_banco,
      conta_receita: config.conta_receita || config.conta_padrao,
      conta_socio: config.conta_socio,
      conta_despesas: config.conta_despesas,
      conta_padrao: config.conta_padrao,
      nome_socio: config.nome_socio,
      rules: config.rules ?? [],
      fornecedores,
    });

    const lancamentos: Lancamento[] = transacoes.map((txn) => {
      const [debit, credit, categoria, origem] = classifier.classify(txn);
      return {
        date: txn.date,
        description: txn.description.trim(),
        debit,
        credit,
        value: txn.value,
        categoria,
        origem,
      };
    });

    return NextResponse.json({
      banco: bancoKey,
      descricao,
      bancoReconhecido: !!deteccao,
      fornecedoresEncontrados: fornecedores.length,
      lancamentos,
    });
  } catch (e: any) {
    console.error("Erro ao processar extrato:", e);
    return NextResponse.json({ error: "Erro ao processar o extrato.", detalhe: e?.message }, { status: 500 });
  }
}
