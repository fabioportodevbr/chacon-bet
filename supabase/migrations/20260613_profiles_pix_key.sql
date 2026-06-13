-- Adiciona chave PIX ao perfil do usuário para recebimento de prêmios
alter table profiles add column if not exists pix_key text;
