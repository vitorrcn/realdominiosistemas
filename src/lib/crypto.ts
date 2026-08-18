import crypto from "crypto";

// Deriva uma chave de 32 bytes a partir do NEXTAUTH_SECRET que já existe no
// ambiente — assim não precisamos pedir mais uma variável de ambiente nova.
function obterChave(): Buffer {
  const segredo = process.env.NEXTAUTH_SECRET;
  if (!segredo) {
    throw new Error("NEXTAUTH_SECRET não está definido — necessário para criptografar acessos.");
  }
  return crypto.createHash("sha256").update(segredo).digest();
}

// Formato salvo: "iv:tag:conteudoCifrado" (tudo em hex)
export function criptografar(texto: string): string {
  const chave = obterChave();
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const cifrado = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${cifrado.toString("hex")}`;
}

export function descriptografar(valor: string): string {
  const [ivHex, tagHex, cifradoHex] = valor.split(":");
  if (!ivHex || !tagHex || !cifradoHex) throw new Error("Valor criptografado em formato inválido.");
  const chave = obterChave();
  const decifra = crypto.createDecipheriv("aes-256-gcm", chave, Buffer.from(ivHex, "hex"));
  decifra.setAuthTag(Buffer.from(tagHex, "hex"));
  const decifrado = Buffer.concat([decifra.update(Buffer.from(cifradoHex, "hex")), decifra.final()]);
  return decifrado.toString("utf8");
}
