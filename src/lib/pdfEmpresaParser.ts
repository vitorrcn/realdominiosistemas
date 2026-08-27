// Extrai os dados de um "Relatório de Empresas" (o PDF padrão que o
// escritório usa) e devolve os campos já reconhecidos.
//
// O relatório tem duas colunas de "rótulo: valor". Se a gente ler o
// texto de forma ingênua (sem olhar a posição de cada palavra na
// página), campos que ficam vazios (como "Data de saída") acabam
// roubando o valor do campo vizinho (como "Data de entrada"). Por
// isso aqui a gente usa a posição (x, y) de cada palavra pra
// reconstruir as colunas certinho, do jeito que apareceriam impressas.

import "./pdfjsWorkerSetup";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.js";

interface ItemTexto { texto: string; x: number; y: number }

async function extrairLinhas(buffer: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const linhasTotais: string[] = [];

  for (let pagina = 1; pagina <= doc.numPages; pagina++) {
    const page = await doc.getPage(pagina);
    const conteudo = await page.getTextContent();

    const itens: ItemTexto[] = (conteudo.items as any[])
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ texto: it.str, x: it.transform[4], y: it.transform[5] }));

    // Ordena de cima para baixo (y maior = mais alto na página)
    itens.sort((a, b) => b.y - a.y);

    // Agrupa em "linhas" — palavras cuja posição vertical é bem próxima
    const linhas: ItemTexto[][] = [];
    let atual: ItemTexto[] = [];
    let ultimoY: number | null = null;
    for (const it of itens) {
      if (ultimoY !== null && ultimoY - it.y > 4) {
        linhas.push(atual);
        atual = [];
      }
      atual.push(it);
      ultimoY = it.y;
    }
    if (atual.length) linhas.push(atual);

    // Cada linha vira até duas linhas de texto: coluna esquerda e direita
    // (a divisão em x=300 foi calibrada olhando esse relatório específico)
    for (const linha of linhas) {
      const ordenada = [...linha].sort((a, b) => a.x - b.x);
      const esquerda = ordenada.filter((w) => w.x < 300).map((w) => w.texto).join(" ").trim();
      const direita = ordenada.filter((w) => w.x >= 300).map((w) => w.texto).join(" ").trim();
      if (esquerda) linhasTotais.push(esquerda);
      if (direita) linhasTotais.push(direita);
    }
    linhasTotais.push("---FIM-DA-PAGINA---");
  }

  return linhasTotais.join("\n");
}

function campo(texto: string, rotulo: string): string | null {
  // Pega o que vem depois do rótulo — pode ter pontinhos e ":" antes do
  // valor de verdade (ex: "Bairro:..............: CORREAS"), por isso
  // consome tudo que for ponto/dois-pontos/espaço de uma vez só.
  const regex = new RegExp(rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[.:\\s]+([^\\n]*)", "i");
  const m = texto.match(regex);
  const valor = m?.[1]?.trim();
  return valor ? valor : null;
}

function soDigitos(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d || null;
}

function dataBr(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`; // YYYY-MM-DD
}

function valorMonetario(v: string | null): string | null {
  if (!v) return null;
  const limpo = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isNaN(n) ? null : n.toFixed(2);
}

function regimeTributario(v: string | null): string | null {
  if (!v) return null;
  const t = v.toUpperCase();
  if (t.includes("SIMPLES")) return "SIMPLES_NACIONAL";
  if (t.includes("PRESUMIDO")) return "LUCRO_PRESUMIDO";
  if (t.includes("REAL")) return "LUCRO_REAL";
  if (t.includes("MEI")) return "MEI";
  if (t.includes("ISENTO")) return "ISENTO";
  return "OUTRO";
}

export interface EmpresaExtraidaPdf {
  codigoInterno: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
  municipio: string | null;
  bairro: string | null;
  estado: string | null;
  endereco: string | null;
  complemento: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  inscricaoMunicipal: string | null;
  inscricaoEstadual: string | null;
  capitalSocial: string | null;
  cnae: string | null;
  dataAbertura: string | null;
  dataEntrada: string | null;
  dataSaida: string | null;
  regimeTributario: string | null;
}

export async function extrairEmpresasDoPdf(buffer: Buffer): Promise<EmpresaExtraidaPdf[]> {
  const textoCompleto = await extrairLinhas(buffer);
  const blocos = textoCompleto.split("---FIM-DA-PAGINA---").map((b) => b.trim()).filter(Boolean);

  return blocos.map((bloco) => {
    // "Nome" e "Código" ficam em duas colunas da MESMA linha visual do
    // relatório, mas viram duas linhas de texto seguidas aqui: a
    // primeira é o nome (texto longo, sem ":"), a segunda é só o
    // código (dígitos, sem ":").
    const linhasBloco = bloco.split("\n");
    let razaoSocial: string | null = null;
    let codigoInterno: string | null = null;
    for (let i = 0; i < linhasBloco.length - 1; i++) {
      const linha = linhasBloco[i].trim();
      const proxima = linhasBloco[i + 1].trim();
      if (linha && !linha.includes(":") && linha.length > 5 && /^\d{2,}$/.test(proxima)) {
        razaoSocial = linha;
        codigoInterno = proxima;
        break;
      }
    }

    return {
      codigoInterno,
      razaoSocial: razaoSocial ?? campo(bloco, "Nome Completo"),
      nomeFantasia: campo(bloco, "Nome Fantasia"),
      cnpj: soDigitos(campo(bloco, "CNPJ")),
      municipio: campo(bloco, "Cidade"),
      bairro: campo(bloco, "Bairro"),
      estado: campo(bloco, "UF"),
      endereco: campo(bloco, "Endereço"),
      complemento: campo(bloco, "Complemento"),
      cep: soDigitos(campo(bloco, "CEP")),
      telefone: soDigitos(campo(bloco, "Telefone")),
      email: campo(bloco, "E-Mail"),
      inscricaoMunicipal: campo(bloco, "Insc.Munic"),
      inscricaoEstadual: campo(bloco, "Insc.Estadual"),
      capitalSocial: valorMonetario(campo(bloco, "Capital")),
      cnae: campo(bloco, "CNAE"),
      dataAbertura: dataBr(campo(bloco, "Início Ativ")),
      dataEntrada: dataBr(campo(bloco, "entrada da empresa")),
      dataSaida: dataBr(campo(bloco, "saída da empresa")),
      regimeTributario: regimeTributario(campo(bloco, "Cálc.IR")),
    };
  });
}
