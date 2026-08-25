-- Extensão do Postgres que remove acentos (usada na busca de clientes por
-- nome, pra achar "Confeccoes" mesmo quando o cadastro tem "Confecções").
CREATE EXTENSION IF NOT EXISTS unaccent;
